-- UROVESA · Tablas Operarios y OrdenesReparacion
-- Origen ERP (IBM i): uro70f001.nomop / uro70f001.fbror
-- Filtros origen:
--   Operarios: opclba='' AND OPCTCP <> ' '
--   Ordenes:   ortip='OR' AND TRIM(ORCEO)='L'

-- ---------------------------------------------------------------------------
-- Operarios
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Operarios', N'U') IS NOT NULL
  DROP TABLE dbo.Operarios;
GO

CREATE TABLE dbo.Operarios (
  CodDelegacion   INT           NOT NULL,           -- OPCODE
  CodOperario     INT           NOT NULL,           -- OPCOOP (PK lógica)
  NombreApellidos NVARCHAR(120) NOT NULL,           -- OPNOMP
  CodTarjetaPresencia CHAR(8)   NOT NULL,           -- OPCTCP (mantener ceros a la izquierda)
  CONSTRAINT PK_Operarios PRIMARY KEY (CodOperario)
);
GO

INSERT INTO dbo.Operarios (CodDelegacion, CodOperario, NombreApellidos, CodTarjetaPresencia) VALUES
(999, 9,   N'PRUEBAS DST DST PRUEBAS',              '00161220'),
(1,   18,  N'RAMON MARQUEZ BARREIRO',               '00160667'),
(1,   22,  N'PABLO MONTAOS SANDE',                  '00160391'),
(10,  23,  N'JOSE LUIS LOPEZ TRONCOSO',             '00171236'),
(1,   25,  N'OSCAR IGLESIAS VARELA',                '00160599'),
(10,  33,  N'PABLO LOPEZ PONTE',                    '00170932'),
(10,  34,  N'ANTONIO MACEIRAS MARTINEZ',            '00164085'),
(10,  38,  N'ANA ISABEL GARCIA GARCIA',             '00160094'),
(1,   42,  N'DANIEL LISTE MARTINEZ',                '00160681'),
(10,  47,  N'CARLOS ALBERTO GOMEZ CASTRO',          '00164556'),
(10,  54,  N'JOSE ANGEL MIRAMONTES TORREIRA',       '00160179'),
(1,   61,  N'FRANCISCO ALONSO FERNANDEZ',           '00160605'),
(10,  69,  N'JOSE MASEDA GONZALEZ',                 '00164771'),
(1,   76,  N'LUIS PAZOS BALADO',                    '00160537'),
(10,  98,  N'JUSTO SIERRA REY',                     '00174091'),
(1,   102, N'JUAN JOSE IGLESIAS FERREÑO',           '00160704'),
(1,   104, N'JOSE ANTONIO PORTOS FUENTES',          '00160711'),
(1,   150, N'LUIS BOTANA SEOANE',                   '00163620');
GO

-- ---------------------------------------------------------------------------
-- OrdenesReparacion
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.OrdenesReparacion', N'U') IS NOT NULL
  DROP TABLE dbo.OrdenesReparacion;
GO

CREATE TABLE dbo.OrdenesReparacion (
  TipoOrden         CHAR(2)        NOT NULL,        -- ORTIP
  CodigoOrden       INT            NOT NULL,        -- ORORD (PK)
  Nombre            NVARCHAR(120)  NOT NULL,        -- ORNBR
  ArticuloAsociado  NVARCHAR(40)   NOT NULL,        -- ORART
  CONSTRAINT PK_OrdenesReparacion PRIMARY KEY (CodigoOrden)
);
GO

INSERT INTO dbo.OrdenesReparacion (TipoOrden, CodigoOrden, Nombre, ArticuloAsociado) VALUES
('OR', 11381, N'VS9ZPJ4J721009361',                 N'WS2PHL976E'),
('OR', 11583, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502I'),
('OR', 11584, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502E'),
('OR', 11585, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502Ñ'),
('OR', 11651, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502P'),
('OR', 11652, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502D'),
('OR', 11741, N'SK95 CAB.DOBLE+FURGON EUMM GRG',    N'WSSK95994A'),
('OR', 11887, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1503Z'),
('OR', 11912, N'SK95 CAB.DOBLE+FURGON EUMM GRG',    N'WSSK95994A'),
('OR', 11922, N'SK95 CAB.DOBLE+FURGON EUMM GRG',    N'WSSK95994Ñ'),
('OR', 11953, N'VAMTAC ST5 2PH AMBUL.RGO/20',       N'WS2PHL977M'),
('OR', 12160, N'SK95 CAB.DOBLE+FURGON EUMM GRG',    N'WSSK95994Ñ'),
('OR', 12642, N'ST5 2HD SHELTER-SGP/20',            N'WS2PHL1502O'),
('OR', 12832, N'SK95 CAB.DOBLE+FURGON EUMM GRG',    N'WSSK95994Ñ'),
('OR', 12857, N'VAMTAC ST5 THD 4PC RGO V2/19',      N'WS4PCN993P'),
('OR', 12858, N'VAMTAC ST5 THD 4PC RGO/19',         N'WS4PCN986D'),
('OR', 13037, N'VAMTAC ST5 2HD SGP-SHELTER/20',     N'WS2PHL976E'),
('OR', 13038, N'VAMTAC ST5 2HD SGP-SHELTER/20',     N'WS2PHL1502Ñ'),
('OR', 13323, N'ST5 2HD SHELTER-SGP/20',            N'210755'),
('OR', 14112, N'VAMTAC ST5 2PH AMBUL.RGO/20',       N'WS2PHL976M'),
('OR', 14273, N'VEHICULO "URO VAMTAC" ST5 4PC',     N'WR4PCN907Z'),
('OR', 14475, N'VAMTAC ST5 4PWL+F RED ARROW',       N'WS4PHL994I');
GO
