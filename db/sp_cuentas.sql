-- Persona 2: cuentas y teléfonos
-- Orden para cargar la base: 01_schema.sql -> 02_datos_prueba.sql -> sp_acceso.sql -> este archivo
USE sinpe_movil;

DELIMITER //

-- ============================================================================
-- sp_listar_cuentas: cuentas de UNA entidad.
--   p_id_cliente = NULL  -> todas las cuentas de la entidad (admin)
--   p_id_cliente = 16    -> solo las de ese cliente (cliente / "mis cuentas")
-- "numeros" = teléfonos afiliados a la cuenta, separados por coma ('80000016,70000016')
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_listar_cuentas //
CREATE PROCEDURE sp_listar_cuentas(
    IN p_id_entidad INT,
    IN p_id_cliente INT
)
BEGIN
    SELECT ci.id_cuenta  AS idCuenta,
           ci.id_cliente AS idCliente,
           ci.iban,
           ci.moneda,
           ci.saldo,
           ci.estado,
           DATE_FORMAT(ci.fecha_apertura, '%Y-%m-%d') AS fechaApertura,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           c.identificacion,
           (SELECT GROUP_CONCAT(t.numero ORDER BY t.numero)
              FROM afiliacion_sinpe a
              JOIN telefono_cliente t ON t.id_telefono = a.id_telefono
             WHERE a.id_cuenta = ci.id_cuenta) AS numeros
    FROM cuenta_iban ci
    JOIN cliente c ON c.id_cliente = ci.id_cliente
    WHERE ci.id_entidad = p_id_entidad
      AND (p_id_cliente IS NULL OR ci.id_cliente = p_id_cliente)
    ORDER BY titular, ci.fecha_apertura, ci.id_cuenta;
END //


-- ============================================================================
-- sp_abrir_cuenta: el administrador abre una cuenta y el procedimiento GENERA el IBAN.
-- Regla: IBAN de 22 caracteres con el código de la entidad:
--   CR + 2 dígitos de control + 0 + código de entidad (3) + 14 dígitos = 22
--   ej. Banco JUNTAUCR -> CR47 0 UCR 12345678901234 -> 'CR470UCR12345678901234'
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_abrir_cuenta //
CREATE PROCEDURE sp_abrir_cuenta(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_moneda CHAR(3),
    IN p_saldo DECIMAL(15,2),
    IN p_fecha_apertura DATE
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);
    DECLARE v_codigo VARCHAR(12);
    DECLARE v_iban CHAR(22);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;
    SELECT codigo INTO v_codigo FROM entidad_financiera WHERE id_entidad = p_id_entidad;

    IF v_estado_cliente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el titular';
    ELSEIF v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular está inactivo';
    ELSEIF v_codigo IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe la entidad financiera';
    ELSEIF NOT EXISTS (SELECT 1 FROM moneda WHERE codigo = p_moneda) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La moneda no existe';
    ELSEIF p_saldo IS NULL OR p_saldo < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El saldo no puede ser negativo';
    END IF;

    -- Generar el IBAN hasta que salga uno que no exista (casi siempre al primer intento)
    REPEAT
        SET v_iban = CONCAT(
            'CR',
            LPAD(FLOOR(RAND() * 100), 2, '0'),          -- 2 dígitos de control
            '0',
            RIGHT(LPAD(v_codigo, 3, '0'), 3),           -- código de la entidad en 3 caracteres
            LPAD(FLOOR(RAND() * 10000000), 7, '0'),     -- 7 dígitos
            LPAD(FLOOR(RAND() * 10000000), 7, '0')      -- + 7 dígitos = 14
        );
    UNTIL NOT EXISTS (SELECT 1 FROM cuenta_iban WHERE iban = v_iban) END REPEAT;

    IF CHAR_LENGTH(v_iban) <> 22 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN debe tener 22 caracteres';
    END IF;

    INSERT INTO cuenta_iban (id_cliente, id_entidad, moneda, iban, saldo, estado, fecha_apertura)
    VALUES (p_id_cliente, p_id_entidad, p_moneda, v_iban, p_saldo, 'ACTIVA', IFNULL(p_fecha_apertura, CURDATE()));

    COMMIT;
    SELECT v_iban AS iban, LAST_INSERT_ID() AS idCuenta;
END //


