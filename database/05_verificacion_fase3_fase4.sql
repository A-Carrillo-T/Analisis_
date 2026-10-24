-- Consultas de SOLO LECTURA para verificar la migración 04.

-- 1. Columnas nuevas de usuario/evidencia/custodia/análisis
SELECT table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='usuario' AND column_name='area')
    OR (table_name='evidencia' AND column_name='observaciones')
    OR (table_name='movimiento_custodia' AND column_name IN ('estado_transferencia','fecha_recepcion'))
    OR (table_name='analisis_forense' AND column_name='id_copia'))
ORDER BY table_name,column_name;

-- 2. Tablas nuevas
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('incidente_adjunto','copia_autorizada')
ORDER BY table_name;

-- 3. Matriz RBAC resultante
SELECT r.id_rol,r.nombre AS rol,p.modulo,p.accion
FROM rol_permiso rp
JOIN rol r ON r.id_rol=rp.id_rol
JOIN permiso p ON p.id_permiso=rp.id_permiso
WHERE r.id_rol BETWEEN 1 AND 7
ORDER BY r.id_rol,p.modulo,p.accion;

-- 4. Usuarios y área/departamento (completar áreas desde Administración antes de probar transferencias)
SELECT u.id_usuario,u.nombre,u.apellido,u.correo,r.nombre AS rol,u.area,u.estado
FROM usuario u LEFT JOIN rol r ON r.id_rol=u.id_rol
ORDER BY u.id_usuario;

-- 5. Triggers de inalterabilidad
SELECT trigger_name,event_manipulation,event_object_table
FROM information_schema.triggers
WHERE trigger_name IN ('trg_proteger_bitacora_auditoria','trg_proteger_evidencia_registrada')
ORDER BY trigger_name,event_manipulation;


-- 6. Semáforo inicial: nuevas evidencias deben iniciar Pendiente (amarillo)
SELECT column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='evidencia' AND column_name='estado_integridad';

-- 7. Catálogos oficiales que alimentan formularios
SELECT tipo,valor,estado
FROM catalogo
WHERE tipo IN ('tipo_incidente','severidad','tipo_evidencia','area','ubicacion_fisica','ubicacion_logica')
ORDER BY tipo,valor;
