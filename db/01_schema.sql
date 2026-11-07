DROP DATABASE IF EXISTS sinpe_movil;
CREATE DATABASE sinpe_movil CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sinpe_movil;
-- Camila y Darling
CREATE TABLE cliente (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    identificacion VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(80) NOT NULL,
    primer_apellido VARCHAR(60) NOT NULL,
    segundo_apellido VARCHAR(60) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO'
);
 

 
 
CREATE TABLE entidad_financiera (
    id_entidad INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(12) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- usuario: quien puede entrar a la app (login por entidad)
CREATE TABLE usuario (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    id_entidad INT NOT NULL,
    usuario VARCHAR(50) NOT NULL,
    contrasena VARCHAR(60) NOT NULL,                 -- hash bcrypt (siempre 60 caracteres)
    rol ENUM('cliente', 'admin') NOT NULL,
    id_cliente INT NULL,                             -- NULL para el administrador
    CONSTRAINT uq_usuario_entidad UNIQUE (id_entidad, usuario),
    CONSTRAINT fk_usuario_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente (id_cliente),
    CONSTRAINT fk_usuario_entidad FOREIGN KEY (id_entidad)
        REFERENCES entidad_financiera (id_entidad)
);
 
CREATE TABLE cuenta_iban (
    id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_entidad INT NOT NULL,
   moneda CHAR(3) NOT NULL,                      
    iban CHAR(22) NOT NULL UNIQUE,
    saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
    estado ENUM('ACTIVA','INACTIVA','BLOQUEADA') NOT NULL DEFAULT 'ACTIVA',
    fecha_apertura DATE NOT NULL,
     CONSTRAINT chk_cuenta_saldo CHECK (saldo >= 0),                
    CONSTRAINT chk_cuenta_iban_largo CHECK (CHAR_LENGTH(iban) = 22),
    CONSTRAINT fk_cuenta_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    CONSTRAINT fk_cuenta_entidad FOREIGN KEY (id_entidad) REFERENCES entidad_financiera(id_entidad)
);
 
CREATE TABLE telefono_cliente (
    id_telefono INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    numero VARCHAR(8) NOT NULL  UNIQUE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_telefono_formato CHECK (numero REGEXP '^[0-9]{8}$'),
    CONSTRAINT fk_telefono_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);
 
CREATE TABLE afiliacion_sinpe (
    id_afiliacion INT AUTO_INCREMENT PRIMARY KEY,
    id_telefono INT NOT NULL UNIQUE,
    id_cuenta INT NOT NULL,
    fecha_afiliacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_afiliacion_telefono FOREIGN KEY (id_telefono) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_afiliacion_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta_iban(id_cuenta)
);
 
CREATE TABLE historial_afiliacion (
    id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_telefono INT NOT NULL,
    id_cuenta INT NOT NULL,
    accion ENUM('AFILIACION','DESAFILIACION') NOT NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historial_telefono FOREIGN KEY (id_telefono) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_historial_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta_iban(id_cuenta)
);
 
CREATE TABLE transferencia (
    id_transferencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_cuenta_origen INT NOT NULL,
    id_cuenta_destino INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    tipo ENUM('SINPE_MOVIL','IBAN') NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transferencia_origen FOREIGN KEY (id_cuenta_origen) REFERENCES cuenta_iban(id_cuenta),
    CONSTRAINT fk_transferencia_destino FOREIGN KEY (id_cuenta_destino) REFERENCES cuenta_iban(id_cuenta)
);
 
CREATE TABLE transferencia_sinpe (
    id_transferencia BIGINT PRIMARY KEY,
    id_telefono_origen INT NOT NULL,
    id_telefono_destino INT NOT NULL,
    CONSTRAINT fk_ts_transferencia FOREIGN KEY (id_transferencia) REFERENCES transferencia(id_transferencia),
    CONSTRAINT fk_ts_telefono_origen FOREIGN KEY (id_telefono_origen) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_ts_telefono_destino FOREIGN KEY (id_telefono_destino) REFERENCES telefono_cliente(id_telefono)
);
 
    CREATE TABLE moneda (
    codigo CHAR(3) PRIMARY KEY,
    descripcion VARCHAR(40) NOT NULL UNIQUE
);
 
-- tipo_cambio: queda creada (documento de ideas); el IBAN entre monedas se rechaza por ahora (regla 8)
CREATE TABLE tipo_cambio (
    id_tipo_cambio INT AUTO_INCREMENT PRIMARY KEY,
    moneda_origen CHAR(3) NOT NULL,
    moneda_destino CHAR(3) NOT NULL,
    tasa DECIMAL(15,4) NOT NULL,
    fecha DATE NOT NULL,
    CONSTRAINT chk_tipo_cambio_tasa CHECK (tasa > 0),
    CONSTRAINT uq_tipo_cambio UNIQUE (moneda_origen, moneda_destino, fecha),
    CONSTRAINT fk_tc_origen FOREIGN KEY (moneda_origen) REFERENCES moneda(codigo),
    CONSTRAINT fk_tc_destino FOREIGN KEY (moneda_destino) REFERENCES moneda(codigo)
);

-- CATALOGO DE MONEDAS
INSERT INTO moneda (codigo, descripcion) VALUES
    ('CRC','Colon costarricense'),
    ('USD','Dolar estadounidense');
 
-- CATALOGO DE ENTIDADES FINANCIERAS
INSERT INTO entidad_financiera (codigo,nombre) 
	VALUES ('BCR','Banco de Costa Rica'),
    ('BN','Banco Nacional de Costa Rica'),
    ('BP','Banco Popular y de Desarrollo Comunal'),
    ('BAC','BAC Credomatic'),
    ('JUNTAUCR','Banco JUNTAUCR');   -- id 5: el banco de la app (al final para no mover los id 1-4)
    
 
 
-- CLIENTES: 24 
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000001','LEONARDO ANTONIO','AGUILAR','BERROCAL','leonardo.aguilar.berrocal@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000002','IVAN CALET','ALTAMIRANO','ABARCA','ivan.altamirano.abarca@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000003','HUGO ARIEL','ARAUZ','MAROTO','hugo.arauz.maroto@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000004','HAIRON DANIEL','AZOFEIFA','SANCHEZ','hairon.azofeifa.sanchez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000005','CRISTOPHER EDUARDO','BUSO','BOLAÑOS','cristopher.buso.bolanos@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000006','KEITY DAYANA','CHAVARRIA','STELLER','keity.chavarria.steller@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000007','DARLIN PATRICIA','CHAVES','ALVARADO','darlin.chaves.alvarado@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000008','MARIELA CAROLINA','CHINCHILLA','GONZALEZ','mariela.chinchilla.gonzalez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000009','DILAN JAVIER','GONZALEZ','BADILLA','dilan.gonzalez.badilla@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000010','REIKO JISLEN','GONZALEZ','PORTUGUEZ','reiko.gonzalez.portuguez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000011','JEFFERSON DAVID','GRANADOS','VENEGAS','jefferson.granados.venegas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000012','HUGO JOSE','GURDIAN','SOLORZANO','hugo.gurdian.solorzano@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000013','JOHN LEANDRO','MARIN','SALAS','john.marin.salas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000014','KENDALL NAUM','MONTERO','CORTES','kendall.montero.cortes@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000015','CRISTOPHER','MORA','SALAS','cristopher.mora.salas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000016','CAMILA NAHOMI','MORA','VILLALOBOS','camila.mora.villalobos@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000017','JANDANY','MOYA','GARCIA','jandany.moya.garcia@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000018','ASTRID VALESKA','MUNGUIA','ROJAS','astrid.munguia.rojas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000019','LUCIA MARGARITA','PALACIO','AYERDIS','lucia.palacio.ayerdis@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000020','DIEGO','PASTRAN','MEDINA','diego.pastran.medina@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000021','STEVEN GABRIEL','RAMIREZ','PALACIOS','steven.ramirez.palacios@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000022','SCARLETTE YALENA','ROSALES','PEREZ','scarlette.rosales.perez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000023','BAYRON AXEL','SANCHEZ','CONCEPCION','bayron.sanchez.concepcion@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000024','DIEGO ARANTES','SANCHEZ','LEZAMA','diego.sanchez.lezama@ucr.ac.cr','ACTIVO');
 
-- CUENTAS: cada cliente tiene una cuenta CRC; algunos tienen una segunda cuenta
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (1,1,'CRC','CR00000000000000000001',123991.00,'ACTIVA','2026-01-02');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (2,2,'CRC','CR00000000000000000002',197982.00,'ACTIVA','2026-01-03');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (3,3,'CRC','CR00000000000000000003',271973.00,'ACTIVA','2026-01-04');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (4,4,'CRC','CR00000000000000000004',345964.00,'ACTIVA','2026-01-05');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (5,1,'CRC','CR00000000000000000005',419955.00,'ACTIVA','2026-01-06');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (6,2,'CRC','CR00000000000000000006',493946.00,'ACTIVA','2026-01-07');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (7,3,'CRC','CR00000000000000000007',567937.00,'ACTIVA','2026-01-08');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (8,4,'CRC','CR00000000000000000008',641928.00,'ACTIVA','2026-01-09');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (9,1,'CRC','CR00000000000000000009',715919.00,'ACTIVA','2026-01-10');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (10,2,'CRC','CR00000000000000000010',789910.00,'ACTIVA','2026-01-11');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (11,3,'CRC','CR00000000000000000011',63901.00,'ACTIVA','2026-01-12');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (12,4,'CRC','CR00000000000000000012',137892.00,'ACTIVA','2026-01-13');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (13,1,'CRC','CR00000000000000000013',211883.00,'ACTIVA','2026-01-14');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (14,2,'CRC','CR00000000000000000014',285874.00,'ACTIVA','2026-01-15');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (15,3,'CRC','CR00000000000000000015',359865.00,'ACTIVA','2026-01-16');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (16,4,'CRC','CR00000000000000000016',433856.00,'ACTIVA','2026-01-17');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (17,1,'CRC','CR00000000000000000017',507847.00,'ACTIVA','2026-01-18');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (18,2,'CRC','CR00000000000000000018',581838.00,'ACTIVA','2026-01-19');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (19,3,'CRC','CR00000000000000000019',655829.00,'ACTIVA','2026-01-20');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (20,4,'CRC','CR00000000000000000020',729820.00,'ACTIVA','2026-01-21');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (21,1,'CRC','CR00000000000000000021',803811.00,'ACTIVA','2026-01-22');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (22,2,'CRC','CR00000000000000000022',77802.00,'ACTIVA','2026-01-23');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (23,3,'CRC','CR00000000000000000023',151793.00,'ACTIVA','2026-01-24');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (24,4,'CRC','CR00000000000000000024',225784.00,'ACTIVA','2026-01-25');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (1,3,'USD','CR00000000000000000025',377.00,'ACTIVA','2026-01-26');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (3,1,'USD','CR00000000000000000026',631.00,'ACTIVA','2026-01-27');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (6,4,'USD','CR00000000000000000027',1012.00,'ACTIVA','2026-01-28');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (9,3,'USD','CR00000000000000000028',1393.00,'ACTIVA','2026-01-01');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (12,2,'USD','CR00000000000000000029',1774.00,'ACTIVA','2026-01-02');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (15,1,'USD','CR00000000000000000030',2155.00,'ACTIVA','2026-01-03');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (18,4,'USD','CR00000000000000000031',2536.00,'ACTIVA','2026-01-04');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (21,3,'USD','CR00000000000000000032',2917.00,'ACTIVA','2026-01-05');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (2,1,'CRC','CR00000000000000000033',45806.00,'ACTIVA','2026-01-06');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (7,2,'CRC','CR00000000000000000034',135321.00,'BLOQUEADA','2026-01-07');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (14,1,'CRC','CR00000000000000000035',40642.00,'ACTIVA','2026-01-08');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (22,1,'CRC','CR00000000000000000036',183866.00,'ACTIVA','2026-01-09');
 
 
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (1,'80000001');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (2,'80000002');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (3,'80000003');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (4,'80000004');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (5,'80000005');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (6,'80000006');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (7,'80000007');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (8,'80000008');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (9,'80000009');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (10,'80000010');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (11,'80000011');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (12,'80000012');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (13,'80000013');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (14,'80000014');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (15,'80000015');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (16,'80000016');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (17,'80000017');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (18,'80000018');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (19,'80000019');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (20,'80000020');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (21,'80000021');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (22,'80000022');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (23,'80000023');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (24,'80000024');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (1,'70000001');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (2,'70000002');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (3,'70000003');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (5,'70000005');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (6,'70000006');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (8,'70000008');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (10,'70000010');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (12,'70000012');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (14,'70000014');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (16,'70000016');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (18,'70000018');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (20,'70000020');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (22,'70000022');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (24,'70000024');
 
-- AFILIACIONES INICIALES: solo telefonos del titular hacia su cuenta CRC activa
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (1,1);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (2,2);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (3,3);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (4,4);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (5,5);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (6,6);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (7,7);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (8,8);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (9,9);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (10,10);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (11,11);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (12,12);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (13,13);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (14,14);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (15,15);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (16,16);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (17,17);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (18,18);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (19,19);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (25,1);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (27,3);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (29,6);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (31,10);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (33,14);
 
 

-- Las pruebas marcadas "ERROR" quedan comentadas: si se ejecutan, MySQL detiene el script.
-- Para probarlas, quite el "-- " y ejecute solo esa linea.

-- PRIMER PROCIMOIENTO ------------------------------------------------------------------------
 
-- sp_registrar_cuenta: crear cuenta y validar titular, entidad, moneda e IBAN
DELIMITER //
CREATE PROCEDURE sp_registrar_cuenta(
    IN p_id_cliente INT,
    IN p_id_entidad INT,
    IN p_moneda CHAR(3),
    IN p_iban CHAR(22),
    IN p_saldo DECIMAL(15,2),
    IN p_fecha_apertura DATE
)
BEGIN
    DECLARE v_estado_cliente VARCHAR(10);
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    SELECT estado INTO v_estado_cliente
    FROM cliente
    WHERE id_cliente = p_id_cliente;
 
    IF v_estado_cliente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el titular';
    ELSEIF v_estado_cliente <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El titular esta inactivo';
    ELSEIF NOT EXISTS (SELECT 1 FROM entidad_financiera WHERE id_entidad = p_id_entidad) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe la entidad financiera';
    ELSEIF NOT EXISTS (SELECT 1 FROM moneda WHERE codigo = p_moneda) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La moneda no existe';
    ELSEIF CHAR_LENGTH(p_iban) <> 22 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN debe tener 22 caracteres';
    ELSEIF EXISTS (SELECT 1 FROM cuenta_iban WHERE iban = p_iban) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El IBAN ya existe';
    ELSEIF p_saldo < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El saldo no puede ser negativo';
    END IF;
 
    INSERT INTO cuenta_iban (id_cliente, id_entidad, moneda, iban, saldo, estado, fecha_apertura)
    VALUES (p_id_cliente, p_id_entidad, p_moneda, p_iban, p_saldo, 'ACTIVA', p_fecha_apertura);
 
    COMMIT;
    SELECT 'Cuenta registrada' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_registrar_cuenta
CALL sp_registrar_cuenta(2, 1, 'CRC', 'CR00000000000000000037', 50000, CURDATE());
SELECT * FROM cuenta_iban WHERE iban = 'CR00000000000000000037';
-- CALL sp_registrar_cuenta(1, 1, 'CRC', 'CR00000000000000000001', 1000, CURDATE());  -- ERROR: IBAN ya existe
-- CALL sp_registrar_cuenta(1, 1, 'EUR', 'CR00000000000000000099', 1000, CURDATE());  -- ERROR: moneda no existe
-- CALL sp_registrar_cuenta(1, 1, 'CRC', 'CR123', 1000, CURDATE());                   -- ERROR: IBAN de 22 caracteres
-- CALL sp_registrar_cuenta(99, 1, 'CRC', 'CR00000000000000000099', 1000, CURDATE()); -- ERROR: no existe el titular
 
 
 
-- sp_registrar_telefono: registrar un telefono para un titular sin duplicados
DELIMITER //
CREATE PROCEDURE sp_registrar_telefono(
    IN p_id_cliente INT,
    IN p_numero VARCHAR(8)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = p_id_cliente) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el titular';
    ELSEIF p_numero NOT REGEXP '^[0-9]{8}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono debe tener 8 digitos';
    ELSEIF EXISTS (SELECT 1 FROM telefono_cliente WHERE numero = p_numero) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono ya esta registrado';
    END IF;
 
    INSERT INTO telefono_cliente (id_cliente, numero)
    VALUES (p_id_cliente, p_numero);
 
    COMMIT;
    SELECT 'Telefono registrado' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_registrar_telefono
CALL sp_registrar_telefono(20, '60000020');
SELECT * FROM telefono_cliente WHERE numero = '60000020';
-- CALL sp_registrar_telefono(1, '80000001');   -- ERROR: telefono ya registrado
-- CALL sp_registrar_telefono(1, '8000001');    -- ERROR: 7 digitos
 
 
 
-- sp_afiliar_sinpe: validar titularidad, CRC, estado y afiliacion unica
DELIMITER //
CREATE PROCEDURE sp_afiliar_sinpe(
    IN p_numero VARCHAR(8),
    IN p_iban CHAR(22)
)
BEGIN
    DECLARE v_id_telefono INT;
    DECLARE v_cliente_tel INT;
    DECLARE v_id_cuenta INT;
    DECLARE v_cliente_cta INT;
    DECLARE v_estado VARCHAR(10);
    DECLARE v_moneda CHAR(3);
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    SELECT id_telefono, id_cliente INTO v_id_telefono, v_cliente_tel
    FROM telefono_cliente
    WHERE numero = p_numero;
 
    SELECT id_cuenta, id_cliente, estado, moneda INTO v_id_cuenta, v_cliente_cta, v_estado, v_moneda
    FROM cuenta_iban
    WHERE iban = p_iban;
 
    IF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono no esta registrado';
    ELSEIF v_id_cuenta IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no existe';
    ELSEIF EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono ya esta afiliado';
    ELSEIF v_cliente_tel <> v_cliente_cta THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono y la cuenta no son del mismo titular';
    ELSEIF v_estado <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no esta activa';
    ELSEIF v_moneda <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta debe ser en colones';
    END IF;
 
    INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta)
    VALUES (v_id_telefono, v_id_cuenta);
 
    COMMIT;
    SELECT 'Telefono afiliado' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_afiliar_sinpe
