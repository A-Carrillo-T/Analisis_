-- Esquema base actualizado del Sistema de Custodia Digital
CREATE TABLE IF NOT EXISTS rol (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);
CREATE TABLE IF NOT EXISTS permiso (
    id_permiso SERIAL PRIMARY KEY,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT
);
CREATE TABLE IF NOT EXISTS rol_permiso (
    id_rol INT REFERENCES rol(id_rol) ON DELETE CASCADE,
    id_permiso INT REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    id_rol INT REFERENCES rol(id_rol),
    area VARCHAR(100),
    estado VARCHAR(20) DEFAULT 'activo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP
);
CREATE TABLE IF NOT EXISTS catalogo (
    id_catalogo SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    valor VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'activo'
);
CREATE TABLE IF NOT EXISTS incidente (
    id_incidente SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo_incidente VARCHAR(50) NOT NULL,
    severidad VARCHAR(20) NOT NULL,
    fecha_deteccion TIMESTAMP NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) DEFAULT 'Abierto',
    area_afectada VARCHAR(100) NOT NULL,
    id_reportante INT REFERENCES usuario(id_usuario),
    observaciones TEXT
);
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
CREATE TABLE IF NOT EXISTS evidencia (
    id_evidencia SERIAL PRIMARY KEY,
    fecha_recoleccion TIMESTAMP NOT NULL,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    tipo_evidencia VARCHAR(50) NOT NULL,
    origen VARCHAR(200) NOT NULL,
    metodo_recoleccion VARCHAR(100),
    hash_original VARCHAR(64) NOT NULL,
    hash_actual VARCHAR(64),
    estado_integridad VARCHAR(20) DEFAULT 'Pendiente',
    estado VARCHAR(30) DEFAULT 'Recolectada',
    ruta_archivo VARCHAR(500) NOT NULL,
    codigo_qr TEXT,
    ubicacion_fisica VARCHAR(200),
    ubicacion_logica VARCHAR(200),
    observaciones TEXT,
    id_incidente INT REFERENCES incidente(id_incidente),
    id_recolector INT REFERENCES usuario(id_usuario),
    id_custodio_actual INT REFERENCES usuario(id_usuario),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS movimiento_custodia (
    id_movimiento SERIAL PRIMARY KEY,
    id_evidencia INT REFERENCES evidencia(id_evidencia),
    id_entrega INT REFERENCES usuario(id_usuario),
    id_recibe INT REFERENCES usuario(id_usuario),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    firma_entrega TEXT,
    firma_recepcion TEXT,
    requiere_autorizacion BOOLEAN DEFAULT FALSE,
    id_autorizador INT REFERENCES usuario(id_usuario),
    estado_autorizacion VARCHAR(20),
    estado_transferencia VARCHAR(30) DEFAULT 'Pendiente',
    fecha_recepcion TIMESTAMP
);
CREATE TABLE IF NOT EXISTS solicitud_acceso (
    id_solicitud SERIAL PRIMARY KEY,
    id_evidencia INT REFERENCES evidencia(id_evidencia),
    id_solicitante INT REFERENCES usuario(id_usuario),
    id_aprobador INT REFERENCES usuario(id_usuario),
    motivo TEXT NOT NULL,
    tipo_acceso VARCHAR(30) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente',
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP,
    observaciones TEXT
);
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
CREATE TABLE IF NOT EXISTS analisis_forense (
    id_analisis SERIAL PRIMARY KEY,
    id_evidencia INT REFERENCES evidencia(id_evidencia),
    id_copia INT REFERENCES copia_autorizada(id_copia),
    id_analista INT REFERENCES usuario(id_usuario),
    herramientas TEXT NOT NULL,
    procedimiento TEXT NOT NULL,
    hallazgos TEXT NOT NULL,
    conclusiones TEXT NOT NULL,
    archivos_adjuntos TEXT,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id_registro SERIAL PRIMARY KEY,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT REFERENCES usuario(id_usuario),
    accion VARCHAR(100) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    id_entidad_afectada INT,
    tipo_entidad VARCHAR(50),
    detalles TEXT,
    direccion_ip VARCHAR(45)
);
CREATE TABLE IF NOT EXISTS alerta (
    id_alerta SERIAL PRIMARY KEY,
    id_evidencia INT REFERENCES evidencia(id_evidencia),
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'Activa',
    id_revisor INT REFERENCES usuario(id_usuario),
    fecha_resolucion TIMESTAMP,
    observaciones_resolucion TEXT
);
