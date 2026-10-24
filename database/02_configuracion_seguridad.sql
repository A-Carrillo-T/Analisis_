-- Ejecutar después de 01_esquema.sql en una instalación nueva.
-- Roles, permisos RBAC y catálogos alineados con Proyecto Fase 3.

INSERT INTO rol (id_rol,nombre,descripcion) VALUES
(1,'Reportante','Registra y consulta sus incidentes'),
(2,'Recolector','Recolecta, identifica y entrega evidencias'),
(3,'Supervisor','Autoriza solicitudes, transferencias y cierres'),
(4,'Custodio','Controla almacenamiento, ubicación e integridad'),
(5,'Analista','Analiza exclusivamente copias autorizadas'),
(6,'Auditor','Consulta trazabilidad, bitácora y genera informes'),
(7,'Administrador','Gestiona usuarios, roles, permisos y catálogos')
ON CONFLICT (id_rol) DO UPDATE SET nombre=EXCLUDED.nombre,descripcion=EXCLUDED.descripcion;
SELECT setval(pg_get_serial_sequence('rol','id_rol'),GREATEST((SELECT COALESCE(MAX(id_rol),1) FROM rol),1));

WITH datos(modulo,accion,descripcion) AS (VALUES
('Incidentes','ver','Consultar incidentes'),('Incidentes','crear','Registrar incidentes'),('Incidentes','editar','Editar incidentes propios'),('Incidentes','cerrar','Cerrar casos con validaciones'),
('Evidencias','ver','Consultar evidencias'),('Evidencias','crear','Registrar evidencias'),('Evidencias','editar','Actualizar ubicación/estado permitido'),('Evidencias','descargar','Descargar original bajo custodia'),('Evidencias','verificar_integridad','Verificar SHA-256'),
('Custodia','ver','Consultar cadena de custodia'),('Custodia','transferir','Iniciar transferencia'),('Custodia','recibir','Firmar recepción'),('Custodia','autorizar','Autorizar transferencia entre áreas'),
('Solicitudes','ver','Consultar solicitudes'),('Solicitudes','crear','Solicitar copia para análisis'),('Solicitudes','resolver','Aprobar/rechazar solicitudes'),
('Copias','ver','Consultar copias autorizadas'),('Copias','descargar','Descargar copia autorizada'),
('Analisis','ver','Consultar análisis'),('Analisis','crear','Registrar análisis'),('Analisis','editar','Actualizar/finalizar análisis'),
('Alertas','ver','Consultar alertas'),('Alertas','resolver','Resolver alertas'),
('Auditoria','ver','Consultar bitácora'),('Reportes','generar','Generar reportes PDF'),
('Usuarios','ver','Consultar usuarios'),('Usuarios','crear','Crear usuarios'),('Usuarios','editar','Editar/desactivar usuarios'),
('Catalogos','crear','Crear catálogos'),('Catalogos','editar','Editar/desactivar catálogos'),
('Seguridad','ver','Consultar roles/permisos'),('Seguridad','administrar','Administrar RBAC')
)
INSERT INTO permiso(modulo,accion,descripcion)
SELECT d.modulo,d.accion,d.descripcion FROM datos d
WHERE NOT EXISTS (SELECT 1 FROM permiso p WHERE LOWER(p.modulo)=LOWER(d.modulo) AND LOWER(p.accion)=LOWER(d.accion));