CALL sp_afiliar_sinpe('70000005', 'CR00000000000000000005');
SELECT * FROM afiliacion_sinpe WHERE id_telefono = 28;
-- CALL sp_afiliar_sinpe('80000001', 'CR00000000000000000001');  -- ERROR: ya afiliado
-- CALL sp_afiliar_sinpe('80000020', 'CR00000000000000000021');  -- ERROR: otro titular
-- CALL sp_afiliar_sinpe('70000008', 'CR00000000000000000025');  -- ERROR: otro titular (cuenta USD del cliente 1)
 
 
 
-- sp_desafiliar_sinpe: eliminar afiliacion vigente y conservar auditoria
DELIMITER //
CREATE PROCEDURE sp_desafiliar_sinpe(
    IN p_numero VARCHAR(8)
)
BEGIN
    DECLARE v_id_telefono INT;
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    SELECT id_telefono INTO v_id_telefono
    FROM telefono_cliente
    WHERE numero = p_numero;
 
    IF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono no esta registrado';
    ELSEIF NOT EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono no esta afiliado';
    END IF;
 
    DELETE FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono;
 
    COMMIT;
    SELECT 'Telefono desafiliado' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_desafiliar_sinpe
CALL sp_desafiliar_sinpe('80000019');
SELECT * FROM afiliacion_sinpe WHERE id_telefono = 19;   -- ya no aparece
-- CALL sp_desafiliar_sinpe('80000020');  -- ERROR: no esta afiliado
 
 
 
