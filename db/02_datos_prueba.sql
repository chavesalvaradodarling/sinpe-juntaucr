-- Persona 1: usuarios de prueba (contraseña de los dos: prueba123)
USE sinpe_movil;

INSERT INTO usuario (id_entidad, usuario, contrasena, rol, id_cliente) VALUES
    (4, 'admin.demo',   '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'admin',   NULL),
    (4, 'cliente.demo', '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'cliente', 16);
    
   
INSERT INTO usuario (id_entidad, usuario, contrasena, rol, id_cliente) VALUES
    (1, 'admin.demo', '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'admin', NULL),
    (2, 'admin.demo', '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'admin', NULL),
    (3, 'admin.demo', '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'admin', NULL),
    (5, 'admin.demo', '$2b$10$hlGR4wEyb24pYWNpSDJh8e3Lg95TkCmXX/CXsl95JtVt/L48.Q36W', 'admin', NULL);
    
    
    SELECT * FROM usuario;