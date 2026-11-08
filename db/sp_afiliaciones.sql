-- Persona 3: afiliaciones SINPE Móvil e historial
-- Orden para cargar la base:
--   01_schema.sql -> 02_datos_prueba.sql -> sp_acceso.sql -> sp_cuentas.sql -> este archivo
--
-- Notas:
-- * El historial lo escriben los triggers de 01_schema.sql (trg_auditoria_afiliacion y
--   trg_auditoria_desafiliacion). Aquí NO se inserta a mano para no duplicar eventos.
-- * Para saber QUIÉN hizo cada evento se agrega la columna historial_afiliacion.id_usuario
--   (puede ser NULL: los eventos de los datos de prueba quedan como "Sistema").
--   Los procedimientos la llenan después del INSERT/DELETE, dentro de la misma transacción.
-- * Reglas: solo cuentas en colones y ACTIVAS de la entidad de la sesión; el teléfono debe ser
--   del mismo titular; un número afiliado en otra entidad se desafilia allá.
-- * El traslado es desafiliar + afiliar en UNA transacción: si el paso 2 falla, ROLLBACK.
USE sinpe_movil;

-- ----------------------------------------------------------------------------
-- Columna id_usuario en historial_afiliacion (se puede correr el archivo varias veces)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_p3_agregar_usuario_historial;
DELIMITER //
CREATE PROCEDURE sp_p3_agregar_usuario_historial()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'historial_afiliacion'
                      AND COLUMN_NAME = 'id_usuario') THEN
        ALTER TABLE historial_afiliacion
            ADD COLUMN id_usuario INT NULL,
            ADD CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario);
    END IF;
END //
DELIMITER ;
CALL sp_p3_agregar_usuario_historial();
DROP PROCEDURE sp_p3_agregar_usuario_historial;


DELIMITER //

-- ============================================================================
-- sp_afiliaciones_cliente: pantalla "Afiliación SINPE Móvil". Devuelve 3 resultados:
--   1) ficha del cliente (1 fila)
--   2) sus teléfonos con estado NO_AFILIADO | AFILIADO | AFILIADO_OTRA
--   3) sus cuentas en ESTA entidad, con los números afiliados a cada una
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_afiliaciones_cliente //
CREATE PROCEDURE sp_afiliaciones_cliente(
    IN p_id_entidad INT,
    IN p_id_cliente INT
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el cliente';
    ELSEIF NOT EXISTS (SELECT 1 FROM usuario WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad)
       AND NOT EXISTS (SELECT 1 FROM cuenta_iban WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no pertenece a esta entidad';
    END IF;

    -- 1) cliente
    SELECT c.id_cliente       AS idCliente,
           c.identificacion,
           c.nombres,
           c.primer_apellido  AS primerApellido,
           c.segundo_apellido AS segundoApellido,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS nombre,
           c.correo,
           c.estado
    FROM cliente c
    WHERE c.id_cliente = p_id_cliente;

    -- 2) teléfonos (mismas columnas que sp_listar_telefonos)
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
    JOIN cliente c                 ON c.id_cliente = t.id_cliente
    LEFT JOIN afiliacion_sinpe a   ON a.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban ci       ON ci.id_cuenta = a.id_cuenta
    LEFT JOIN entidad_financiera e ON e.id_entidad = ci.id_entidad
    WHERE t.id_cliente = p_id_cliente
    ORDER BY t.numero;

    -- 3) cuentas en esta entidad (mismas columnas que sp_listar_cuentas)
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
      AND ci.id_cliente = p_id_cliente
    ORDER BY ci.fecha_apertura, ci.id_cuenta;
END //