-- sp_cambiar_cuenta_sinpe: trasladar afiliacion con transaccion y recuperacion
DELIMITER //
CREATE PROCEDURE sp_cambiar_cuenta_sinpe(
    IN p_numero VARCHAR(8),
    IN p_iban_nueva CHAR(22)
)
BEGIN
    DECLARE v_id_telefono INT;
    DECLARE v_cuenta_actual INT;
    DECLARE v_cuenta_nueva INT;
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    SELECT t.id_telefono, a.id_cuenta INTO v_id_telefono, v_cuenta_actual
    FROM telefono_cliente t
    JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    WHERE t.numero = p_numero;
 
    SELECT id_cuenta INTO v_cuenta_nueva
    FROM cuenta_iban
    WHERE iban = p_iban_nueva;
 
    IF v_id_telefono IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono no esta afiliado';
    ELSEIF v_cuenta_nueva IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta nueva no existe';
    ELSEIF v_cuenta_nueva = v_cuenta_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono ya esta en esa cuenta';
    END IF;
 
    -- paso 1
    DELETE FROM afiliacion_sinpe WHERE id_telefono = v_id_telefono;
 
    -- paso 2
    INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta)
    VALUES (v_id_telefono, v_cuenta_nueva);
 
    COMMIT;
    SELECT 'Afiliacion trasladada' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_cambiar_cuenta_sinpe
