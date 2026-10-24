import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSearchParams } from 'react-router-dom';

import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

import {
  PageHeader,
  Panel,
  Empty,
  ErrorBox,
  Field,
  inputClass,
} from '../components/ui/Page';

import { Table } from '../components/ui/Table';

import { descargarArchivo } from '../utils/download';
import { fechaLocal } from '../utils/fecha';


/* =========================================================
   VALORES INICIALES
========================================================= */

const initial = {
  descripcion: '',
  tipo_evidencia: 'Archivo digital',
  origen: '',
  metodo_recoleccion: '',
  id_incidente: '',
  fecha_recoleccion: '',
  ubicacion_fisica: '',
  ubicacion_logica: '',
  observaciones: '',
};


/* =========================================================
   VALORES DE RESPALDO
========================================================= */

const TIPOS_EVIDENCIA_FALLBACK = [
  'Archivo digital',
  'Dispositivo físico',
  'Captura de red',
  'Registro de sistema',
  'Correo electrónico',
  'Imagen/Video',
];

const METODOS_RECOLECCION_FALLBACK = [
  'Copia controlada',
  'Imagen forense',
  'Exportación de logs',
  'Adquisición en vivo',
  'Extracción manual',
  'Clonado de dispositivo',
];

const UBICACIONES_FISICAS_FALLBACK = [
  'Bóveda de evidencias',
  'Gabinete seguro',
  'Laboratorio de informática',
  'Oficina de TI',
  'Archivo físico',
  'Almacén principal',
];

const UBICACIONES_LOGICAS_FALLBACK = [
  'Servidor de evidencias',
  'Carpeta del caso',
  'NAS forense',
  'Repositorio seguro',
  'Equipo de análisis',
  'VM forense',
];


/* =========================================================
   UTILIDADES
========================================================= */

const valoresUnicos = (valores = []) => {
  return [...new Set(valores.filter(Boolean))];
};


/*
 * Devuelve la fecha y hora LOCAL.
 * No utilizamos toISOString() porque trabaja en UTC
 * y podría causar diferencia horaria.
 */
const obtenerFechaHoraLocal = (fecha = new Date()) => {
  const pad = (numero) => String(numero).padStart(2, '0');

  return `${fecha.getFullYear()}-${pad(
    fecha.getMonth() + 1
  )}-${pad(fecha.getDate())}T${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`;
};


const colorIntegridad = (estado) => {
  const valor = String(estado).toLowerCase();

  if (valor.includes('comprom')) {
    return 'text-red-300';
  }

  if (valor.includes('pend')) {
    return 'text-amber-300';
  }

  return 'text-emerald-300';
};


/* =========================================================
   COMPONENTE
========================================================= */

