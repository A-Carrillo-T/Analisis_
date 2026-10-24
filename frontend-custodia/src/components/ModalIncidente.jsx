import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { Button } from './ui/Button';
import { Field, inputClass } from './ui/Page';

const AREAS_FALLBACK = [
  'Administración',
  'Auditoría',
  'Informática',
  'Legal',
  'Seguridad',
];

// Genera YYYY-MM-DDTHH:mm utilizando la hora LOCAL del equipo.
const obtenerFechaHoraLocal = (fecha = new Date()) => {
  const pad = (numero) => String(numero).padStart(2, '0');

  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(
    fecha.getDate()
  )}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
};

export function ModalIncidente({ onClose, onGuardado }) {
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    tipo_incidente: 'Acceso no autorizado',
    severidad: 'Media',
    fecha_deteccion: '',
    area_afectada: '',
    observaciones: '',
  });

  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState('');

  const [tipos, setTipos] = useState([
    'Malware',
    'Acceso no autorizado',
    'Fuga de datos',
    'Phishing',
    'DDoS',
    'Otro',
  ]);

  const [severidades, setSeveridades] = useState([
    'Baja',
    'Media',
    'Alta',
    'Crítica',
  ]);

  const [areas, setAreas] = useState(AREAS_FALLBACK);
  const [loading, setLoading] = useState(false);

  const archivoInputRef = useRef(null);
  const fechaInputRef = useRef(null);

  useEffect(() => {
    api
      .get('/catalogos?estado=activo')
      .then(({ data }) => {
        const tiposCatalogo = data
          .filter((x) => x.tipo === 'tipo_incidente')
          .map((x) => x.valor);

        const severidadesCatalogo = data
          .filter((x) => x.tipo === 'severidad')
          .map((x) => x.valor);

        const areasCatalogo = data
          .filter((x) => x.tipo === 'area')
          .map((x) => x.valor);

        if (tiposCatalogo.length) {
          setTipos(tiposCatalogo);
        }

        if (severidadesCatalogo.length) {
          setSeveridades(severidadesCatalogo);
        }

        if (areasCatalogo.length) {
          setAreas(areasCatalogo);
        }
      })
      .catch(() => {
        // Si falla el catálogo, se conservan los valores locales.
      });
  }, []);

  const seleccionarArchivos = (event) => {
    const nuevos = Array.from(event.target.files || []);

    if (!nuevos.length) return;

    setError('');

    setArchivos((actuales) => {
      const combinados = [...actuales, ...nuevos];

      if (combinados.length > 5) {
        setError('Solo puedes adjuntar un máximo de 5 archivos.');
        return combinados.slice(0, 5);
      }

      return combinados;
    });

    // Permite seleccionar de nuevo el mismo archivo
    // después de haberlo quitado.
    event.target.value = '';
  };

  const quitarArchivo = (indice) => {
    setArchivos((actuales) =>
      actuales.filter((_, i) => i !== indice)
    );

    setError('');

    if (archivoInputRef.current) {
      archivoInputRef.current.value = '';
    }
  };

  const abrirSelectorArchivos = () => {
    archivoInputRef.current?.click();
  };

  const usarFechaHoraActual = () => {
    const ahora = obtenerFechaHoraLocal();

    setForm((actual) => ({
      ...actual,
      fecha_deteccion: ahora,
    }));

    // Cierra cualquier selector nativo que pudiera estar abierto.
    requestAnimationFrame(() => {
      fechaInputRef.current?.blur();
    });
  };

  const submit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const fd = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        fd.append(key, value);
      });

      archivos.forEach((archivo) => {
        fd.append('adjuntos', archivo);
      });

      const { data } = await api.post('/incidentes', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(`${data.mensaje}. Código: ${data.datos.codigo}`);

      await onGuardado();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          'Error al registrar incidente'
      );

      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-liquid-kelp border border-white/10 rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto">

        {/* ENCABEZADO */}
        <div className="flex justify-between mb-5">
          <h2 className="text-2xl">
            Registrar incidente
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-silver-mist"
          >
            ×
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-950/40 border border-red-400/30 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="grid md:grid-cols-2 gap-4"
        >
          {/* TÍTULO */}
          <Field label="Título">
            <input
              required
              className={inputClass}
              value={form.titulo}
              onChange={(e) =>
                setForm({
                  ...form,
                  titulo: e.target.value,
                })
              }
            />
          </Field>

          {/* ÁREA AFECTADA */}
          <Field label="Área afectada">
            <select
              required
              className={inputClass}
              value={form.area_afectada}
              onChange={(e) =>
                setForm({
                  ...form,
                  area_afectada: e.target.value,
                })
              }
            >
              <option value="" disabled>
                Selecciona un área
              </option>

              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </Field>

          {/* TIPO */}
          <Field label="Tipo">
            <select
              className={inputClass}
              value={form.tipo_incidente}
              onChange={(e) =>
                setForm({
                  ...form,
                  tipo_incidente: e.target.value,
                })
              }
            >
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </Field>

          {/* SEVERIDAD */}
          <Field label="Severidad">
            <select
              className={inputClass}
              value={form.severidad}
              onChange={(e) =>
                setForm({
                  ...form,
                  severidad: e.target.value,
                })
              }
            >
              {severidades.map((severidad) => (
                <option key={severidad} value={severidad}>
                  {severidad}
                </option>
              ))}
            </select>
          </Field>

          {/* FECHA DE DETECCIÓN */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-silver-mist mb-2">
              Fecha de detección
            </label>

            <input
              ref={fechaInputRef}
              type="datetime-local"
              required
              max={obtenerFechaHoraLocal()}
              className={inputClass}
              value={form.fecha_deteccion}
              onChange={(e) =>
                setForm({
                  ...form,
                  fecha_deteccion: e.target.value,
                })
              }
            />

            <button
              type="button"
              onClick={usarFechaHoraActual}
              className="mt-2 text-xs text-cyan-200 hover:text-white transition underline underline-offset-4"
            >
              Usar fecha y hora actual
            </button>
          </div>

          <div />

          {/* DESCRIPCIÓN */}
          <div className="md:col-span-2">
            <Field label="Descripción">
              <textarea
                rows="4"
                required
                className={inputClass}
                value={form.descripcion}
                onChange={(e) =>
                  setForm({
                    ...form,
                    descripcion: e.target.value,
                  })
                }
              />
            </Field>
          </div>

          {/* OBSERVACIONES */}
          <div className="md:col-span-2">
            <Field label="Observaciones">
              <textarea
                rows="2"
                className={inputClass}
                value={form.observaciones}
                onChange={(e) =>
                  setForm({
                    ...form,
                    observaciones: e.target.value,
                  })
                }
              />
            </Field>
          </div>

          {/* ARCHIVOS */}
          <div className="md:col-span-2">

            {/*
              IMPORTANTE:
              Aquí NO usamos <Field>, porque probablemente Field
              utiliza un <label> que envuelve todo su contenido.
              Eso provocaba que hacer clic en cualquier parte
              abriera el selector de archivos.
            */}

            <div className="text-xs uppercase tracking-wide text-silver-mist mb-2">
              Información preliminar
              <span className="ml-1 normal-case">
                (capturas, logs o notas; máximo 5 archivos)
              </span>
            </div>

            {/* INPUT REAL OCULTO */}
            <input
              ref={archivoInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={seleccionarArchivos}
            />

            {/* SOLO ESTE BOTÓN ABRE EL SELECTOR */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={abrirSelectorArchivos}
                className="w-fit rounded-lg border border-white/20 bg-liquid-deep/60 px-4 py-3 text-sm text-white transition hover:bg-white/10"
              >
                Elegir archivos
              </button>

              <span className="text-sm text-silver-mist">
                {archivos.length === 0
                  ? 'Ningún archivo seleccionado'
                  : archivos.length === 1
                    ? '1 archivo seleccionado'
                    : `${archivos.length} archivos seleccionados`}
              </span>
            </div>

            {/* ARCHIVOS SELECCIONADOS */}
            {archivos.length > 0 && (
              <div className="mt-3 space-y-2">
                {archivos.map((archivo, indice) => (
                  <div
                    key={`${archivo.name}-${archivo.lastModified}-${indice}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-liquid-deep/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {archivo.name}
                      </div>

                      <div className="text-xs text-silver-mist">
                        {(archivo.size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => quitarArchivo(indice)}
                      className="shrink-0 rounded-md border border-red-300/30 px-3 py-1.5 text-xs uppercase tracking-wider text-red-200 transition hover:bg-red-950/40"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACCIONES */}
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Guardando…'
                : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}