CALL sp_cambiar_cuenta_sinpe('70000014', 'CR00000000000000000035');
SELECT * FROM afiliacion_sinpe WHERE id_telefono = 33;   -- ahora en la cuenta 35
-- CALL sp_cambiar_cuenta_sinpe('70000014', 'CR00000000000000000035');  -- ERROR: ya esta en esa cuenta
-- CALL sp_cambiar_cuenta_sinpe('80000020', 'CR00000000000000000020');  -- ERROR: no esta afiliado
 
 
 
-- sp_transferir_sinpe: transferir por telefonos con bloqueos, validacion y registro
DELIMITER //
CREATE PROCEDURE sp_transferir_sinpe(
    IN p_tel_origen VARCHAR(8),
    IN p_tel_destino VARCHAR(8),
    IN p_monto DECIMAL(15,2)
)
BEGIN
    DECLARE v_id_tel_origen INT;
    DECLARE v_id_tel_destino INT;
    DECLARE v_cuenta_origen INT;
    DECLARE v_cuenta_destino INT;
    DECLARE v_estado_origen VARCHAR(10);
    DECLARE v_estado_destino VARCHAR(10);
    DECLARE v_moneda_origen CHAR(3);
    DECLARE v_moneda_destino CHAR(3);
    DECLARE v_saldo_origen DECIMAL(15,2);
    DECLARE v_id_transferencia BIGINT;
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    -- buscar la cuenta afiliada a cada telefono
    SELECT t.id_telefono, a.id_cuenta INTO v_id_tel_origen, v_cuenta_origen
    FROM telefono_cliente t
    JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    WHERE t.numero = p_tel_origen;
 
    SELECT t.id_telefono, a.id_cuenta INTO v_id_tel_destino, v_cuenta_destino
    FROM telefono_cliente t
    JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
    WHERE t.numero = p_tel_destino;
 
    IF p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    ELSEIF v_cuenta_origen IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono origen no esta afiliado';
    ELSEIF v_cuenta_destino IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono destino no esta afiliado';
    ELSEIF v_cuenta_origen = v_cuenta_destino THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los telefonos estan afiliados a la misma cuenta';
    END IF;
 
    -- bloquear las cuentas con FOR UPDATE
    SELECT estado, moneda, saldo INTO v_estado_origen, v_moneda_origen, v_saldo_origen
    FROM cuenta_iban
    WHERE id_cuenta = v_cuenta_origen
    FOR UPDATE;
 
    SELECT estado, moneda INTO v_estado_destino, v_moneda_destino
    FROM cuenta_iban
    WHERE id_cuenta = v_cuenta_destino
    FOR UPDATE;
 
    IF v_estado_origen <> 'ACTIVA' OR v_estado_destino <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las dos cuentas deben estar activas';
    ELSEIF v_moneda_origen <> 'CRC' OR v_moneda_destino <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SINPE Movil solo funciona en colones';
    ELSEIF v_saldo_origen < p_monto THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente';
    END IF;
 
    UPDATE cuenta_iban SET saldo = saldo - p_monto WHERE id_cuenta = v_cuenta_origen;
    UPDATE cuenta_iban SET saldo = saldo + p_monto WHERE id_cuenta = v_cuenta_destino;
 
    INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo)
    VALUES (v_cuenta_origen, v_cuenta_destino, p_monto, 'SINPE_MOVIL');
 
    SET v_id_transferencia = LAST_INSERT_ID();
 
    INSERT INTO transferencia_sinpe (id_transferencia, id_telefono_origen, id_telefono_destino)
    VALUES (v_id_transferencia, v_id_tel_origen, v_id_tel_destino);
 
    COMMIT;
    SELECT 'Transferencia SINPE realizada' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_transferir_sinpe