-- ============================================================================
-- sp_cambiar_estado_cuenta: ACTIVA / BLOQUEADA / INACTIVA.
-- Solo cuentas de la entidad del administrador.
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_cambiar_estado_cuenta //
CREATE PROCEDURE sp_cambiar_estado_cuenta(
    IN p_id_entidad INT,
    IN p_id_cuenta INT,
    IN p_estado VARCHAR(10)
)
BEGIN
    DECLARE v_estado_actual VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    IF p_estado NOT IN ('ACTIVA', 'BLOQUEADA', 'INACTIVA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estado no válido';
    END IF;

    -- FOR UPDATE: bloquea la fila mientras se cambia
    SELECT estado INTO v_estado_actual
    FROM cuenta_iban
    WHERE id_cuenta = p_id_cuenta AND id_entidad = p_id_entidad
    FOR UPDATE;

    IF v_estado_actual IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no existe en esta entidad';
    ELSEIF v_estado_actual = p_estado THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta ya tiene ese estado';
    END IF;

    UPDATE cuenta_iban SET estado = p_estado WHERE id_cuenta = p_id_cuenta;

    COMMIT;
    SELECT 'Estado actualizado' AS mensaje;
END //


-- ============================================================================
-- sp_registrar_telefono: registra un teléfono a nombre de un cliente de la entidad.
-- Reglas: 8 dígitos; un teléfono tiene UN SOLO titular (no se repite);
--         registrar NO afilia (solo inserta en telefono_cliente, nunca en afiliacion_sinpe).
-- Reemplaza la versión del script base: ahora también recibe la entidad.
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_registrar_telefono //
CREATE PROCEDURE sp_registrar_telefono(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_numero VARCHAR(8)
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;

    IF v_estado_cliente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el titular';
    ELSEIF v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular está inactivo';
    ELSEIF NOT EXISTS (SELECT 1 FROM usuario WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad)
       AND NOT EXISTS (SELECT 1 FROM cuenta_iban WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no pertenece a esta entidad';
    ELSEIF p_numero IS NULL OR p_numero NOT REGEXP '^[0-9]{8}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono debe tener 8 dígitos';
    ELSEIF EXISTS (SELECT 1 FROM telefono_cliente WHERE numero = p_numero) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono ya está registrado';
    END IF;

    INSERT INTO telefono_cliente (id_cliente, numero) VALUES (p_id_cliente, p_numero);

    COMMIT;
    SELECT 'Teléfono registrado' AS mensaje;
END //


-- ============================================================================
-- sp_listar_telefonos: teléfonos con su estado de afiliación.
--   p_id_cliente = NULL -> todos los clientes de la entidad (admin)
--   estado: NO_AFILIADO | AFILIADO (a una cuenta de esta entidad) | AFILIADO_OTRA (a otra entidad)
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_listar_telefonos //
CREATE PROCEDURE sp_listar_telefonos(
    IN p_id_entidad INT,
    IN p_id_cliente INT
)
BEGIN
    SELECT t.numero,
           DATE_FORMAT(t.fecha_registro, '%Y-%m-%dT%H:%i:%s') AS fechaRegistro,
           c.id_cliente AS idCliente,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           c.identificacion,
           CASE
               WHEN a.id_afiliacion IS NULL THEN 'NO_AFILIADO'
               WHEN ci.id_entidad = p_id_entidad THEN 'AFILIADO'
               ELSE 'AFILIADO_OTRA'
           END AS estado,
           ci.iban,
           e.nombre AS entidad,
           DATE_FORMAT(a.fecha_afiliacion, '%Y-%m-%dT%H:%i:%s') AS fechaAfiliacion
    FROM telefono_cliente t
    JOIN cliente c                 ON c.id_cliente   = t.id_cliente
    LEFT JOIN afiliacion_sinpe a   ON a.id_telefono  = t.id_telefono
    LEFT JOIN cuenta_iban ci       ON ci.id_cuenta   = a.id_cuenta
    LEFT JOIN entidad_financiera e ON e.id_entidad   = ci.id_entidad
    WHERE (p_id_cliente IS NOT NULL AND t.id_cliente = p_id_cliente)
       OR (p_id_cliente IS NULL AND (
              EXISTS (SELECT 1 FROM usuario u WHERE u.id_cliente = c.id_cliente AND u.id_entidad = p_id_entidad)
           OR EXISTS (SELECT 1 FROM cuenta_iban x WHERE x.id_cliente = c.id_cliente AND x.id_entidad = p_id_entidad)))
    ORDER BY titular, t.numero;
END //


-- ============================================================================
-- sp_resumen_cliente: tarjetas de Inicio del cliente. Devuelve 3 resultados:
--   1) sus cuentas en la entidad   2) teléfonos { total, afiliados }   3) últimos 5 movimientos
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_resumen_cliente //
CREATE PROCEDURE sp_resumen_cliente(
    IN p_id_entidad INT,
    IN p_id_cliente INT
)
BEGIN
    -- 1) cuentas
    CALL sp_listar_cuentas(p_id_entidad, p_id_cliente);

    -- 2) teléfonos: total registrados y cuántos están afiliados en esta entidad
    SELECT COUNT(*) AS total,
           COALESCE(SUM(a.id_afiliacion IS NOT NULL AND ci.id_entidad = p_id_entidad), 0) AS afiliados
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban ci     ON ci.id_cuenta  = a.id_cuenta
    WHERE t.id_cliente = p_id_cliente;

    -- 3) últimos 5 movimientos de sus cuentas en esta entidad (mismos campos que /api/movimientos)
    SELECT tr.id_transferencia AS idTransferencia,
           DATE_FORMAT(tr.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha,
           tr.tipo,
           CASE
               WHEN co.id_cliente = p_id_cliente AND cd.id_cliente = p_id_cliente THEN 'ENTRE_MIS_CUENTAS'
               WHEN co.id_cliente = p_id_cliente THEN 'ENVIADA'
               ELSE 'RECIBIDA'
           END AS movimiento,
           tr.monto,
           co.moneda,
           NULL AS detalle,
           co.iban AS ibanOrigen,
           CONCAT(clo.nombres, ' ', clo.primer_apellido, ' ', clo.segundo_apellido) AS titularOrigen,
           eo.codigo AS codigoOrigen,
           cd.iban AS ibanDestino,
           CONCAT(cld.nombres, ' ', cld.primer_apellido, ' ', cld.segundo_apellido) AS titularDestino,
           ed.codigo AS codigoDestino,
           tlo.numero AS telefonoOrigen,
           tld.numero AS telefonoDestino
    FROM transferencia tr
    JOIN cuenta_iban co         ON co.id_cuenta   = tr.id_cuenta_origen
    JOIN cuenta_iban cd         ON cd.id_cuenta   = tr.id_cuenta_destino
    JOIN cliente clo            ON clo.id_cliente = co.id_cliente
    JOIN cliente cld            ON cld.id_cliente = cd.id_cliente
    JOIN entidad_financiera eo  ON eo.id_entidad  = co.id_entidad
    JOIN entidad_financiera ed  ON ed.id_entidad  = cd.id_entidad
    LEFT JOIN transferencia_sinpe ts ON ts.id_transferencia = tr.id_transferencia
    LEFT JOIN telefono_cliente tlo   ON tlo.id_telefono = ts.id_telefono_origen
    LEFT JOIN telefono_cliente tld   ON tld.id_telefono = ts.id_telefono_destino
    WHERE (co.id_cliente = p_id_cliente AND co.id_entidad = p_id_entidad)
       OR (cd.id_cliente = p_id_cliente AND cd.id_entidad = p_id_entidad)
    ORDER BY tr.fecha DESC, tr.id_transferencia DESC
    LIMIT 5;
END //


-- ============================================================================
-- sp_resumen_entidad: tarjetas de Inicio del administrador. Devuelve 2 resultados:
--   1) una fila con todos los contadores   2) afiliaciones vigentes de la entidad
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_resumen_entidad //
CREATE PROCEDURE sp_resumen_entidad(
    IN p_id_entidad INT
)
BEGIN
    -- 1) contadores
    SELECT
        (SELECT COUNT(*) FROM cliente c
          WHERE c.estado = 'ACTIVO'
            AND (EXISTS (SELECT 1 FROM usuario u WHERE u.id_cliente = c.id_cliente AND u.id_entidad = p_id_entidad)
              OR EXISTS (SELECT 1 FROM cuenta_iban x WHERE x.id_cliente = c.id_cliente AND x.id_entidad = p_id_entidad))
        ) AS clientesActivos,
        (SELECT COUNT(*) FROM cliente c
          WHERE c.estado <> 'ACTIVO'
            AND (EXISTS (SELECT 1 FROM usuario u WHERE u.id_cliente = c.id_cliente AND u.id_entidad = p_id_entidad)
              OR EXISTS (SELECT 1 FROM cuenta_iban x WHERE x.id_cliente = c.id_cliente AND x.id_entidad = p_id_entidad))
        ) AS clientesInactivos,
        (SELECT COUNT(*) FROM cuenta_iban WHERE id_entidad = p_id_entidad) AS cuentasTotal,
        (SELECT COUNT(*) FROM cuenta_iban WHERE id_entidad = p_id_entidad AND estado = 'BLOQUEADA') AS cuentasBloqueadas,
        (SELECT COUNT(*) FROM cuenta_iban WHERE id_entidad = p_id_entidad AND estado = 'INACTIVA') AS cuentasInactivas,
        (SELECT COUNT(*) FROM afiliacion_sinpe a
           JOIN cuenta_iban ci ON ci.id_cuenta = a.id_cuenta
          WHERE ci.id_entidad = p_id_entidad) AS numerosAfiliados,
        (SELECT COUNT(*) FROM transferencia tr
           JOIN cuenta_iban co ON co.id_cuenta = tr.id_cuenta_origen
           JOIN cuenta_iban cd ON cd.id_cuenta = tr.id_cuenta_destino
          WHERE tr.fecha >= NOW() - INTERVAL 30 DAY
            AND (co.id_entidad = p_id_entidad OR cd.id_entidad = p_id_entidad)) AS movimientosPeriodo;

    -- 2) afiliaciones vigentes (números afiliados a cuentas de esta entidad)
    SELECT t.numero,
           c.id_cliente AS idCliente,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           c.identificacion,
           ci.iban,
           DATE_FORMAT(a.fecha_afiliacion, '%Y-%m-%dT%H:%i:%s') AS fechaAfiliacion
    FROM afiliacion_sinpe a
    JOIN telefono_cliente t ON t.id_telefono = a.id_telefono
    JOIN cuenta_iban ci     ON ci.id_cuenta  = a.id_cuenta
    JOIN cliente c          ON c.id_cliente  = ci.id_cliente
    WHERE ci.id_entidad = p_id_entidad
    ORDER BY a.fecha_afiliacion DESC, t.numero;
