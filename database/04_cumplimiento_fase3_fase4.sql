-- ============================================================
-- MIGRACIÓN 04 - Cumplimiento Fase 3 / Fase 4
-- Ejecutar una sola vez DESPUÉS de 02_configuracion_seguridad.sql
-- y 03_integridad_indices.sql. Es idempotente.
-- ============================================================

-- 1) Datos organizacionales para reglas de transferencias entre áreas.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS area VARCHAR(100);

-- 2) Observaciones formales de evidencia.
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE evidencia ALTER COLUMN estado_integridad SET DEFAULT 'Pendiente';
UPDATE evidencia SET estado_integridad='Pendiente' WHERE hash_actual IS NULL AND LOWER(estado_integridad) IN ('integra','íntegra');

-- 3) Adjuntos preliminares de incidentes (RF-002).
CREATE TABLE IF NOT EXISTS incidente_adjunto (
    id_adjunto SERIAL PRIMARY KEY,
    id_incidente INT NOT NULL REFERENCES incidente(id_incidente),
    nombre_original VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    tipo_mime VARCHAR(150),
    tamano_bytes BIGINT,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT REFERENCES usuario(id_usuario)
);

-- 4) Estado completo de transferencia/recepción.
ALTER TABLE movimiento_custodia ADD COLUMN IF NOT EXISTS estado_transferencia VARCHAR(30) DEFAULT 'Pendiente';
ALTER TABLE movimiento_custodia ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMP;

-- 5) Copias autorizadas para análisis forense (RF-015 / RN-008).
CREATE TABLE IF NOT EXISTS copia_autorizada (
    id_copia SERIAL PRIMARY KEY,
    codigo VARCHAR(24) UNIQUE NOT NULL,
    id_evidencia INT NOT NULL REFERENCES evidencia(id_evidencia),
    id_solicitud INT UNIQUE REFERENCES solicitud_acceso(id_solicitud),
    id_analista INT NOT NULL REFERENCES usuario(id_usuario),
    id_generador INT NOT NULL REFERENCES usuario(id_usuario),
    ruta_archivo VARCHAR(500) NOT NULL,
    hash_copia VARCHAR(64) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activa',
    fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE analisis_forense ADD COLUMN IF NOT EXISTS id_copia INT REFERENCES copia_autorizada(id_copia);

-- 6) Secuencias seguras para códigos correlativos sin colisiones por concurrencia.
CREATE SEQUENCE IF NOT EXISTS seq_incidente_codigo START 1;
CREATE SEQUENCE IF NOT EXISTS seq_evidencia_codigo START 1;
CREATE SEQUENCE IF NOT EXISTS seq_copia_codigo START 1;