-- guardar los saldos antes de transferir (para la consulta 6)
DROP TEMPORARY TABLE IF EXISTS saldos_antes;
CREATE TEMPORARY TABLE saldos_antes AS
SELECT id_cuenta, iban, moneda, saldo FROM cuenta_iban;
 
CALL sp_transferir_sinpe('80000001', '80000002', 10000);
CALL sp_transferir_sinpe('70000003', '70000006', 5000);
SELECT id_cuenta, iban, saldo FROM cuenta_iban WHERE id_cuenta IN (1, 2, 3, 6);
-- CALL sp_transferir_sinpe('70000001', '80000001', 1000);      -- ERROR: telefonos de la misma cuenta
-- CALL sp_transferir_sinpe('80000011', '80000001', 9999999);   -- ERROR: saldo insuficiente
-- CALL sp_transferir_sinpe('80000001', '80000002', -50);       -- ERROR: monto no positivo
-- CALL sp_transferir_sinpe('80000020', '80000001', 1000);      -- ERROR: telefono origen no afiliado
 
 
 
-- sp_transferir_iban: transferir por IBAN con control transaccional
DELIMITER //
CREATE PROCEDURE sp_transferir_iban(
    IN p_iban_origen CHAR(22),
    IN p_iban_destino CHAR(22),
    IN p_monto DECIMAL(15,2)
)
BEGIN
    DECLARE v_cuenta_origen INT;
    DECLARE v_cuenta_destino INT;
    DECLARE v_estado_origen VARCHAR(10);
    DECLARE v_estado_destino VARCHAR(10);
    DECLARE v_moneda_origen CHAR(3);
    DECLARE v_moneda_destino CHAR(3);
    DECLARE v_saldo_origen DECIMAL(15,2);
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
 
    START TRANSACTION;
 
    SELECT id_cuenta, estado, moneda, saldo
    INTO v_cuenta_origen, v_estado_origen, v_moneda_origen, v_saldo_origen
    FROM cuenta_iban
    WHERE iban = p_iban_origen
    FOR UPDATE;
 
    SELECT id_cuenta, estado, moneda
    INTO v_cuenta_destino, v_estado_destino, v_moneda_destino
    FROM cuenta_iban
    WHERE iban = p_iban_destino
    FOR UPDATE;
 
    IF p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    ELSEIF v_cuenta_origen IS NULL OR v_cuenta_destino IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una de las cuentas no existe';
    ELSEIF v_cuenta_origen = v_cuenta_destino THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede transferir a la misma cuenta';
    ELSEIF v_estado_origen <> 'ACTIVA' OR v_estado_destino <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las dos cuentas deben estar activas';
    ELSEIF v_moneda_origen <> v_moneda_destino THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las cuentas deben tener la misma moneda';
    ELSEIF v_saldo_origen < p_monto THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo insuficiente';
    END IF;
 
    UPDATE cuenta_iban SET saldo = saldo - p_monto WHERE id_cuenta = v_cuenta_origen;
    UPDATE cuenta_iban SET saldo = saldo + p_monto WHERE id_cuenta = v_cuenta_destino;
 
    INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo)
    VALUES (v_cuenta_origen, v_cuenta_destino, p_monto, 'IBAN');
 
    COMMIT;
    SELECT 'Transferencia IBAN realizada' AS mensaje;
