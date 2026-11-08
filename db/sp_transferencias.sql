-- Persona 4: transferencias SINPE Móvil / IBAN, cuentas matriculadas y movimientos
-- Orden para cargar la base:
--   01_schema.sql -> 02_datos_prueba.sql -> sp_acceso.sql -> sp_cuentas.sql -> sp_afiliaciones.sql -> este archivo
--
-- Notas:
--  01_schema.sql trae versiones viejas de sp_transferir_sinpe y sp_transferir_iban (3 parámetros).
--   Este archivo las reemplaza por las versiones de la app, así que SIEMPRE se corre después de 01_schema.sql.
--  Se agrega la columna transferencia.detalle (el contrato de la API pide "detalle") y la tabla
--   cuenta_matriculada (terceros del cliente). Se puede correr el archivo varias veces.
--  La entidad y el cliente llegan de la sesión (Node), nunca del navegador.
--  Todo lo que mueve dinero: START TRANSACTION + FOR UPDATE (cuentas bloqueadas en orden de id
--   para evitar bloqueos cruzados) + COMMIT; cualquier error hace ROLLBACK y llega con SIGNAL '45000'.
USE sinpe_movil;


-- Columna detalle en transferencia

DROP PROCEDURE IF EXISTS sp_p4_preparar;
DELIMITER //
CREATE PROCEDURE sp_p4_preparar()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'transferencia'
                      AND COLUMN_NAME = 'detalle') THEN
        ALTER TABLE transferencia ADD COLUMN detalle VARCHAR(100) NULL;
    END IF;
END //
DELIMITER ;
CALL sp_p4_preparar();
DROP PROCEDURE sp_p4_preparar;


-- Terceros del cliente (cuentas matriculadas)

CREATE TABLE IF NOT EXISTS cuenta_matriculada (
    id_matricula INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_cuenta INT NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_matricula UNIQUE (id_cliente, id_cuenta),
    CONSTRAINT fk_matricula_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
    CONSTRAINT fk_matricula_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta_iban (id_cuenta)
);


DELIMITER //


-- sp_sinpe_destino: valida el número destino y devuelve el nombre del titular.
--   1 fila: numero, titular, afiliado (1/0), iban, entidad

DROP PROCEDURE IF EXISTS sp_sinpe_destino //
CREATE PROCEDURE sp_sinpe_destino(
    IN p_numero VARCHAR(8)
)
BEGIN
    IF p_numero IS NULL OR p_numero NOT REGEXP '^[0-9]{8}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número debe tener 8 dígitos';
    ELSEIF NOT EXISTS (SELECT 1 FROM telefono_cliente WHERE numero = p_numero) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número no está registrado';
    END IF;

    SELECT t.numero,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           IF(a.id_afiliacion IS NULL, 0, 1) AS afiliado,
           ci.iban,
           e.nombre AS entidad
    FROM telefono_cliente t
    JOIN cliente c                 ON c.id_cliente = t.id_cliente
    LEFT JOIN afiliacion_sinpe a   ON a.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban ci       ON ci.id_cuenta = a.id_cuenta
    LEFT JOIN entidad_financiera e ON e.id_entidad = ci.id_entidad
    WHERE t.numero = p_numero;
END //



-- sp_transferir_sinpe: transfiere entre dos números afiliados.
--   p_id_entidad / p_id_cliente = los de la sesión
--   La cuenta origen sale de la afiliación del número origen, que debe ser del cliente.
--   Devuelve el comprobante (1 fila).