DELETE FROM rol_permiso WHERE id_rol BETWEEN 1 AND 7;
WITH matriz(id_rol,modulo,accion) AS (VALUES
(1,'Incidentes','ver'),(1,'Incidentes','crear'),(1,'Incidentes','editar'),
(2,'Incidentes','ver'),(2,'Evidencias','ver'),(2,'Evidencias','crear'),(2,'Custodia','ver'),(2,'Custodia','transferir'),(2,'Custodia','recibir'),
(3,'Incidentes','ver'),(3,'Incidentes','cerrar'),(3,'Evidencias','ver'),(3,'Evidencias','verificar_integridad'),(3,'Custodia','ver'),(3,'Custodia','autorizar'),(3,'Solicitudes','ver'),(3,'Solicitudes','resolver'),(3,'Analisis','ver'),(3,'Alertas','ver'),(3,'Alertas','resolver'),(3,'Auditoria','ver'),(3,'Reportes','generar'),
(4,'Incidentes','ver'),(4,'Evidencias','ver'),(4,'Evidencias','editar'),(4,'Evidencias','descargar'),(4,'Evidencias','verificar_integridad'),(4,'Custodia','ver'),(4,'Custodia','transferir'),(4,'Custodia','recibir'),
(5,'Incidentes','ver'),(5,'Evidencias','ver'),(5,'Custodia','ver'),(5,'Solicitudes','ver'),(5,'Solicitudes','crear'),(5,'Copias','ver'),(5,'Copias','descargar'),(5,'Analisis','ver'),(5,'Analisis','crear'),(5,'Analisis','editar'),
(6,'Incidentes','ver'),(6,'Evidencias','ver'),(6,'Custodia','ver'),(6,'Analisis','ver'),(6,'Auditoria','ver'),(6,'Reportes','generar'),
(7,'Incidentes','ver'),(7,'Auditoria','ver'),(7,'Usuarios','ver'),(7,'Usuarios','crear'),(7,'Usuarios','editar'),(7,'Catalogos','crear'),(7,'Catalogos','editar'),(7,'Seguridad','ver'),(7,'Seguridad','administrar')
)
INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT m.id_rol,p.id_permiso FROM matriz m JOIN permiso p ON LOWER(p.modulo)=LOWER(m.modulo) AND LOWER(p.accion)=LOWER(m.accion)
ON CONFLICT DO NOTHING;

INSERT INTO catalogo(tipo,valor,descripcion,estado)
SELECT * FROM (VALUES
('tipo_incidente','Malware','Software malicioso','activo'),('tipo_incidente','Acceso no autorizado','Acceso no permitido','activo'),('tipo_incidente','Fuga de datos','Exposición o extracción de información','activo'),('tipo_incidente','Phishing','Suplantación','activo'),('tipo_incidente','DDoS','Denegación distribuida de servicio','activo'),('tipo_incidente','Otro','Otro incidente','activo'),
('severidad','Baja','Impacto menor','activo'),('severidad','Media','Impacto moderado','activo'),('severidad','Alta','Impacto alto','activo'),('severidad','Crítica','Impacto crítico','activo'),
('tipo_evidencia','Archivo digital','Archivo digital','activo'),('tipo_evidencia','Dispositivo físico','Dispositivo físico','activo'),('tipo_evidencia','Captura de red','Captura de tráfico','activo'),('tipo_evidencia','Registro de sistema','Log del sistema','activo'),('tipo_evidencia','Correo electrónico','Correo electrónico','activo'),('tipo_evidencia','Imagen/Video','Imagen o video','activo'),
('tipo_acceso','Análisis','Acceso mediante copia autorizada','activo'),
('area','Informática','Departamento de Informática','activo'),('area','Seguridad','Departamento de Seguridad','activo'),('area','Auditoría','Departamento de Auditoría','activo'),('area','Administración','Departamento Administrativo','activo'),('area','Legal','Departamento Legal','activo'),
('ubicacion_fisica','Bóveda de evidencias','Ubicación física controlada','activo'),('ubicacion_fisica','Gabinete seguro','Gabinete físico de custodia','activo'),
('ubicacion_logica','Repositorio forense','Repositorio lógico de evidencias','activo'),('ubicacion_logica','Almacenamiento cifrado','Ubicación lógica protegida','activo')
) AS x(tipo,valor,descripcion,estado)
WHERE NOT EXISTS (SELECT 1 FROM catalogo c WHERE LOWER(c.tipo)=LOWER(x.tipo) AND LOWER(c.valor)=LOWER(x.valor));