END //

DELIMITER ;


-- ============================================================================
-- PRUEBAS (entidad 4 = BAC, donde están cliente.demo y admin.demo; cliente 16 = Camila)
-- Las marcadas "ERROR" están comentadas: quite el "-- " y ejecute solo esa línea.
-- ============================================================================

-- Listar
CALL sp_listar_cuentas(4, NULL);          -- todas las cuentas del BAC
CALL sp_listar_cuentas(4, 16);            -- solo las de Camila (su número afiliado sale en "numeros")
CALL sp_listar_telefonos(4, 16);          -- 80000016 AFILIADO, 70000016 NO_AFILIADO

-- Abrir cuenta: el IBAN sale generado, con 22 caracteres
CALL sp_abrir_cuenta(4, 16, 'USD', 500, CURDATE());
SELECT iban, CHAR_LENGTH(iban) AS largo FROM cuenta_iban ORDER BY id_cuenta DESC LIMIT 1;   -- largo = 22
-- CALL sp_abrir_cuenta(4, 16, 'EUR', 500, CURDATE());   -- ERROR: la moneda no existe
-- CALL sp_abrir_cuenta(4, 99, 'CRC', 500, CURDATE());   -- ERROR: no existe el titular
-- CALL sp_abrir_cuenta(4, 16, 'CRC', -1, CURDATE());    -- ERROR: saldo negativo