END //
DELIMITER ;
 
-- Consultas sp_transferir_iban
CALL sp_transferir_iban('CR00000000000000000001', 'CR00000000000000000003', 15000);
CALL sp_transferir_iban('CR00000000000000000025', 'CR00000000000000000026', 100);
SELECT id_cuenta, iban, moneda, saldo FROM cuenta_iban WHERE id_cuenta IN (1, 3, 25, 26);
-- CALL sp_transferir_iban('CR00000000000000000001', 'CR00000000000000000001', 1000);  -- ERROR: misma cuenta
-- CALL sp_transferir_iban('CR00000000000000000001', 'CR00000000000000000025', 1000);  -- ERROR: distinta moneda
-- CALL sp_transferir_iban('CR00000000000000000034', 'CR00000000000000000001', 1000);  -- ERROR: cuenta bloqueada
 
 
 
-- sp_consultar_movimientos: consultar movimientos de una cuenta en un periodo
DELIMITER //
CREATE PROCEDURE sp_consultar_movimientos(
    IN p_iban CHAR(22),
    IN p_fecha_inicio DATE,
    IN p_fecha_fin DATE
)
BEGIN
    DECLARE v_id_cuenta INT;
 
    SELECT id_cuenta INTO v_id_cuenta
    FROM cuenta_iban
    WHERE iban = p_iban;
 
    IF v_id_cuenta IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no existe';
    END IF;
 
    SELECT id_transferencia, fecha, tipo,
        CASE WHEN id_cuenta_origen = v_id_cuenta THEN 'ENVIADA' ELSE 'RECIBIDA' END AS movimiento,
        monto
    FROM transferencia
    WHERE (id_cuenta_origen = v_id_cuenta OR id_cuenta_destino = v_id_cuenta)
      AND DATE(fecha) BETWEEN p_fecha_inicio AND p_fecha_fin
    ORDER BY fecha;