SELECT setval('seq_incidente_codigo', GREATEST((SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^.*-', ''), '')::bigint),0) + 1 FROM incidente),1), false);
SELECT setval('seq_evidencia_codigo', GREATEST((SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^.*-', ''), '')::bigint),0) + 1 FROM evidencia),1), false);
SELECT setval('seq_copia_codigo', GREATEST((SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^.*-', ''), '')::bigint),0) + 1 FROM copia_autorizada),1), false);

-- 7) Catálogos documentados en Fase 3.
INSERT INTO catalogo(tipo,valor,descripcion,estado)
SELECT * FROM (VALUES
('tipo_incidente','DDoS','Ataque de denegación distribuida de servicio','activo'),
('tipo_incidente','Otro','Otro tipo de incidente','activo'),
('tipo_evidencia','Archivo digital','Archivo o documento digital','activo'),
('tipo_evidencia','Dispositivo físico','Dispositivo de almacenamiento o equipo','activo'),
('tipo_evidencia','Captura de red','Captura de tráfico de red','activo'),
('tipo_evidencia','Registro de sistema','Log o registro de sistema','activo'),
('tipo_evidencia','Correo electrónico','Mensaje o archivo de correo electrónico','activo'),
('tipo_evidencia','Imagen/Video','Archivo de imagen o video','activo'),
('area','Informática','Departamento de Informática','activo'),
('area','Seguridad','Departamento de Seguridad','activo'),
('area','Auditoría','Departamento de Auditoría','activo'),
('area','Administración','Departamento Administrativo','activo'),
('area','Legal','Departamento Legal','activo'),
('ubicacion_fisica','Bóveda de evidencias','Ubicación física controlada','activo'),
('ubicacion_fisica','Gabinete seguro','Gabinete físico de custodia','activo'),
('ubicacion_logica','Repositorio forense','Repositorio lógico de evidencias','activo'),
('ubicacion_logica','Almacenamiento cifrado','Ubicación lógica protegida','activo')
) AS x(tipo,valor,descripcion,estado)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo c
  WHERE LOWER(c.tipo)=LOWER(x.tipo) AND LOWER(c.valor)=LOWER(x.valor)
);

-- Desactivar valores heredados que no corresponden a la clasificación oficial de Fase 3.
UPDATE catalogo SET estado='inactivo'
WHERE LOWER(tipo)='tipo_evidencia' AND LOWER(valor) IN ('digital','física','fisica');
UPDATE catalogo SET estado='inactivo'
WHERE LOWER(tipo)='tipo_acceso' AND LOWER(valor) IN ('lectura','descarga');

-- 8) Permisos necesarios para la matriz oficial y reportes.
WITH datos(modulo,accion,descripcion) AS (VALUES
('Incidentes','ver','Consultar incidentes'),
('Incidentes','crear','Registrar incidentes'),
('Incidentes','editar','Editar información de incidentes propios'),
('Incidentes','cerrar','Cerrar casos con validaciones de negocio'),
('Evidencias','ver','Consultar evidencias'),
('Evidencias','crear','Registrar evidencias'),
('Evidencias','editar','Actualizar ubicación y metadatos permitidos'),
('Evidencias','descargar','Descargar evidencia original autorizada'),
('Evidencias','verificar_integridad','Verificar hash SHA-256'),
('Custodia','ver','Consultar cadena de custodia'),
('Custodia','transferir','Iniciar transferencia de custodia'),
('Custodia','recibir','Aceptar recepción y firmar custodia'),
('Custodia','autorizar','Autorizar transferencias entre departamentos'),
('Solicitudes','ver','Consultar solicitudes de acceso'),
('Solicitudes','crear','Solicitar acceso a una copia de evidencia'),
('Solicitudes','resolver','Aprobar o rechazar solicitudes'),
('Copias','ver','Consultar copias autorizadas'),
('Copias','descargar','Descargar copia autorizada'),
('Analisis','ver','Consultar análisis forenses'),
('Analisis','crear','Registrar análisis forense'),
('Analisis','editar','Actualizar análisis forense'),
('Alertas','ver','Consultar alertas de integridad'),
('Alertas','resolver','Resolver alertas de integridad'),
('Auditoria','ver','Consultar bitácora inalterable'),
('Reportes','generar','Generar reportes PDF'),
('Usuarios','ver','Consultar usuarios'),
('Usuarios','crear','Crear usuarios'),
('Usuarios','editar','Editar/desactivar usuarios'),
('Catalogos','crear','Crear valores de catálogo'),
('Catalogos','editar','Editar/desactivar valores de catálogo'),
('Seguridad','ver','Consultar roles y permisos'),
('Seguridad','administrar','Administrar roles y permisos')
)
INSERT INTO permiso(modulo,accion,descripcion)
SELECT d.modulo,d.accion,d.descripcion
FROM datos d
WHERE NOT EXISTS (
  SELECT 1 FROM permiso p
  WHERE LOWER(p.modulo)=LOWER(d.modulo) AND LOWER(p.accion)=LOWER(d.accion)
);

-- Matriz estricta documentada en la Fase 3.
-- Se reconstruyen asignaciones de los siete roles estándar para evitar permisos residuales.
DELETE FROM rol_permiso WHERE id_rol BETWEEN 1 AND 7;

WITH matriz(id_rol,modulo,accion) AS (VALUES
-- Reportante
(1,'Incidentes','ver'),(1,'Incidentes','crear'),(1,'Incidentes','editar'),
-- Recolector
(2,'Incidentes','ver'),(2,'Evidencias','ver'),(2,'Evidencias','crear'),
(2,'Custodia','ver'),(2,'Custodia','transferir'),(2,'Custodia','recibir'),
-- Supervisor
(3,'Incidentes','ver'),(3,'Incidentes','cerrar'),
(3,'Evidencias','ver'),(3,'Evidencias','verificar_integridad'),
(3,'Custodia','ver'),(3,'Custodia','autorizar'),
(3,'Solicitudes','ver'),(3,'Solicitudes','resolver'),
(3,'Analisis','ver'),(3,'Alertas','ver'),(3,'Alertas','resolver'),
(3,'Auditoria','ver'),(3,'Reportes','generar'),
-- Custodio
(4,'Incidentes','ver'),(4,'Evidencias','ver'),(4,'Evidencias','editar'),(4,'Evidencias','descargar'),
(4,'Evidencias','verificar_integridad'),(4,'Custodia','ver'),(4,'Custodia','transferir'),(4,'Custodia','recibir'),
-- Analista
(5,'Incidentes','ver'),(5,'Evidencias','ver'),(5,'Custodia','ver'),
(5,'Solicitudes','ver'),(5,'Solicitudes','crear'),(5,'Copias','ver'),(5,'Copias','descargar'),
(5,'Analisis','ver'),(5,'Analisis','crear'),(5,'Analisis','editar'),
-- Auditor
(6,'Incidentes','ver'),(6,'Evidencias','ver'),(6,'Custodia','ver'),(6,'Analisis','ver'),
(6,'Auditoria','ver'),(6,'Reportes','generar'),
-- Administrador: administración + visualización de incidentes/bitácora según matriz oficial
(7,'Incidentes','ver'),(7,'Auditoria','ver'),
(7,'Usuarios','ver'),(7,'Usuarios','crear'),(7,'Usuarios','editar'),
(7,'Catalogos','crear'),(7,'Catalogos','editar'),
(7,'Seguridad','ver'),(7,'Seguridad','administrar')
)
INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT m.id_rol,p.id_permiso
FROM matriz m
JOIN permiso p ON LOWER(p.modulo)=LOWER(m.modulo) AND LOWER(p.accion)=LOWER(m.accion)
ON CONFLICT DO NOTHING;

-- 9) Índices para rendimiento (<3 s en operación normal con índices de búsqueda principales).
CREATE INDEX IF NOT EXISTS ix_incidente_estado_fecha ON incidente(estado, fecha_registro DESC);
CREATE INDEX IF NOT EXISTS ix_incidente_adjunto_incidente ON incidente_adjunto(id_incidente);
CREATE INDEX IF NOT EXISTS ix_evidencia_integridad ON evidencia(estado_integridad, fecha_registro DESC);
CREATE INDEX IF NOT EXISTS ix_movimiento_recibe_estado ON movimiento_custodia(id_recibe, estado_transferencia);
CREATE INDEX IF NOT EXISTS ix_copia_analista_estado ON copia_autorizada(id_analista, estado);
CREATE INDEX IF NOT EXISTS ix_auditoria_usuario_modulo_fecha ON bitacora_auditoria(id_usuario, modulo, fecha_hora DESC);

-- 10) Evidencia: sin DELETE y hash/código/ruta original inalterables.
CREATE OR REPLACE FUNCTION proteger_evidencia_registrada()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Una evidencia registrada no puede eliminarse (RN-004)';
  END IF;
  IF NEW.codigo IS DISTINCT FROM OLD.codigo
     OR NEW.hash_original IS DISTINCT FROM OLD.hash_original
     OR NEW.ruta_archivo IS DISTINCT FROM OLD.ruta_archivo
     OR NEW.id_incidente IS DISTINCT FROM OLD.id_incidente
     OR NEW.id_recolector IS DISTINCT FROM OLD.id_recolector THEN
    RAISE EXCEPTION 'Los datos originales de identificación/integridad de la evidencia son inalterables';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_evidencia_registrada ON evidencia;
CREATE TRIGGER trg_proteger_evidencia_registrada
BEFORE UPDATE OR DELETE ON evidencia
FOR EACH ROW EXECUTE FUNCTION proteger_evidencia_registrada();

-- 11) Mantener la bitácora inalterable incluso si 03 no se ejecutó.
CREATE OR REPLACE FUNCTION proteger_bitacora_auditoria()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría es inalterable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proteger_bitacora_auditoria ON bitacora_auditoria;
CREATE TRIGGER trg_proteger_bitacora_auditoria
BEFORE UPDATE OR DELETE ON bitacora_auditoria
FOR EACH ROW EXECUTE FUNCTION proteger_bitacora_auditoria();