-- ============================================================================
-- sp_afiliar: afilia un teléfono del cliente a una cuenta CRC activa de la entidad.
--   p_id_cliente = cliente de la sesión (rol cliente) o el elegido por el admin
--   p_id_usuario = quien hace la operación (queda en el historial)
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_afiliar //
CREATE PROCEDURE sp_afiliar(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_numero VARCHAR(8),
    IN p_iban CHAR(22),
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_telefono INT;
    DECLARE v_cliente_tel INT;
    DECLARE v_id_cuenta INT;
    DECLARE v_cliente_cta INT;
    DECLARE v_entidad_cta INT;
    DECLARE v_estado VARCHAR(10);
    DECLARE v_moneda CHAR(3);
    DECLARE v_estado_cliente VARCHAR(10);
    DECLARE v_entidad_actual VARCHAR(100);
    DECLARE v_ultimo BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT id_telefono, id_cliente INTO v_id_telefono, v_cliente_tel
    FROM telefono_cliente WHERE numero = p_numero
    FOR UPDATE;

    SELECT id_cuenta, id_cliente, id_entidad, estado, moneda
      INTO v_id_cuenta, v_cliente_cta, v_entidad_cta, v_estado, v_moneda
    FROM cuenta_iban WHERE iban = p_iban
    FOR UPDATE;

    SELECT estado INTO v_estado_cliente FROM cliente WHERE id_cliente = p_id_cliente;

    -- ¿ya está afiliado? ¿dónde?
    SELECT e.nombre INTO v_entidad_actual
    FROM afiliacion_sinpe a
    JOIN cuenta_iban ci ON ci.id_cuenta = a.id_cuenta
    JOIN entidad_financiera e ON e.id_entidad = ci.id_entidad
    WHERE a.id_telefono = v_id_telefono;

    IF v_estado_cliente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el titular';
    ELSEIF v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular está inactivo';
    ELSEIF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado';
    ELSEIF v_cliente_tel <> p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no pertenece al titular';
    ELSEIF v_id_cuenta IS NULL OR v_entidad_cta <> p_id_entidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no existe en esta entidad';
    ELSEIF v_cliente_cta <> p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono y la cuenta no son del mismo titular';
    ELSEIF v_moneda <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta debe ser en colones';
    ELSEIF v_estado <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no está activa';
    ELSEIF v_entidad_actual IS NOT NULL THEN
        SET v_entidad_actual = CONCAT('El número ya está afiliado en ', v_entidad_actual);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_entidad_actual;
    END IF;

    SELECT IFNULL(MAX(id_historial), 0) INTO v_ultimo FROM historial_afiliacion;

    -- el trigger trg_auditoria_afiliacion escribe el evento AFILIACION
    INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (v_id_telefono, v_id_cuenta);

    UPDATE historial_afiliacion SET id_usuario = p_id_usuario
    WHERE id_historial > v_ultimo AND id_telefono = v_id_telefono;

    COMMIT;
    SELECT 'Teléfono afiliado' AS mensaje;
END //


-- ============================================================================
-- sp_desafiliar: quita la afiliación de un número afiliado a una cuenta de esta entidad.
--   p_id_cliente = NULL (admin: cualquier cliente de su entidad) o el de la sesión (cliente)
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_desafiliar //
CREATE PROCEDURE sp_desafiliar(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_numero VARCHAR(8),
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_telefono INT;
    DECLARE v_cliente_tel INT;
    DECLARE v_id_cuenta INT;
    DECLARE v_entidad_cta INT;
    DECLARE v_entidad_nombre VARCHAR(100);
    DECLARE v_ultimo BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT id_telefono, id_cliente INTO v_id_telefono, v_cliente_tel
    FROM telefono_cliente WHERE numero = p_numero;

    SELECT a.id_cuenta, ci.id_entidad, e.nombre
      INTO v_id_cuenta, v_entidad_cta, v_entidad_nombre
    FROM afiliacion_sinpe a
    JOIN cuenta_iban ci ON ci.id_cuenta = a.id_cuenta
    JOIN entidad_financiera e ON e.id_entidad = ci.id_entidad
    WHERE a.id_telefono = v_id_telefono
    FOR UPDATE;

    IF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado';
    ELSEIF p_id_cliente IS NOT NULL AND v_cliente_tel <> p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no pertenece al titular';
    ELSEIF v_id_cuenta IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está afiliado';
    ELSEIF v_entidad_cta <> p_id_entidad THEN
        SET v_entidad_nombre = CONCAT('El número está afiliado en ', v_entidad_nombre, ': debe desafiliarse allá');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_entidad_nombre;
    END IF;

    SELECT IFNULL(MAX(id_historial), 0) INTO v_ultimo FROM historial_afiliacion;

    -- el trigger trg_auditoria_desafiliacion escribe el evento DESAFILIACION
    DELETE FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono;

    UPDATE historial_afiliacion SET id_usuario = p_id_usuario
    WHERE id_historial > v_ultimo AND id_telefono = v_id_telefono;

    COMMIT;
    SELECT 'Teléfono desafiliado' AS mensaje;
END //


-- ============================================================================
-- sp_trasladar: mueve un número afiliado a OTRA cuenta CRC activa del mismo titular,
-- en la misma entidad. Paso 1 desafiliar + paso 2 afiliar en UNA transacción:
-- si el paso 2 falla, el ROLLBACK deja la afiliación original como estaba.
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_trasladar //
CREATE PROCEDURE sp_trasladar(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_numero VARCHAR(8),
    IN p_iban_nueva CHAR(22),
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_telefono INT;
    DECLARE v_cliente_tel INT;
    DECLARE v_cuenta_actual INT;
    DECLARE v_entidad_actual INT;
    DECLARE v_cuenta_nueva INT;
    DECLARE v_cliente_nueva INT;
    DECLARE v_entidad_nueva INT;
    DECLARE v_estado VARCHAR(10);
    DECLARE v_moneda CHAR(3);
    DECLARE v_ultimo BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT t.id_telefono, t.id_cliente, a.id_cuenta, ci.id_entidad
      INTO v_id_telefono, v_cliente_tel, v_cuenta_actual, v_entidad_actual
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban ci     ON ci.id_cuenta = a.id_cuenta
    WHERE t.numero = p_numero
    FOR UPDATE;

    SELECT id_cuenta, id_cliente, id_entidad, estado, moneda
      INTO v_cuenta_nueva, v_cliente_nueva, v_entidad_nueva, v_estado, v_moneda
    FROM cuenta_iban WHERE iban = p_iban_nueva
    FOR UPDATE;

    IF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está registrado';
    ELSEIF p_id_cliente IS NOT NULL AND v_cliente_tel <> p_id_cliente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no pertenece al titular';
    ELSEIF v_cuenta_actual IS NULL OR v_entidad_actual <> p_id_entidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono no está afiliado en esta entidad';
    ELSEIF v_cuenta_nueva IS NULL OR v_entidad_nueva <> p_id_entidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta nueva no existe en esta entidad';
    ELSEIF v_cuenta_nueva = v_cuenta_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono ya está en esa cuenta';
    END IF;

    SELECT IFNULL(MAX(id_historial), 0) INTO v_ultimo FROM historial_afiliacion;

    -- paso 1: desafiliar (trigger -> DESAFILIACION)
    DELETE FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono;

    -- paso 2: validar la cuenta nueva; si algo falla se revierte también el paso 1
    IF v_cliente_nueva <> v_cliente_tel THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El teléfono y la cuenta no son del mismo titular';
    ELSEIF v_moneda <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta debe ser en colones';
    ELSEIF v_estado <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no está activa';
    END IF;

    -- paso 2: afiliar a la cuenta nueva (trigger -> AFILIACION)
    INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (v_id_telefono, v_cuenta_nueva);

    UPDATE historial_afiliacion SET id_usuario = p_id_usuario
    WHERE id_historial > v_ultimo AND id_telefono = v_id_telefono;

    COMMIT;
    SELECT 'Afiliación trasladada' AS mensaje;
END //


-- ============================================================================
-- sp_historial_afiliacion: eventos de la entidad, más recientes primero.
--   p_id_cliente = NULL -> toda la entidad (admin); un id -> solo ese cliente
--   usuario: nombre de quien lo hizo ('Sistema' si no se sabe)
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_historial_afiliacion //
CREATE PROCEDURE sp_historial_afiliacion(
    IN p_id_entidad INT,
    IN p_id_cliente INT
)
BEGIN
    SELECT h.id_historial AS idHistorial,
           DATE_FORMAT(h.fecha_evento, '%Y-%m-%dT%H:%i:%s') AS fechaEvento,
           h.accion,
           t.numero,
           ci.iban,
           c.id_cliente AS idCliente,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS titular,
           CASE
               WHEN u.id_usuario IS NULL THEN 'Sistema'
               WHEN u.rol = 'admin' THEN u.usuario
               ELSE CONCAT(uc.nombres, ' ', uc.primer_apellido, ' (cliente)')
           END AS usuario
    FROM historial_afiliacion h
    JOIN telefono_cliente t ON t.id_telefono = h.id_telefono
    JOIN cuenta_iban ci     ON ci.id_cuenta = h.id_cuenta
    JOIN cliente c          ON c.id_cliente = ci.id_cliente
    LEFT JOIN usuario u     ON u.id_usuario = h.id_usuario
    LEFT JOIN cliente uc    ON uc.id_cliente = u.id_cliente
    WHERE ci.id_entidad = p_id_entidad
      AND (p_id_cliente IS NULL OR c.id_cliente = p_id_cliente)
    ORDER BY h.fecha_evento DESC, h.id_historial DESC;
END //

DELIMITER ;


-- ----------------------------------------------------------------------------
-- Pruebas (BAC = entidad 4; cliente.demo = Camila, id_cliente 16, cuenta 16 = CR...016)
-- ----------------------------------------------------------------------------
-- CALL sp_afiliaciones_cliente(4, 16);
-- CALL sp_historial_afiliacion(4, NULL);
-- CALL sp_afiliar(4, 16, '70000016', 'CR00000000000000000016', 2);       -- OK
-- CALL sp_desafiliar(4, 16, '70000016', 2);                              -- OK
-- CALL sp_afiliar(4, 16, '80000001', 'CR00000000000000000016', 2);       -- ERROR: no es del titular
-- CALL sp_afiliar(4, 6, '70000006', 'CR00000000000000000027', 1);        -- ERROR: cuenta en dólares
-- CALL sp_desafiliar(4, NULL, '80000001', 1);                            -- ERROR: afiliado en BCR
-- CALL sp_trasladar(4, NULL, '80000016', 'CR00000000000000000016', 1);   -- ERROR: ya está en esa cuenta