END //
DELIMITER ;
 
-- Consultas sp_consultar_movimientos
CALL sp_consultar_movimientos('CR00000000000000000001', '2026-01-01', CURDATE());
-- CALL sp_consultar_movimientos('CR00000000000000000099', '2026-01-01', CURDATE());  -- ERROR: la cuenta no existe
 
 
 
-- 4. TRIGGERS OBLIGATORIOS
 
-- 1. Validacion BEFORE INSERT de afiliacion_sinpe
DELIMITER //
CREATE TRIGGER trg_validar_afiliacion
BEFORE INSERT ON afiliacion_sinpe
FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(10);
    DECLARE v_moneda CHAR(3);
    DECLARE v_cliente_cta INT;
    DECLARE v_cliente_tel INT;
 
    SELECT estado, moneda, id_cliente INTO v_estado, v_moneda, v_cliente_cta
    FROM cuenta_iban
    WHERE id_cuenta = NEW.id_cuenta;
 
    SELECT id_cliente INTO v_cliente_tel
    FROM telefono_cliente
    WHERE id_telefono = NEW.id_telefono;
 
    IF v_estado <> 'ACTIVA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no esta activa';
    ELSEIF v_moneda <> 'CRC' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta debe ser en colones';
    ELSEIF v_cliente_cta <> v_cliente_tel THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono y la cuenta no son del mismo titular';
    END IF;
END //
DELIMITER ;
 
-- Consultas trigger 1
-- INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (20, 25);   -- ERROR: cuenta en USD
-- INSERT INTO afiliacion_sinpe (id_telefono, id_cuenta) VALUES (20, 21);   -- ERROR: otro titular
 
 
-- 2. Auditoria AFTER INSERT de afiliacion_sinpe
DELIMITER //
CREATE TRIGGER trg_auditoria_afiliacion
AFTER INSERT ON afiliacion_sinpe
FOR EACH ROW
BEGIN
    INSERT INTO historial_afiliacion (id_telefono, id_cuenta, accion)
    VALUES (NEW.id_telefono, NEW.id_cuenta, 'AFILIACION');
END //
DELIMITER ;
 
-- Consultas trigger 2
CALL sp_afiliar_sinpe('70000002', 'CR00000000000000000033');
SELECT * FROM historial_afiliacion WHERE id_telefono = 26;   -- AFILIACION
 
 
-- 3. Auditoria BEFORE DELETE de afiliacion_sinpe
DELIMITER //
CREATE TRIGGER trg_auditoria_desafiliacion
BEFORE DELETE ON afiliacion_sinpe
FOR EACH ROW
BEGIN
    INSERT INTO historial_afiliacion (id_telefono, id_cuenta, accion)
    VALUES (OLD.id_telefono, OLD.id_cuenta, 'DESAFILIACION');
END //
DELIMITER ;
 
-- Consultas trigger 3
CALL sp_cambiar_cuenta_sinpe('70000002', 'CR00000000000000000002');
SELECT * FROM historial_afiliacion WHERE id_telefono = 26;   -- DESAFILIACION + AFILIACION
-- el traslado falla en el paso 2 y se recupera la afiliacion original
-- CALL sp_cambiar_cuenta_sinpe('70000002', 'CR00000000000000000025');  -- ERROR: cuenta en USD
SELECT * FROM afiliacion_sinpe WHERE id_telefono = 26;       -- sigue en la cuenta 2
 
 
-- 4. Validacion BEFORE INSERT de transferencia
DELIMITER //
CREATE TRIGGER trg_validar_transferencia
BEFORE INSERT ON transferencia
FOR EACH ROW
BEGIN
    IF NEW.monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    ELSEIF NEW.id_cuenta_origen = NEW.id_cuenta_destino THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta origen y destino son la misma';
    END IF;
