-- Persona 1: usuarios de prueba (contraseña de TODOS: prueba123)
-- Se corre UNA vez, después de 01_schema.sql (que crea la base desde cero).
-- admin.demo existe en cada entidad: el banco se elige en el combo del login.
USE sinpe_movil;

SET @clave = '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W';

-- Lola: clienta del Banco JUNTAUCR (id 5), con cuenta y número afiliado
INSERT INTO cliente (identificacion, nombres, primer_apellido, segundo_apellido, correo)
VALUES ('5-5555-5555', 'Lola', 'Vargas', 'Rojas', 'lola@correo.cr');
SET @lola = LAST_INSERT_ID();

INSERT INTO cuenta_iban (id_cliente, id_entidad, moneda, iban, saldo, estado, fecha_apertura)
VALUES (@lola, 5, 'CRC', 'CR00000000000000000500', 50000.00, 'ACTIVA', CURDATE());
SET @cuenta_lola = LAST_INSERT_ID();

INSERT INTO telefono_cliente (id_cliente, numero) VALUES (@lola, '63334444');
INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (LAST_INSERT_ID(), @cuenta_lola);

-- Usuarios
INSERT INTO usuario (id_entidad, usuario, contrasena, rol, id_cliente) VALUES
    -- un administrador por entidad
    (1, 'admin.demo',   @clave, 'admin',   NULL),   -- Banco de Costa Rica
    (2, 'admin.demo',   @clave, 'admin',   NULL),   -- Banco Nacional
    (3, 'admin.demo',   @clave, 'admin',   NULL),   -- Banco Popular
    (4, 'admin.demo',   @clave, 'admin',   NULL),   -- BAC Credomatic
    (5, 'admin.demo',   @clave, 'admin',   NULL),   -- Banco JUNTAUCR
    -- clientes (del script del lab, con cuenta y número afiliado en ese banco)
    (1, 'cliente.bcr',  @clave, 'cliente', 1),      -- Leonardo Aguilar · 8000-0001
    (2, 'cliente.bn',   @clave, 'cliente', 2),      -- Iván Altamirano  · 8000-0002
    (3, 'cliente.bp',   @clave, 'cliente', 3),      -- Hugo Arauz       · 8000-0003
    (4, 'cliente.demo', @clave, 'cliente', 16),     -- Camila Mora      · 8000-0016
    (4, 'hairon.demo',  @clave, 'cliente', 4),      -- Hairon Azofeifa  · 8000-0004
    (5, 'lola.vargas',  @clave, 'cliente', @lola);  -- Lola Vargas      · 6333-4444

-- Revisión
SELECT e.nombre AS banco, u.usuario, u.rol,
       IFNULL(CONCAT(c.nombres, ' ', c.primer_apellido), '(administrador)') AS persona
FROM usuario u
JOIN entidad_financiera e ON e.id_entidad = u.id_entidad
LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
ORDER BY u.id_entidad, u.rol, u.usuario;