-- Cambiar estado
CALL sp_cambiar_estado_cuenta(4, 16, 'BLOQUEADA');
CALL sp_cambiar_estado_cuenta(4, 16, 'ACTIVA');
-- CALL sp_cambiar_estado_cuenta(4, 16, 'ACTIVA');      -- ERROR: ya tiene ese estado
-- CALL sp_cambiar_estado_cuenta(4, 1, 'BLOQUEADA');    -- ERROR: la cuenta 1 es del BCR, no del BAC
-- CALL sp_cambiar_estado_cuenta(4, 16, 'CERRADA');     -- ERROR: estado no válido

-- Registrar teléfono: queda NO afiliado
CALL sp_registrar_telefono(4, 16, '61234567');
SELECT t.numero, a.id_afiliacion
FROM telefono_cliente t LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
WHERE t.numero = '61234567';                                -- id_afiliacion = NULL (registrar no afilia)
-- CALL sp_registrar_telefono(4, 16, '80000001');   -- ERROR: ya está registrado (es de otro titular)
-- CALL sp_registrar_telefono(4, 16, '1234');       -- ERROR: 8 dígitos
-- CALL sp_registrar_telefono(4, 1, '61111111');    -- ERROR: el cliente 1 no pertenece al BAC

-- Resúmenes de Inicio
CALL sp_resumen_cliente(4, 16);
CALL sp_resumen_entidad(4);