END //
DELIMITER ;
 
-- Consultas trigger 4
-- INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo) VALUES (1, 2, 0, 'IBAN');  -- ERROR: monto
-- INSERT INTO transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo) VALUES (1, 1, 500, 'IBAN'); -- ERROR: misma cuenta
 
 
-- Regla 10: no cambiar el titular de un telefono o cuenta con afiliacion vigente
DELIMITER //
CREATE TRIGGER trg_titular_telefono
BEFORE UPDATE ON telefono_cliente
FOR EACH ROW
BEGIN
    IF OLD.id_cliente <> NEW.id_cliente
       AND EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_telefono = OLD.id_telefono) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El telefono esta afiliado, no se puede cambiar el titular';
    END IF;
END //
DELIMITER ;
 
-- Consultas regla 10 (telefono)
-- UPDATE telefono_cliente SET id_cliente = 2 WHERE numero = '80000001';  -- ERROR: telefono afiliado
 
 
DELIMITER //
CREATE TRIGGER trg_titular_cuenta
BEFORE UPDATE ON cuenta_iban
FOR EACH ROW
BEGIN
    IF OLD.id_cliente <> NEW.id_cliente
       AND EXISTS (SELECT 1 FROM afiliacion_sinpe WHERE id_cuenta = OLD.id_cuenta) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta tiene telefonos afiliados, no se puede cambiar el titular';
    END IF;
END //
DELIMITER ;
 
-- Consultas regla 10 (cuenta)
-- UPDATE cuenta_iban SET id_cliente = 2 WHERE iban = 'CR00000000000000000001';  -- ERROR: cuenta con telefonos afiliados
 
/**
Justificacion: el saldo, el estado y la moneda se validan en los procedimientos
porque ahi se bloquean las cuentas (FOR UPDATE) antes de mover el dinero; cuando
 se inserta en transferencia el dinero ya se movio. Ademas esta tabla no tiene los telefonos,
 entonces esa validacion solo se puede hacer en el procedimiento.
**/
 
-- 5. CONSULTAS E INFORMES ------------------------------------------------------------
 
-- 1. Listar telefonos de cada cliente e indicar cuales estan afiliados
SELECT c.id_cliente, c.nombres, c.primer_apellido, t.numero,
    CASE WHEN a.id_afiliacion IS NULL THEN 'NO AFILIADO' ELSE 'AFILIADO' END AS estado
FROM cliente c
JOIN telefono_cliente t ON t.id_cliente = c.id_cliente
LEFT JOIN afiliacion_sinpe a ON a.id_telefono = t.id_telefono
ORDER BY c.id_cliente;
 
-- 2. Listar todos los telefonos asociados a una cuenta IBAN
SET @iban = 'CR00000000000000000002';
SELECT ci.iban, t.numero
FROM cuenta_iban ci
JOIN afiliacion_sinpe a ON a.id_cuenta = ci.id_cuenta
JOIN telefono_cliente t ON t.id_telefono = a.id_telefono
WHERE ci.iban = @iban;
 
-- 3. Consultar historial cronologico de afiliaciones y desafiliaciones de un telefono
SET @numero = '70000002';
SELECT t.numero, ci.iban, h.accion, h.fecha_evento
FROM historial_afiliacion h
JOIN telefono_cliente t ON t.id_telefono = h.id_telefono
JOIN cuenta_iban ci ON ci.id_cuenta = h.id_cuenta
WHERE t.numero = @numero
ORDER BY h.fecha_evento, h.id_historial;
 
-- 4. Consultar transferencias enviadas y recibidas por una cuenta, con fecha y monto
CALL sp_consultar_movimientos('CR00000000000000000001', '2026-01-01', CURDATE());
 
-- 5. Calcular total enviado y recibido durante un intervalo de fechas
SET @id_cuenta = 1;
SELECT
    SUM(CASE WHEN id_cuenta_origen = @id_cuenta THEN monto ELSE 0 END) AS total_enviado,
    SUM(CASE WHEN id_cuenta_destino = @id_cuenta THEN monto ELSE 0 END) AS total_recibido
FROM transferencia
WHERE DATE(fecha) BETWEEN '2026-01-01' AND CURDATE();
 
-- 6. Comprobar los saldos de las cuentas participantes y la conservacion del total
SELECT s.iban, s.saldo AS saldo_antes, ci.saldo AS saldo_despues
FROM saldos_antes s
JOIN cuenta_iban ci ON ci.id_cuenta = s.id_cuenta
WHERE s.saldo <> ci.saldo;
 
SELECT s.moneda, SUM(s.saldo) AS total_antes, SUM(ci.saldo) AS total_despues
FROM saldos_antes s
JOIN cuenta_iban ci ON ci.id_cuenta = s.id_cuenta
WHERE s.saldo <> ci.saldo
GROUP BY s.moneda;