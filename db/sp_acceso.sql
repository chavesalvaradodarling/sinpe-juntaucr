-- Persona 1: procedimientos de acceso
USE sinpe_movil;
DELIMITER //

-- sp_login: busca al usuario DENTRO de la entidad elegida y devuelve su ficha.
-- La contraseña NO se revisa aquí: Node la compara con bcrypt contra el hash que se devuelve.
DROP PROCEDURE IF EXISTS sp_login //
CREATE PROCEDURE sp_login(
    IN p_id_entidad INT,
    IN p_usuario VARCHAR(50)
)
BEGIN
    DECLARE v_id_usuario INT;
    DECLARE v_estado VARCHAR(10);

    -- 1. Buscar el usuario solo en esa entidad (login filtra por entidad)
    SELECT u.id_usuario, c.estado
    INTO v_id_usuario, v_estado
    FROM usuario u
    LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
    WHERE u.id_entidad = p_id_entidad
      AND u.usuario = p_usuario;

    -- 2. Rechazos
    IF v_id_usuario IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario o contraseña incorrectos';
    ELSEIF v_estado = 'INACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente está inactivo. Comuníquese con su entidad';
    END IF;

    -- 3. Devolver la ficha (el admin no tiene cliente: su nombre es el usuario)
    SELECT u.id_usuario  AS idUsuario,
           u.id_cliente  AS idCliente,
           u.rol,
           u.id_entidad  AS idEntidad,
           e.nombre      AS entidad,
           e.codigo,
           IFNULL(CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido), u.usuario) AS nombre,
           c.identificacion,
           u.contrasena
    FROM usuario u
    JOIN entidad_financiera e ON e.id_entidad = u.id_entidad
    LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
    WHERE u.id_usuario = v_id_usuario;
END //

DELIMITER ;

-- Pruebas
CALL sp_login(4, 'cliente.demo');                 -- devuelve a Camila (cliente)
CALL sp_login(4, 'admin.demo');                   -- devuelve al administrador
-- CALL sp_login(1, 'cliente.demo');              -- ERROR: existe, pero no en el BCR
-- CALL sp_login(4, 'nadie');                     -- ERROR: no existe

DELIMITER //

-- sp_listar_clientes: clientes de UNA entidad (los que tienen usuario o cuenta en ella)
DROP PROCEDURE IF EXISTS sp_listar_clientes //
CREATE PROCEDURE sp_listar_clientes(
    IN p_id_entidad INT
)
BEGIN
    SELECT c.id_cliente       AS idCliente,
           c.identificacion,
           c.nombres,
           c.primer_apellido  AS primerApellido,
           c.segundo_apellido AS segundoApellido,
           CONCAT(c.nombres, ' ', c.primer_apellido, ' ', c.segundo_apellido) AS nombre,
           c.correo,
           c.fecha_registro   AS fechaRegistro,
           c.estado,
           (SELECT COUNT(*) FROM cuenta_iban ci
             WHERE ci.id_cliente = c.id_cliente AND ci.id_entidad = p_id_entidad) AS cuentas,
           (SELECT GROUP_CONCAT(t.numero ORDER BY t.numero) FROM telefono_cliente t
             WHERE t.id_cliente = c.id_cliente) AS telefonos
    FROM cliente c
    WHERE EXISTS (SELECT 1 FROM usuario u WHERE u.id_cliente = c.id_cliente AND u.id_entidad = p_id_entidad)
       OR EXISTS (SELECT 1 FROM cuenta_iban ci WHERE ci.id_cliente = c.id_cliente AND ci.id_entidad = p_id_entidad)
    ORDER BY c.nombres, c.primer_apellido;
END //

-- sp_registrar_cliente: crea el cliente y su usuario en la entidad del administrador.
-- La contraseña temporal llega YA cifrada (bcrypt se hace en Node).
DROP PROCEDURE IF EXISTS sp_registrar_cliente //
CREATE PROCEDURE sp_registrar_cliente(
    IN p_id_entidad INT,
    IN p_identificacion VARCHAR(20),
    IN p_nombres VARCHAR(80),
    IN p_primer_apellido VARCHAR(60),
    IN p_segundo_apellido VARCHAR(60),
    IN p_correo VARCHAR(120),
    IN p_usuario VARCHAR(50),
    IN p_contrasena VARCHAR(60)
)
BEGIN
    DECLARE v_id_cliente INT;
    DECLARE v_usuario VARCHAR(50);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    IF EXISTS (SELECT 1 FROM cliente WHERE identificacion = p_identificacion) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un cliente con esa identificación';
    ELSEIF EXISTS (SELECT 1 FROM cliente WHERE correo = p_correo) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un cliente con ese correo';
    END IF;

    INSERT INTO cliente (identificacion, nombres, primer_apellido, segundo_apellido, correo)
    VALUES (p_identificacion, p_nombres, p_primer_apellido, p_segundo_apellido, p_correo);
    SET v_id_cliente = LAST_INSERT_ID();

    -- si el usuario ya existe en esa entidad, se le agrega el número de cliente (ana.mora25)
    SET v_usuario = p_usuario;
    IF EXISTS (SELECT 1 FROM usuario WHERE id_entidad = p_id_entidad AND usuario = v_usuario) THEN
        SET v_usuario = CONCAT(p_usuario, v_id_cliente);
    END IF;

    INSERT INTO usuario (id_entidad, usuario, contrasena, rol, id_cliente)
    VALUES (p_id_entidad, v_usuario, p_contrasena, 'cliente', v_id_cliente);

    COMMIT;
    SELECT v_id_cliente AS idCliente, v_usuario AS usuario;
END //

-- sp_editar_cliente: lo usan "Clientes" (admin, puede cambiar estado) y "Mis datos"
-- (cliente, p_estado = NULL: no cambia su propio estado). Solo clientes de esa entidad.
DROP PROCEDURE IF EXISTS sp_editar_cliente //
CREATE PROCEDURE sp_editar_cliente(
    IN p_id_entidad INT,
    IN p_id_cliente INT,
    IN p_nombres VARCHAR(80),
    IN p_primer_apellido VARCHAR(60),
    IN p_segundo_apellido VARCHAR(60),
    IN p_correo VARCHAR(120),
    IN p_estado VARCHAR(10)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM usuario WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad)
       AND NOT EXISTS (SELECT 1 FROM cuenta_iban WHERE id_cliente = p_id_cliente AND id_entidad = p_id_entidad) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no pertenece a esta entidad';
    ELSEIF EXISTS (SELECT 1 FROM cliente WHERE correo = p_correo AND id_cliente <> p_id_cliente) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un cliente con ese correo';
    ELSEIF p_estado IS NOT NULL AND p_estado NOT IN ('ACTIVO', 'INACTIVO') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estado no válido';
    END IF;

    UPDATE cliente
    SET nombres = p_nombres,
        primer_apellido = p_primer_apellido,
        segundo_apellido = p_segundo_apellido,
        correo = p_correo,
        estado = IFNULL(p_estado, estado)
    WHERE id_cliente = p_id_cliente;

    COMMIT;
    SELECT 'Datos actualizados' AS mensaje;
END //

DELIMITER ;

-- Pruebas (cliente 16 = Camila, entidad 4 = BAC)
CALL sp_listar_clientes(4);
-- CALL sp_registrar_cliente(4, 'UCR000016', 'X', 'Y', 'Z', 'x@correo.cr', 'x.y', 'hash');  -- ERROR: identificación repetida
-- CALL sp_editar_cliente(1, 16, 'Camila', 'Mora', 'Villalobos', 'c@correo.cr', NULL);       -- ERROR: no es del BCR