export function Evidencias() {
  const { usuario, tienePermiso } = useContext(AuthContext);

  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [incidentes, setIncidentes] = useState([]);

  const [tipos, setTipos] = useState(
    TIPOS_EVIDENCIA_FALLBACK
  );

  const [metodosRecoleccion, setMetodosRecoleccion] =
    useState(METODOS_RECOLECCION_FALLBACK);

  const [receptores, setReceptores] = useState([]);

  const [
    ubicacionesFisicas,
    setUbicacionesFisicas,
  ] = useState(UBICACIONES_FISICAS_FALLBACK);

  const [
    ubicacionesLogicas,
    setUbicacionesLogicas,
  ] = useState(UBICACIONES_LOGICAS_FALLBACK);

  const [form, setForm] = useState(initial);

  const [archivo, setArchivo] = useState(null);

  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [solicitud, setSolicitud] = useState(null);
  const [editar, setEditar] = useState(null);

  const [error, setError] = useState('');

  const archivoInputRef = useRef(null);
  const fechaInputRef = useRef(null);


  /* =========================================================
     CARGAR EVIDENCIAS
  ========================================================= */

  const cargar = async () => {
    try {
      setError('');

      const respuesta = await api.get('/evidencias');

      setRows(respuesta.data);
    } catch (e) {
      setError(
        e.response?.data?.mensaje ||
          'No se pudieron cargar evidencias'
      );
    }
  };


  /* =========================================================
     CARGA INICIAL
  ========================================================= */

  useEffect(() => {
    cargar();

    api
      .get('/incidentes')
      .then((respuesta) => {
        setIncidentes(respuesta.data);
      })
      .catch(() => {});

    api
      .get('/catalogos?estado=activo')
      .then((respuesta) => {
        const catalogos = respuesta.data;

        const tiposCatalogo = catalogos
          .filter(
            (item) =>
              item.tipo === 'tipo_evidencia'
          )
          .map((item) => item.valor);

        const metodosCatalogo = catalogos
          .filter(
            (item) =>
              item.tipo === 'metodo_recoleccion'
          )
          .map((item) => item.valor);

        const fisicasCatalogo = catalogos
          .filter(
            (item) =>
              item.tipo === 'ubicacion_fisica'
          )
          .map((item) => item.valor);

        const logicasCatalogo = catalogos
          .filter(
            (item) =>
              item.tipo === 'ubicacion_logica'
          )
          .map((item) => item.valor);

        setTipos(
          valoresUnicos([
            ...tiposCatalogo,
            ...TIPOS_EVIDENCIA_FALLBACK,
          ])
        );

        setMetodosRecoleccion(
          valoresUnicos([
            ...metodosCatalogo,
            ...METODOS_RECOLECCION_FALLBACK,
          ])
        );

        setUbicacionesFisicas(
          valoresUnicos([
            ...fisicasCatalogo,
            ...UBICACIONES_FISICAS_FALLBACK,
          ])
        );

        setUbicacionesLogicas(
          valoresUnicos([
            ...logicasCatalogo,
            ...UBICACIONES_LOGICAS_FALLBACK,
          ])
        );
      })
      .catch(() => {});

    if (
      tienePermiso(
        'Custodia',
        'transferir'
      )
    ) {
      api
        .get(
          '/usuarios/receptores-custodia'
        )
        .then((respuesta) =>
          setReceptores(respuesta.data)
        )
        .catch(() => {});
    }
  }, []);


  /* =========================================================
     ABRIR MODAL DESDE INCIDENTE
  ========================================================= */

  useEffect(() => {
    if (
      params.get('nuevo') === '1' &&
      tienePermiso(
        'Evidencias',
        'crear'
      )
    ) {
      setForm({
        ...initial,
        id_incidente:
          params.get('incidente') || '',
      });

      setArchivo(null);

      setModal(true);

      setParams({});
    }
  }, []);


  /* =========================================================
     ARCHIVO ORIGINAL
  ========================================================= */

  const seleccionarArchivo = (event) => {
    const seleccionado =
      event.target.files?.[0] || null;

    if (!seleccionado) {
      return;
    }

    setArchivo(seleccionado);

    /*
     * Limpiamos el input real para permitir
     * seleccionar nuevamente el mismo archivo
     * después de quitarlo.
     */
    event.target.value = '';
  };


  const abrirSelectorArchivo = () => {
    archivoInputRef.current?.click();
  };


  const quitarArchivo = () => {
    setArchivo(null);

    if (archivoInputRef.current) {
      archivoInputRef.current.value = '';
    }
  };


  /* =========================================================
     FECHA Y HORA ACTUAL
  ========================================================= */

  const usarFechaHoraActual = () => {
    setForm((actual) => ({
      ...actual,
      fecha_recoleccion:
        obtenerFechaHoraLocal(),
    }));

    /*
     * Cierra el selector nativo de fecha/hora
     * en navegadores que lo mantienen abierto.
     */
    requestAnimationFrame(() => {
      fechaInputRef.current?.blur();
    });
  };


  /* =========================================================
     REGISTRAR EVIDENCIA
  ========================================================= */

  const submit = async (e) => {
    e.preventDefault();

    if (!archivo) {
      alert(
        'Selecciona el archivo original de la evidencia'
      );

      return;
    }

    const fd = new FormData();

    Object.entries(form).forEach(
      ([clave, valor]) => {
        if (valor !== '') {
          fd.append(clave, valor);
        }
      }
    );

    fd.append('archivo', archivo);

    try {
      const { data } = await api.post(
        '/evidencias',
        fd,
        {
          headers: {
            'Content-Type':
              'multipart/form-data',
          },
        }
      );

      alert(
        `${data.mensaje}. Código: ${data.datos.codigo}`
      );

      setModal(false);

      setForm(initial);

      setArchivo(null);

      if (archivoInputRef.current) {
        archivoInputRef.current.value =
          '';
      }

      cargar();
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'Error al registrar evidencia'
      );
    }
  };


  /* =========================================================
     VER DETALLE
  ========================================================= */

  const ver = async (evidencia) => {
    try {
      const respuesta = await api.get(
        `/evidencias/${evidencia.id_evidencia}`
      );

      setDetalle(respuesta.data);
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo abrir la evidencia'
      );
    }
  };


  /* =========================================================
     VERIFICAR INTEGRIDAD
  ========================================================= */

  const verificar = async (
    evidencia
  ) => {
    try {
      const { data } = await api.get(
        `/custodia/verificar-integridad/${evidencia.id_evidencia}`
      );

      alert(
        `${data.mensaje} (${data.estado})`
      );

      cargar();
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'Error al verificar'
      );

      cargar();
    }
  };


  /* =========================================================
     TRANSFERENCIA
  ========================================================= */

  const enviarTransfer = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    try {
      const { data } = await api.post(
        '/custodia/transferir',
        {
          id_evidencia:
            transfer.id_evidencia,

          id_recibe: Number(
            formulario.get('id_recibe')
          ),

          motivo:
            formulario.get('motivo'),

          observaciones:
            formulario.get(
              'observaciones'
            ),

          firma_entrega:
            formulario.get(
              'firma_entrega'
            ),
        }
      );

      alert(data.mensaje);

      setTransfer(null);

      cargar();
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'Error al transferir'
      );
    }
  };


  /* =========================================================
     SOLICITUD DE COPIA
  ========================================================= */

  const crearSolicitud = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    try {
      const { data } = await api.post(
        '/solicitudes',
        {
          id_evidencia:
            solicitud.id_evidencia,

          motivo:
            formulario.get('motivo'),

          tipo_acceso: 'Análisis',
        }
      );

      alert(data.mensaje);

      setSolicitud(null);
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'Error al solicitar acceso'
      );
    }
  };


  /* =========================================================
     ACTUALIZAR EVIDENCIA
  ========================================================= */

  const guardarEdicion = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    try {
      await api.put(
        `/evidencias/${editar.id_evidencia}`,
        {
          ubicacion_fisica:
            formulario.get(
              'ubicacion_fisica'
            ),

          ubicacion_logica:
            formulario.get(
              'ubicacion_logica'
            ),

          observaciones:
            formulario.get(
              'observaciones'
            ),

          // Solo permite la transición controlada ofrecida por el formulario.
          estado:
            formulario.get('estado') ||
            editar.estado,
        }
      );

      setEditar(null);

      cargar();
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo actualizar'
      );
    }
  };


  /* =========================================================
     REPORTE PDF
  ========================================================= */

  const reporte = async (evidencia) => {
    try {
      await descargarArchivo(
        `/reportes/evidencias/${evidencia.id_evidencia}/cadena-custodia.pdf`,
        `${evidencia.codigo}-cadena-custodia.pdf`
      );
    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo generar el reporte'
      );
    }
  };


  /* =========================================================
     RECEPTOR SELECCIONADO
  ========================================================= */

  const receptorSel = useMemo(
    () =>
      receptores.find(
        (receptor) =>
          String(
            receptor.id_usuario
          ) ===
          String(
            transfer?.id_recibe
          )
      ),

    [receptores, transfer]
  );


  /* =========================================================
     COLUMNAS
  ========================================================= */

  const cols = [
    {
      key: 'codigo',
      label: 'Código',
    },

    {
      key: 'incidente_codigo',
      label: 'Incidente',
    },

    {
      key: 'tipo_evidencia',
      label: 'Tipo',
    },

    {
      key: 'estado',
      label: 'Estado',
    },

    {
      key: 'estado_integridad',
      label: 'Integridad',

      render: (row) => (
        <span
          className={colorIntegridad(
            row.estado_integridad
          )}
        >
          ● {row.estado_integridad}
        </span>
      ),
    },

    {
      key: 'custodio_actual',
      label: 'Custodio actual',
    },

    {
      key: 'acciones',
      label: 'Acciones',

      render: (row) => (
        <div className="flex gap-3 flex-wrap">

          <button
            className="text-[#cbfffc]"
            onClick={() => ver(row)}
          >
            Detalle / QR
          </button>

          {tienePermiso(
            'Evidencias',
            'verificar_integridad'
          ) && (
            <button
              className="text-emerald-300"
              onClick={() =>
                verificar(row)
              }
            >
              Verificar
            </button>
          )}

          {tienePermiso(
            'Custodia',
            'transferir'
          ) &&
            row.id_custodio_actual ===
              usuario.id_usuario &&
            ['Recolectada', 'En Custodia'].includes(
              row.estado
            ) && (
              <button
                className="text-[#cbfffc]"
                onClick={() =>
                  setTransfer({
                    ...row,
                    id_recibe: '',
                  })
                }
              >
                Transferir
              </button>
            )}

          {tienePermiso(
            'Evidencias',
            'descargar'
          ) &&
            row.id_custodio_actual ===
              usuario.id_usuario && (
              <button
                className="text-[#cbfffc]"
                onClick={() =>
                  descargarArchivo(
                    `/evidencias/${row.id_evidencia}/descargar`,
                    `${row.codigo}-original`
                  )
                }
              >
                Original
              </button>
            )}

          {tienePermiso(
            'Evidencias',
            'editar'
          ) &&
            row.id_custodio_actual ===
              usuario.id_usuario &&
            !['Archivada', 'Comprometida'].includes(
              row.estado
            ) && (
              <button
                className="text-amber-200"
                onClick={() =>
                  setEditar(row)
                }
              >
                Ubicación
              </button>
            )}

          {tienePermiso(
            'Solicitudes',
            'crear'
          ) && (
            <button
              className="text-fuchsia-200"
              onClick={() =>
                setSolicitud(row)
              }
            >
              Solicitar copia
            </button>
          )}

          {tienePermiso(
            'Reportes',
            'generar'
          ) && (
            <button
              className="text-fuchsia-200"
              onClick={() =>
                reporte(row)
              }
            >
              PDF custodia
            </button>
          )}
        </div>
      ),
    },
  ];


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <PageHeader
        title="Evidencias"
        subtitle="Registro, integridad, QR y control de evidencia digital."
        actions={
          tienePermiso(
            'Evidencias',
            'crear'
          ) ? (
            <Button
              onClick={() => {
                setForm(initial);
                setArchivo(null);
                setModal(true);
              }}
            >
              Registrar evidencia
            </Button>
          ) : null
        }
      />

      <ErrorBox message={error} />

      <Panel>
        {rows.length ? (
          <Table
            columns={cols}
            rows={rows}
            keyField="id_evidencia"
          />
        ) : (
          <Empty />
        )}
      </Panel>


      {/* =====================================================
          MODAL - REGISTRAR EVIDENCIA
      ===================================================== */}

      {modal && (
        <Modal
          title="Registrar evidencia"
          onClose={() => {
            setModal(false);
            setArchivo(null);
          }}
          max="max-w-4xl"
        >
          <form
            onSubmit={submit}
            className="grid md:grid-cols-2 gap-4"
          >

            {/* INCIDENTE */}
            <Field label="Incidente">
              <select
                required
                className={inputClass}
                value={form.id_incidente}
                onChange={(e) =>
                  setForm({
                    ...form,
                    id_incidente:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Seleccione
                </option>

                {incidentes
                  .filter(
                    (incidente) =>
                      incidente.estado !==
                      'Cerrado'
                  )
                  .map((incidente) => (
                    <option
                      key={
                        incidente.id_incidente
                      }
                      value={
                        incidente.id_incidente
                      }
                    >
                      {incidente.codigo} -{' '}
                      {incidente.titulo}
                    </option>
                  ))}
              </select>
            </Field>


            {/* TIPO */}
            <Field label="Tipo de evidencia">
              <select
                required
                className={inputClass}
                value={
                  form.tipo_evidencia
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_evidencia:
                      e.target.value,
                  })
                }
              >
                {tipos.map((tipo) => (
                  <option
                    key={tipo}
                    value={tipo}
                  >
                    {tipo}
                  </option>
                ))}
              </select>
            </Field>


            {/* ORIGEN */}
            <Field label="Origen">
              <input
                required
                className={inputClass}
                placeholder="Ej. PC-ADMIN-01"
                value={form.origen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    origen:
                      e.target.value,
                  })
                }
              />
            </Field>


            {/* FECHA */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-silver-mist mb-2">
                Fecha de recolección
              </label>

              <input
                ref={fechaInputRef}
                type="datetime-local"
                max={obtenerFechaHoraLocal()}
                required
                className={inputClass}
                value={
                  form.fecha_recoleccion
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    fecha_recoleccion:
                      e.target.value,
                  })
                }
              />

              <button
                type="button"
                onClick={
                  usarFechaHoraActual
                }
                className="mt-2 text-xs text-cyan-200 hover:text-white underline underline-offset-4"
              >
                Usar fecha y hora actual
              </button>
            </div>


            {/* MÉTODO */}
            <Field label="Método de recolección">
              <select
                required
                className={inputClass}
                value={
                  form.metodo_recoleccion
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    metodo_recoleccion:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Selecciona un método
                </option>

                {metodosRecoleccion.map(
                  (metodo) => (
                    <option
                      key={metodo}
                      value={metodo}
                    >
                      {metodo}
                    </option>
                  )
                )}
              </select>
            </Field>


            {/* UBICACIÓN FÍSICA */}
            <Field label="Ubicación física">
              <select
                required
                className={inputClass}
                value={
                  form.ubicacion_fisica
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    ubicacion_fisica:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Selecciona una ubicación
                </option>

                {ubicacionesFisicas.map(
                  (ubicacion) => (
                    <option
                      key={ubicacion}
                      value={ubicacion}
                    >
                      {ubicacion}
                    </option>
                  )
                )}
              </select>
            </Field>


            {/* UBICACIÓN LÓGICA */}
            <Field label="Ubicación lógica">
              <select
                required
                className={inputClass}
                value={
                  form.ubicacion_logica
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    ubicacion_logica:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Selecciona una ubicación
                </option>

                {ubicacionesLogicas.map(
                  (ubicacion) => (
                    <option
                      key={ubicacion}
                      value={ubicacion}
                    >
                      {ubicacion}
                    </option>
                  )
                )}
              </select>
            </Field>


            {/* ESPACIO VACÍO PARA ORDEN VISUAL */}
            <div />


            {/* ARCHIVO ORIGINAL */}
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-silver-mist mb-2">
                Archivo original
              </div>

              <input
                ref={archivoInputRef}
                type="file"
                className="hidden"
                onChange={
                  seleccionarArchivo
                }
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                <button
                  type="button"
                  onClick={
                    abrirSelectorArchivo
                  }
                  className="w-fit rounded-lg border border-white/20 bg-liquid-deep/60 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Seleccionar archivo
                </button>

                <span className="text-sm text-silver-mist">
                  {archivo
                    ? '1 archivo seleccionado'
                    : 'Ningún archivo seleccionado'}
                </span>
              </div>


              {archivo && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-liquid-deep/60 px-3 py-2">

                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">
                      {archivo.name}
                    </div>

                    <div className="text-xs text-silver-mist">
                      {(
                        archivo.size /
                        1024
                      ).toFixed(1)}{' '}
                      KB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      quitarArchivo
                    }
                    className="shrink-0 rounded-md border border-red-300/30 px-3 py-1.5 text-xs uppercase tracking-wider text-red-200 transition hover:bg-red-950/40"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>


            {/* DESCRIPCIÓN */}
            <div className="md:col-span-2">
              <Field label="Descripción">
                <textarea
                  required
                  className={inputClass}
                  rows="3"
                  value={
                    form.descripcion
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      descripcion:
                        e.target.value,
                    })
                  }
                />
              </Field>
            </div>


            {/* OBSERVACIONES */}
            <div className="md:col-span-2">
              <Field label="Observaciones">
                <textarea
                  className={inputClass}
                  rows="2"
                  value={
                    form.observaciones
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      observaciones:
                        e.target.value,
                    })
                  }
                />
              </Field>
            </div>


            {/* BOTÓN REGISTRAR */}
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">
                Registrar y calcular SHA-256
              </Button>
            </div>

          </form>
        </Modal>
      )}


      {/* =====================================================
          MODAL - DETALLE
      ===================================================== */}

      {detalle && (
        <Modal
          title={`Evidencia ${detalle.codigo}`}
          onClose={() =>
            setDetalle(null)
          }
          max="max-w-4xl"
        >
          <div className="grid md:grid-cols-[1fr_220px] gap-6">

            <div className="grid sm:grid-cols-2 gap-4 text-sm">

              <div>
                <span className="text-silver-mist">
                  Incidente
                </span>

                <div>
                  {
                    detalle.incidente_codigo
                  }{' '}
                  -{' '}
                  {
                    detalle.incidente_titulo
                  }
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Estado
                </span>

                <div>
                  {detalle.estado}
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Integridad
                </span>

                <div
                  className={colorIntegridad(
                    detalle.estado_integridad
                  )}
                >
                  ●{' '}
                  {
                    detalle.estado_integridad
                  }
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Custodio actual
                </span>

                <div>
                  {
                    detalle.custodio_actual
                  }
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Fecha recolección
                </span>

                <div>
                  {fechaLocal(
                    detalle.fecha_recoleccion
                  )}
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Origen
                </span>

                <div>
                  {detalle.origen}
                </div>
              </div>


              <div className="sm:col-span-2">
                <span className="text-silver-mist">
                  Hash SHA-256 original
                  (inalterable)
                </span>

                <div className="font-mono text-xs break-all mt-1">
                  {
                    detalle.hash_original
                  }
                </div>
              </div>


              <div className="sm:col-span-2">
                <span className="text-silver-mist">
                  Observaciones
                </span>

                <div>
                  {detalle.observaciones ||
                    '—'}
                </div>
              </div>
            </div>


            <div className="bg-white rounded-xl p-3 h-fit">

              {detalle.codigo_qr ? (
                <img
                  src={detalle.codigo_qr}
                  alt={`QR ${detalle.codigo}`}
                  className="w-full"
                />
              ) : (
                <div className="text-black">
                  Sin QR
                </div>
              )}

              <div className="text-black text-center text-xs font-mono mt-2">
                {detalle.codigo}
              </div>
            </div>
          </div>
        </Modal>
      )}


      {/* =====================================================
          MODAL - TRANSFERENCIA
      ===================================================== */}

      {transfer && (
        <Modal
          title={`Transferir ${transfer.codigo}`}
          onClose={() =>
            setTransfer(null)
          }
        >
          <form
            onSubmit={enviarTransfer}
            className="space-y-4"
          >

            <div className="text-sm text-silver-mist">
              Área de quien entrega:{' '}
              <strong className="text-white">
                {usuario.area ||
                  'Sin asignar'}
              </strong>
              . Si el receptor pertenece a
              otra área, el sistema exigirá
              autorización del Supervisor
              automáticamente.
            </div>


            <Field label="Destinatario autorizado">

              <select
                name="id_recibe"
                required
                className={inputClass}
                value={
                  transfer.id_recibe ||
                  ''
                }
                onChange={(e) =>
                  setTransfer({
                    ...transfer,
                    id_recibe:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Seleccione
                </option>

                {receptores
                  .filter(
                    (receptor) =>
                      receptor.id_usuario !==
                      usuario.id_usuario
                  )
                  .map((receptor) => (
                    <option
                      key={
                        receptor.id_usuario
                      }
                      value={
                        receptor.id_usuario
                      }
                    >
                      {receptor.nombre}{' '}
                      {receptor.apellido} ·{' '}
                      {
                        receptor.rol_nombre
                      }{' '}
                      ·{' '}
                      {receptor.area ||
                        'Sin área'}
                    </option>
                  ))}
              </select>
            </Field>


            {receptorSel && (
              <div
                className={`text-sm rounded-lg p-3 ${
                  usuario.area &&
                  receptorSel.area ===
                    usuario.area
                    ? 'bg-emerald-500/10 text-emerald-200'
                    : 'bg-amber-500/10 text-amber-200'
                }`}
              >
                {usuario.area &&
                receptorSel.area ===
                  usuario.area
                  ? 'Misma área: no requiere autorización previa.'
                  : 'Área diferente o no definida: requerirá autorización del Supervisor.'}
              </div>
            )}


            <Field label="Motivo">
              <textarea
                name="motivo"
                required
                rows="3"
                className={inputClass}
              />
            </Field>


            <Field label="Observaciones">
              <textarea
                name="observaciones"
                rows="2"
                className={inputClass}
              />
            </Field>


            <Field label="Firma electrónica de entrega (nombre completo / confirmación)">
              <input
                name="firma_entrega"
                required
                minLength="4"
                className={inputClass}
              />
            </Field>


            <div className="flex justify-end">
              <Button type="submit">
                Firmar y enviar
              </Button>
            </div>
          </form>
        </Modal>
      )}


      {/* =====================================================
          MODAL - SOLICITUD COPIA
      ===================================================== */}

      {solicitud && (
        <Modal
          title={`Solicitar copia autorizada de ${solicitud.codigo}`}
          onClose={() =>
            setSolicitud(null)
          }
        >
          <form
            onSubmit={crearSolicitud}
            className="space-y-4"
          >

            <div className="text-sm text-silver-mist">
              El Supervisor revisará la
              solicitud. Si la aprueba, el
              sistema generará una copia
              diferenciada del archivo
              original; el análisis nunca
              se realizará sobre el
              original.
            </div>


            <Field label="Motivo del análisis">
              <textarea
                name="motivo"
                required
                rows="4"
                className={inputClass}
              />
            </Field>


            <div className="flex justify-end">
              <Button type="submit">
                Enviar solicitud
              </Button>
            </div>
          </form>
        </Modal>
      )}


      {/* =====================================================
          MODAL - EDITAR UBICACIÓN
      ===================================================== */}

      {editar && (
        <Modal
          title={`Actualizar custodia de ${editar.codigo}`}
          onClose={() =>
            setEditar(null)
          }
        >
          <form
            onSubmit={guardarEdicion}
            className="space-y-4"
          >

            <Field label="Ubicación física">

              <select
                name="ubicacion_fisica"
                defaultValue={
                  editar.ubicacion_fisica ||
                  ''
                }
                className={inputClass}
              >
                <option value="">
                  Seleccione
                </option>

                {ubicacionesFisicas.map(
                  (ubicacion) => (
                    <option
                      key={ubicacion}
                      value={ubicacion}
                    >
                      {ubicacion}
                    </option>
                  )
                )}
              </select>
            </Field>


            <Field label="Ubicación lógica">

              <select
                name="ubicacion_logica"
                defaultValue={
                  editar.ubicacion_logica ||
                  ''
                }
                className={inputClass}
              >
                <option value="">
                  Seleccione
                </option>

                {ubicacionesLogicas.map(
                  (ubicacion) => (
                    <option
                      key={ubicacion}
                      value={ubicacion}
                    >
                      {ubicacion}
                    </option>
                  )
                )}
              </select>
            </Field>


            <Field label="Estado">
              <select
                name="estado"
                defaultValue={editar.estado}
                className={inputClass}
              >
                <option value={editar.estado}>
                  {editar.estado}
                </option>

                {editar.estado === 'En Custodia' &&
                  editar.estado_integridad === 'Integra' && (
                    <option value="Archivada">
                      Archivada
                    </option>
                  )}
              </select>
            </Field>


            <Field label="Observaciones">
              <textarea
                name="observaciones"
                defaultValue={
                  editar.observaciones ||
                  ''
                }
                rows="3"
                className={inputClass}
              />
            </Field>


            <div className="flex justify-end">
              <Button type="submit">
                Guardar
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </>
  );
}