DROP PROCEDURE IF EXISTS sp_transferir_sinpe //
CREATE PROCEDURE sp_transferir_sinpe(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_num_origen VARCHAR(8),
    IN p_num_destino VARCHAR(8),
    IN p_monto DECIMAL(15,2),
    IN p_detalle VARCHAR(100)
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);
    DECLARE v_id_tel_o INT;
    DECLARE v_cliente_tel_o INT;
    DECLARE v_cuenta_o INT;
    DECLARE v_id_tel_d INT;
    DECLARE v_cuenta_d INT;
    DECLARE v_entidad_o INT;
    DECLARE v_estado_o VARCHAR(10);
    DECLARE v_moneda_o CHAR(3);
    DECLARE v_saldo_o DECIMAL(15,2);
    DECLARE v_estado_d VARCHAR(10);
    DECLARE v_moneda_d CHAR(3);
    DECLARE v_bloqueo INT;
    DECLARE v_id_transferencia BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;

    SELECT t.id_telefono, t.id_cliente, a.id_cuenta
      INTO v_id_tel_o, v_cliente_tel_o, v_cuenta_o
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    WHERE t.numero = p_num_origen;

    SELECT t.id_telefono, a.id_cuenta
      INTO v_id_tel_d, v_cuenta_d
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    WHERE t.numero = p_num_destino;

    IF p_monto IS NULL OR p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    ELSEIF v_estado_cliente IS NULL OR v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no está activo';
    ELSEIF v_id_tel_o IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número de origen no está registrado';
    ELSEIF v_cliente_tel_o <> p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número de origen no pertenece al titular';
    ELSEIF v_cuenta_o IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número de origen no está afiliado a SINPE Móvil';
    ELSEIF v_id_tel_d IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número destino no está registrado';
    ELSEIF v_cuenta_d IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número destino no está afiliado a SINPE Móvil';
    ELSEIF v_cuenta_o = v_cuenta_d THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El origen y el destino están en la misma cuenta';
    END IF;

    SELECT id_entidad INTO v_entidad_o FROM cuenta_iban WHERE id_cuenta = v_cuenta_o;
    IF v_entidad_o <> p_id_entidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no pertenece a esta entidad';
    END IF;

    -- bloquear las dos cuentas siempre en orden de id (evita bloqueos cruzados)
    SELECT COUNT(*) INTO v_bloqueo
    FROM cuenta_iban WHERE id_cuenta IN (v_cuenta_o, v_cuenta_d) FOR UPDATE;

    -- lecturas con FOR UPDATE: leen el valor más reciente, no el de antes del bloqueo
    SELECT estado, moneda, saldo INTO v_estado_o, v_moneda_o, v_saldo_o
    FROM cuenta_iban WHERE id_cuenta = v_cuenta_o FOR UPDATE;

    SELECT estado, moneda INTO v_estado_d, v_moneda_d
    FROM cuenta_iban WHERE id_cuenta = v_cuenta_d FOR UPDATE;

    IF v_estado_o <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no está activa';
    ELSEIF v_estado_d <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta destino no está activa';
    ELSEIF v_moneda_o <> 'CRC' OR v_moneda_d <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SINPE Móvil solo funciona en colones';
    ELSEIF v_saldo_o < p_monto THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente';
    END IF;

    UPDATE cuenta_iban SET saldo = saldo - p_monto WHERE id_cuenta = v_cuenta_o;
    UPDATE cuenta_iban SET saldo = saldo + p_monto WHERE id_cuenta = v_cuenta_d;

    INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo, detalle)
    VALUES (v_cuenta_o, v_cuenta_d, p_monto, 'SINPE_MOVIL', NULLIF(TRIM(p_detalle), ''));

    SET v_id_transferencia = LAST_INSERT_ID();

    INSERT INTO transferencia_sinpe (id_transferencia, id_telefono_origen, id_telefono_destino)
    VALUES (v_id_transferencia, v_id_tel_o, v_id_tel_d);

    COMMIT;

    -- comprobante
    SELECT t.id_transferencia AS idTransferencia,
           DATE_FORMAT(t.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha,
           t.tipo,
           t.monto,
           co.moneda,
           t.detalle,
           co.iban AS ibanOrigen,
           eo.nombre AS entidadOrigen,
           cd.iban AS ibanDestino,
           ed.nombre AS entidadDestino,
           CONCAT(cl.nombres, ' ', cl.primer_apellido, ' ', cl.segundo_apellido) AS titularDestino,
           p_num_origen AS telefonoOrigen,
           p_num_destino AS telefonoDestino,
           v_saldo_o AS saldoAntes,
           v_saldo_o - p_monto AS saldoDespues
    FROM transferencia t
    JOIN cuenta_iban co            ON co.id_cuenta = t.id_cuenta_origen
    JOIN cuenta_iban cd            ON cd.id_cuenta = t.id_cuenta_destino
    JOIN entidad_financiera eo     ON eo.id_entidad = co.id_entidad
    JOIN entidad_financiera ed     ON ed.id_entidad = cd.id_entidad
    JOIN cliente cl                ON cl.id_cliente = cd.id_cliente
    WHERE t.id_transferencia = v_id_transferencia;
END //



-- sp_matricular_cuenta: el cliente guarda la cuenta de un tercero para transferirle por IBAN.
--   Devuelve la cuenta matriculada: iban, titular, entidad, moneda, estado

DROP PROCEDURE IF EXISTS sp_matricular_cuenta //
CREATE PROCEDURE sp_matricular_cuenta(
    IN p_id_cliente INT,
    IN p_iban CHAR(22)
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);
    DECLARE v_id_cuenta INT;
    DECLARE v_cliente_cta INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;

    SELECT id_cuenta, id_cliente INTO v_id_cuenta, v_cliente_cta
    FROM cuenta_iban WHERE iban = p_iban;

    IF v_estado_cliente IS NULL OR v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no está activo';
    ELSEIF p_iban IS NULL OR CHAR_LENGTH(p_iban) <> 22 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN debe tener 22 caracteres';
    ELSEIF v_id_cuenta IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no existe';
    ELSEIF v_cliente_cta = p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Es una cuenta suya: no necesita matricularse';
    ELSEIF EXISTS (SELECT 1 FROM cuenta_matriculada
                    WHERE id_cliente = p_id_cliente AND id_cuenta = v_id_cuenta) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta ya está matriculada';
    END IF;

    INSERT INTO cuenta_matriculada (id_cliente, id_cuenta) VALUES (p_id_cliente, v_id_cuenta);

    COMMIT;

    SELECT ci.iban,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           e.nombre AS entidad,
           ci.moneda,
           ci.estado
    FROM cuenta_iban ci
    JOIN cliente c             ON c.id_cliente = ci.id_cliente
    JOIN entidad_financiera e  ON e.id_entidad = ci.id_entidad
    WHERE ci.id_cuenta = v_id_cuenta;
END //



-- sp_listar_matriculadas: terceros del cliente, los más recientes primero

DROP PROCEDURE IF EXISTS sp_listar_matriculadas //
CREATE PROCEDURE sp_listar_matriculadas(
    IN p_id_cliente INT
)
BEGIN
    SELECT ci.iban,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           e.nombre AS entidad,
           ci.moneda,
           ci.estado
    FROM cuenta_matriculada m
    JOIN cuenta_iban ci        ON ci.id_cuenta = m.id_cuenta
    JOIN cliente c             ON c.id_cliente = ci.id_cliente
    JOIN entidad_financiera e  ON e.id_entidad = ci.id_entidad
    WHERE m.id_cliente = p_id_cliente
    ORDER BY m.fecha_registro DESC, m.id_matricula DESC;
END //



-- sp_transferir_iban: transfiere de una cuenta del cliente a otra propia o matriculada.
--   Misma moneda (regla 8): si es distinta se rechaza.
--   Devuelve el comprobante (telefonoOrigen y telefonoDestino van en NULL).


DROP PROCEDURE IF EXISTS sp_transferir_iban //
CREATE PROCEDURE sp_transferir_iban(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_iban_origen CHAR(22),
    IN p_iban_destino CHAR(22),
    IN p_monto DECIMAL(15,2),
    IN p_detalle VARCHAR(100)
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);
    DECLARE v_cuenta_o INT;
    DECLARE v_cliente_o INT;
    DECLARE v_entidad_o INT;
    DECLARE v_cuenta_d INT;
    DECLARE v_cliente_d INT;
    DECLARE v_estado_o VARCHAR(10);
    DECLARE v_moneda_o CHAR(3);
    DECLARE v_saldo_o DECIMAL(15,2);
    DECLARE v_estado_d VARCHAR(10);
    DECLARE v_moneda_d CHAR(3);
    DECLARE v_bloqueo INT;
    DECLARE v_id_transferencia BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;

    SELECT id_cuenta, id_cliente, id_entidad INTO v_cuenta_o, v_cliente_o, v_entidad_o
    FROM cuenta_iban WHERE iban = p_iban_origen;

    SELECT id_cuenta, id_cliente INTO v_cuenta_d, v_cliente_d
    FROM cuenta_iban WHERE iban = p_iban_destino;

    IF p_monto IS NULL OR p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    ELSEIF v_estado_cliente IS NULL OR v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no está activo';
    ELSEIF v_cuenta_o IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no existe';
    ELSEIF v_cliente_o <> p_id_cliente OR v_entidad_o <> p_id_entidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no es una cuenta suya en esta entidad';
    ELSEIF v_cuenta_d IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta destino no existe';
    ELSEIF v_cuenta_o = v_cuenta_d THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede transferir a la misma cuenta';
    ELSEIF v_cliente_d <> p_id_cliente
       AND NOT EXISTS (SELECT 1 FROM cuenta_matriculada
                        WHERE id_cliente = p_id_cliente AND id_cuenta = v_cuenta_d) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta destino no es suya ni está matriculada';
    END IF;

    -- bloquear las dos cuentas siempre en orden de id
    SELECT COUNT(*) INTO v_bloqueo
    FROM cuenta_iban WHERE id_cuenta IN (v_cuenta_o, v_cuenta_d) FOR UPDATE;

    SELECT estado, moneda, saldo INTO v_estado_o, v_moneda_o, v_saldo_o
    FROM cuenta_iban WHERE id_cuenta = v_cuenta_o FOR UPDATE;

    SELECT estado, moneda INTO v_estado_d, v_moneda_d
    FROM cuenta_iban WHERE id_cuenta = v_cuenta_d FOR UPDATE;

    IF v_estado_o <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no está activa';
    ELSEIF v_estado_d <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta destino no está activa';
    ELSEIF v_moneda_o <> v_moneda_d THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las cuentas deben tener la misma moneda';
    ELSEIF v_saldo_o < p_monto THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente';
    END IF;

    UPDATE cuenta_iban SET saldo = saldo - p_monto WHERE id_cuenta = v_cuenta_o;
    UPDATE cuenta_iban SET saldo = saldo + p_monto WHERE id_cuenta = v_cuenta_d;

    INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo, detalle)
    VALUES (v_cuenta_o, v_cuenta_d, p_monto, 'IBAN', NULLIF(TRIM(p_detalle), ''));

    SET v_id_transferencia = LAST_INSERT_ID();

    COMMIT;

    -- comprobante
    SELECT t.id_transferencia AS idTransferencia,
           DATE_FORMAT(t.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha,
           t.tipo,
           t.monto,
           co.moneda,
           t.detalle,
           co.iban AS ibanOrigen,
           eo.nombre AS entidadOrigen,
           cd.iban AS ibanDestino,
           ed.nombre AS entidadDestino,
           CONCAT(cl.nombres, ' ', cl.primer_apellido, ' ', cl.segundo_apellido) AS titularDestino,
           NULL AS telefonoOrigen,
           NULL AS telefonoDestino,
           v_saldo_o AS saldoAntes,
           v_saldo_o - p_monto AS saldoDespues
    FROM transferencia t
    JOIN cuenta_iban co            ON co.id_cuenta = t.id_cuenta_origen
    JOIN cuenta_iban cd            ON cd.id_cuenta = t.id_cuenta_destino
    JOIN entidad_financiera eo     ON eo.id_entidad = co.id_entidad
    JOIN entidad_financiera ed     ON ed.id_entidad = cd.id_entidad
    JOIN cliente cl                ON cl.id_cliente = cd.id_cliente
    WHERE t.id_transferencia = v_id_transferencia;
END //



-- sp_movimientos: movimientos del período, más recientes primero.
--   p_id_cliente = NULL -> admin: toda la entidad (movimiento = NULL)
--   p_id_cliente = id   -> cliente: solo sus cuentas en esta entidad
--   p_desde / p_hasta / p_iban son opcionales (NULL = sin filtro); p_hasta incluye todo ese día.
--   movimiento: ENVIADA | RECIBIDA | ENTRE_MIS_CUENTAS


DROP PROCEDURE IF EXISTS sp_movimientos //
CREATE PROCEDURE sp_movimientos(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_desde DATE,
    IN p_hasta DATE,
    IN p_iban CHAR(22)
)
BEGIN
    IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_desde > p_hasta THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha inicial no puede ser mayor que la final';
    END IF;

    SELECT t.id_transferencia AS idTransferencia,
           DATE_FORMAT(t.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha,
           t.tipo,
           CASE
               WHEN p_id_cliente IS NULL THEN NULL
               WHEN co.id_cliente = p_id_cliente AND cd.id_cliente = p_id_cliente THEN 'ENTRE_MIS_CUENTAS'
               WHEN co.id_cliente = p_id_cliente THEN 'ENVIADA'
               ELSE 'RECIBIDA'
           END AS movimiento,
           t.monto,
           co.moneda,
           t.detalle,
           co.iban AS ibanOrigen,
           CONCAT(clo.nombres, ' ', clo.primer_apellido, ' ', clo.segundo_apellido) AS titularOrigen,
           eo.codigo AS codigoOrigen,
           cd.iban AS ibanDestino,
           CONCAT(cld.nombres, ' ', cld.primer_apellido, ' ', cld.segundo_apellido) AS titularDestino,
           ed.codigo AS codigoDestino,
           tel_o.numero AS telefonoOrigen,
           tel_d.numero AS telefonoDestino
    FROM transferencia t
    JOIN cuenta_iban co            ON co.id_cuenta = t.id_cuenta_origen
    JOIN cuenta_iban cd            ON cd.id_cuenta = t.id_cuenta_destino
    JOIN cliente clo               ON clo.id_cliente = co.id_cliente
    JOIN cliente cld               ON cld.id_cliente = cd.id_cliente
    JOIN entidad_financiera eo     ON eo.id_entidad = co.id_entidad
    JOIN entidad_financiera ed     ON ed.id_entidad = cd.id_entidad
    LEFT JOIN transferencia_sinpe ts ON ts.id_transferencia = t.id_transferencia
    LEFT JOIN telefono_cliente tel_o ON tel_o.id_telefono = ts.id_telefono_origen
    LEFT JOIN telefono_cliente tel_d ON tel_d.id_telefono = ts.id_telefono_destino
    WHERE (
              (p_id_cliente IS NULL
                  AND (co.id_entidad = p_id_entidad OR cd.id_entidad = p_id_entidad))
           OR (p_id_cliente IS NOT NULL
                  AND ((co.id_cliente = p_id_cliente AND co.id_entidad = p_id_entidad)
                    OR (cd.id_cliente = p_id_cliente AND cd.id_entidad = p_id_entidad)))
          )
      AND (p_desde IS NULL OR t.fecha >= p_desde)
      AND (p_hasta IS NULL OR t.fecha < DATE_ADD(p_hasta, INTERVAL 1 DAY))
      AND (p_iban IS NULL OR co.iban = p_iban OR cd.iban = p_iban)
    ORDER BY t.fecha DESC, t.id_transferencia DESC;
END //

DELIMITER ;



-- Pruebas (BAC = entidad 4; cliente.demo = id_cliente 16, cuenta CR...016, número 80000016)
-- Ajuste los números si 02_datos_prueba.sql cambió los teléfonos o las cuentas.

-- CALL sp_sinpe_destino('80000018');
-- CALL sp_transferir_sinpe(4, 16, '80000016', '80000018', 15000, 'Prueba SINPE');     -- OK, devuelve comprobante
-- CALL sp_transferir_sinpe(4, 16, '80000016', '80000018', 999999999, 'x');            -- ERROR: saldo insuficiente
-- CALL sp_transferir_sinpe(4, 16, '80000016', '80000016', 1000, 'x');                 -- ERROR: misma cuenta
-- CALL sp_transferir_sinpe(4, 16, '80000001', '80000018', 1000, 'x');                 -- ERROR: número no es del titular
-- CALL sp_transferir_sinpe(4, 16, '80000016', '80000020', 1000, 'x');                 -- ERROR: destino no afiliado
-- CALL sp_matricular_cuenta(16, 'CR00000000000000000018');                            -- OK
-- CALL sp_matricular_cuenta(16, 'CR00000000000000000016');                            -- ERROR: es suya
-- CALL sp_listar_matriculadas(16);
-- CALL sp_transferir_iban(4, 16, 'CR00000000000000000016', 'CR00000000000000000018', 2000, 'Prueba IBAN');  -- OK
-- CALL sp_transferir_iban(4, 16, 'CR00000000000000000016', 'CR00000000000000000017', 2000, 'x');            -- ERROR: no matriculada
-- CALL sp_matricular_cuenta(16, 'CR00000000000000000031');                            -- cuenta en USD de otro cliente
-- CALL sp_transferir_iban(4, 16, 'CR00000000000000000016', 'CR00000000000000000031', 2000, 'x');            -- ERROR: moneda
-- CALL sp_movimientos(4, 16, NULL, NULL, NULL);                                       -- cliente
-- CALL sp_movimientos(4, NULL, '2026-01-01', CURDATE(), NULL);                        -- admin