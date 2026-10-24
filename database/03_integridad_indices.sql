-- Mejoras opcionales recomendadas de integridad y rendimiento.

CREATE UNIQUE INDEX IF NOT EXISTS ux_permiso_modulo_accion ON permiso (LOWER(modulo), LOWER(accion));
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalogo_tipo_valor ON catalogo (LOWER(tipo), LOWER(valor));
CREATE INDEX IF NOT EXISTS ix_incidente_reportante ON incidente(id_reportante);
CREATE INDEX IF NOT EXISTS ix_evidencia_incidente ON evidencia(id_incidente);
CREATE INDEX IF NOT EXISTS ix_evidencia_custodio ON evidencia(id_custodio_actual);
CREATE INDEX IF NOT EXISTS ix_movimiento_evidencia ON movimiento_custodia(id_evidencia, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_solicitud_evidencia_estado ON solicitud_acceso(id_evidencia, estado);
CREATE INDEX IF NOT EXISTS ix_analisis_evidencia ON analisis_forense(id_evidencia);
CREATE INDEX IF NOT EXISTS ix_bitacora_fecha ON bitacora_auditoria(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_alerta_estado ON alerta(estado, fecha_generacion DESC);

-- Hace inalterable la bitácora a nivel de base de datos: se permiten INSERT y SELECT,
-- pero no UPDATE ni DELETE.
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
