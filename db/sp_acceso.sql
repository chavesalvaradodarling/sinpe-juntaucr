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
CALL sp_login(4, 'cliente.demo');                
CALL sp_login(4, 'admin.demo');                   
-- CALL sp_login(1, 'cliente.demo');              
-- CALL sp_login(4, 'nadie');                  