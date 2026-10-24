import {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

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
import { fechaServidorGuatemala } from '../utils/fecha';


export function Analisis() {
  const { tienePermiso } = useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const [copias, setCopias] = useState([]);

  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const [error, setError] = useState('');

  /* Archivos del nuevo análisis */
  const [archivos, setArchivos] = useState([]);
  const archivoInputRef = useRef(null);


  /* ======================================================
     CARGAR ANÁLISIS
  ====================================================== */

  const cargar = async () => {
    try {
      setError('');

      const respuesta = await api.get('/analisis');

      setRows(respuesta.data);
    } catch (e) {
      setError(
        e.response?.data?.mensaje ||
          'No se pudieron cargar los análisis'
      );
    }
  };


  /* ======================================================
     CARGA INICIAL
  ====================================================== */

  useEffect(() => {
    cargar();

    if (
      tienePermiso(
        'Analisis',
        'crear'
      )
    ) {
      api
        .get('/copias')
        .then((respuesta) => {
          setCopias(respuesta.data);
        })
        .catch(() => {});
    }
  }, []);


  /* ======================================================
     ARCHIVOS ADJUNTOS
  ====================================================== */

  const abrirSelectorArchivos = () => {
    archivoInputRef.current?.click();
  };


  const seleccionarArchivos = (event) => {
    const nuevos = Array.from(
      event.target.files || []
    );

    if (!nuevos.length) {
      return;
    }

    setArchivos((actuales) => {
      const combinados = [
        ...actuales,
        ...nuevos,
      ];

      if (combinados.length > 5) {
        alert(
          'Solo puedes adjuntar un máximo de 5 archivos.'
        );

        return combinados.slice(
          0,
          5
        );
      }

      return combinados;
    });

    /*
     * Permite seleccionar nuevamente el mismo
     * archivo después de haberlo quitado.
     */
    event.target.value = '';
  };


  const quitarArchivo = (indice) => {
    setArchivos((actuales) =>
      actuales.filter(
        (_, i) => i !== indice
      )
    );

    if (archivoInputRef.current) {
      archivoInputRef.current.value =
        '';
    }
  };


  /* ======================================================
     REGISTRAR ANÁLISIS
  ====================================================== */

  const submit = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    const fd = new FormData();

    [
      'id_copia',
      'herramientas',
      'procedimiento',
      'hallazgos',
      'conclusiones',
    ].forEach((campo) => {
      fd.append(
        campo,
        formulario.get(campo)
      );
    });

    /*
     * Conservamos el nombre "adjuntos"
     * porque el backend actual ya lo espera así.
     */
    archivos.forEach((archivo) => {
      fd.append(
        'adjuntos',
        archivo
      );
    });

    try {
      const { data } = await api.post(
        '/analisis',
        fd,
        {
          headers: {
            'Content-Type':
              'multipart/form-data',
          },
        }
      );

      alert(data.mensaje);

      setModal(false);

      setArchivos([]);

      if (archivoInputRef.current) {
        archivoInputRef.current.value =
          '';
      }

      cargar();

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'Error al registrar análisis'
      );
    }
  };


  /* ======================================================
     ACTUALIZAR / FINALIZAR
  ====================================================== */

  const finalizar = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    try {
      const { data } = await api.put(
        `/analisis/${editar.id_analisis}`,
        {
          herramientas:
            formulario.get(
              'herramientas'
            ),

          procedimiento:
            formulario.get(
              'procedimiento'
            ),

          hallazgos:
            formulario.get(
              'hallazgos'
            ),

          conclusiones:
            formulario.get(
              'conclusiones'
            ),

          finalizar:
            formulario.get(
              'finalizar'
            ) === 'on',
        }
      );

      alert(data.mensaje);

      setEditar(null);

      cargar();

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo actualizar'
      );
    }
  };


  /* ======================================================
     COLUMNAS
  ====================================================== */

  const cols = [
    {
      key: 'id_analisis',
      label: '#',
    },

    {
      key: 'evidencia_codigo',
      label: 'Evidencia',
    },

    {
      key: 'copia_codigo',
      label: 'Copia autorizada',
    },

    {
      key: 'analista',
      label: 'Analista',
    },

    {
      key: 'herramientas',
      label: 'Herramientas',
    },

    {
      key: 'hallazgos',
      label: 'Hallazgos',
    },

    {
      key: 'fecha_inicio',
      label: 'Inicio',

      render: (row) =>
        fechaServidorGuatemala(
          row.fecha_inicio
        ),
    },

    {
      key: 'fecha_fin',
      label: 'Fin',

      render: (row) =>
        row.fecha_fin
          ? fechaServidorGuatemala(
              row.fecha_fin
            )
          : 'En proceso',
    },

    {
      key: 'acciones',
      label: 'Acciones',

      render: (row) => (
        <div className="flex gap-3">

          <button
            type="button"
            className="text-[#cbfffc]"
            onClick={() =>
              setDetalle(row)
            }
          >
            Detalle
          </button>

          {tienePermiso(
            'Analisis',
            'editar'
          ) &&
            !row.fecha_fin && (
              <button
                type="button"
                className="text-amber-200"
                onClick={() =>
                  setEditar(row)
                }
              >
                Editar/finalizar
              </button>
            )}
        </div>
      ),
    },
  ];


  return (
    <>
      {/* ==================================================
          ENCABEZADO
      ================================================== */}

      <PageHeader
        title="Análisis Forense"
        subtitle="El análisis se realiza exclusivamente sobre copias autorizadas."
        actions={
          tienePermiso(
            'Analisis',
            'crear'
          ) ? (
            <Button
              onClick={() => {
                setArchivos([]);
                setModal(true);
              }}
            >
              Nuevo análisis
            </Button>
          ) : null
        }
      />


      <ErrorBox message={error} />


      {/* ==================================================
          COPIAS AUTORIZADAS
      ================================================== */}

      {tienePermiso(
        'Analisis',
        'crear'
      ) && (
        <Panel className="mb-6">

          <h2 className="text-lg mb-3">
            Mis copias autorizadas
          </h2>

          {copias.length ? (
            <div className="grid md:grid-cols-2 gap-3">

              {copias.map((copia) => (
                <div
                  key={copia.id_copia}
                  className="border border-white/10 rounded-lg p-3"
                >
                  <div className="font-medium">
                    {copia.codigo}
                  </div>

                  <div className="text-sm text-silver-mist">
                    Original:{' '}
                    {
                      copia.evidencia_codigo
                    }
                  </div>

                  <div className="font-mono text-xs break-all mt-2">
                    SHA-256 copia:{' '}
                    {copia.hash_copia}
                  </div>

                  <button
                    type="button"
                    className="text-[#cbfffc] text-sm mt-2"
                    onClick={() =>
                      descargarArchivo(
                        `/copias/${copia.id_copia}/descargar`,
                        `${copia.codigo}-copia`
                      )
                    }
                  >
                    Descargar copia autorizada
                  </button>
                </div>
              ))}

            </div>
          ) : (
            <div className="text-silver-mist">
              Aún no tienes copias
              autorizadas. Solicítalas desde
              Evidencias.
            </div>
          )}

        </Panel>
      )}


      {/* ==================================================
          TABLA
      ================================================== */}

      <Panel>

        {rows.length ? (
          <Table
            columns={cols}
            rows={rows}
            keyField="id_analisis"
          />
        ) : (
          <Empty />
        )}

      </Panel>


      {/* ==================================================
          NUEVO ANÁLISIS
      ================================================== */}

      {modal && (
        <Modal
          title="Nuevo análisis forense"
          onClose={() => {
            setModal(false);
            setArchivos([]);
          }}
          max="max-w-3xl"
        >

          <form
            onSubmit={submit}
            className="space-y-4"
          >

            {/* COPIA */}
            <Field label="Copia autorizada">

              <select
                name="id_copia"
                required
                className={inputClass}
              >

                <option value="">
                  Seleccione
                </option>

                {copias
                  .filter(
                    (copia) =>
                      copia.estado ===
                      'Activa'
                  )
                  .map((copia) => (
                    <option
                      key={
                        copia.id_copia
                      }
                      value={
                        copia.id_copia
                      }
                    >
                      {copia.codigo} ·
                      original{' '}
                      {
                        copia.evidencia_codigo
                      }
                    </option>
                  ))}

              </select>

            </Field>


            {/* HERRAMIENTAS */}
            <Field label="Herramientas">

              <textarea
                name="herramientas"
                required
                rows="2"
                className={inputClass}
              />

            </Field>


            {/* PROCEDIMIENTO */}
            <Field label="Procedimiento">

              <textarea
                name="procedimiento"
                required
                rows="4"
                className={inputClass}
              />

            </Field>


            {/* HALLAZGOS */}
            <Field label="Hallazgos">

              <textarea
                name="hallazgos"
                required
                rows="4"
                className={inputClass}
              />

            </Field>


            {/* CONCLUSIONES */}
            <Field label="Conclusiones">

              <textarea
                name="conclusiones"
                required
                rows="4"
                className={inputClass}
              />

            </Field>


            {/* ============================================
                INFORMES TÉCNICOS
            ============================================ */}

            <div>

              <div className="text-xs uppercase tracking-wide text-silver-mist mb-2">
                Informes técnicos adjuntos

                <span className="ml-1 normal-case">
                  (máximo 5 archivos)
                </span>
              </div>


              {/* INPUT REAL OCULTO */}

              <input
                ref={archivoInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={
                  seleccionarArchivos
                }
              />


              {/* BOTÓN PERSONALIZADO */}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                <button
                  type="button"
                  onClick={
                    abrirSelectorArchivos
                  }
                  className="w-fit rounded-lg border border-white/20 bg-liquid-deep/60 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Elegir archivos
                </button>


                <span className="text-sm text-silver-mist">

                  {archivos.length === 0
                    ? 'Ningún archivo seleccionado'
                    : archivos.length ===
                        1
                      ? '1 archivo seleccionado'
                      : `${archivos.length} archivos seleccionados`}

                </span>

              </div>


              {/* LISTA */}

              {archivos.length > 0 && (

                <div className="mt-3 space-y-2">

                  {archivos.map(
                    (
                      archivo,
                      indice
                    ) => (

                      <div
                        key={`${archivo.name}-${archivo.lastModified}-${indice}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-liquid-deep/60 px-3 py-2"
                      >

                        <div className="min-w-0">

                          <div className="truncate text-sm text-white">
                            {
                              archivo.name
                            }
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
                          onClick={() =>
                            quitarArchivo(
                              indice
                            )
                          }
                          className="shrink-0 rounded-md border border-red-300/30 px-3 py-1.5 text-xs uppercase tracking-wider text-red-200 transition hover:bg-red-950/40"
                        >
                          Quitar
                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>


            {/* REGISTRAR */}

            <div className="flex justify-end">

              <Button type="submit">
                Registrar análisis
              </Button>

            </div>

          </form>

        </Modal>
      )}


      {/* ==================================================
          DETALLE
      ================================================== */}

      {detalle && (
        <Modal
          title={`Detalle análisis #${detalle.id_analisis}`}
          onClose={() =>
            setDetalle(null)
          }
          max="max-w-3xl"
        >

          <div className="space-y-4 text-sm">

            <div className="grid md:grid-cols-2 gap-4">

              <div>
                <span className="text-silver-mist">
                  Evidencia
                </span>

                <div>
                  {
                    detalle.evidencia_codigo
                  }
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Copia autorizada
                </span>

                <div>
                  {detalle.copia_codigo ||
                    '—'}
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Analista
                </span>

                <div>
                  {detalle.analista}
                </div>
              </div>


              <div>
                <span className="text-silver-mist">
                  Periodo
                </span>

                <div>
                  {fechaServidorGuatemala(
                    detalle.fecha_inicio
                  )}

                  {' → '}

                  {detalle.fecha_fin
                    ? fechaServidorGuatemala(
                        detalle.fecha_fin
                      )
                    : 'En proceso'}
                </div>
              </div>

            </div>


            <div>
              <span className="text-silver-mist">
                Herramientas
              </span>

              <div>
                {
                  detalle.herramientas
                }
              </div>
            </div>


            <div>
              <span className="text-silver-mist">
                Procedimiento
              </span>

              <div className="whitespace-pre-wrap">
                {
                  detalle.procedimiento
                }
              </div>
            </div>


            <div>
              <span className="text-silver-mist">
                Hallazgos
              </span>

              <div className="whitespace-pre-wrap">
                {detalle.hallazgos}
              </div>
            </div>


            <div>
              <span className="text-silver-mist">
                Conclusiones
              </span>

              <div className="whitespace-pre-wrap">
                {
                  detalle.conclusiones
                }
              </div>
            </div>


            {/* ADJUNTOS */}

            <div>

              <span className="text-silver-mist">
                Informes técnicos
              </span>

              <div className="mt-2 space-y-2">

                {(() => {
                  let adjuntos = [];

                  try {
                    adjuntos =
                      JSON.parse(
                        detalle.archivos_adjuntos ||
                          '[]'
                      );
                  } catch {
                    adjuntos = [];
                  }

                  return adjuntos.length
                    ? adjuntos.map(
                        (
                          archivo,
                          indice
                        ) => (
                          <button
                            type="button"
                            key={indice}
                            className="block text-[#cbfffc]"
                            onClick={() =>
                              descargarArchivo(
                                `/analisis/${detalle.id_analisis}/adjuntos/${indice}/descargar`,
                                archivo.nombre
                              )
                            }
                          >
                            Descargar{' '}
                            {
                              archivo.nombre
                            }
                          </button>
                        )
                      )
                    : (
                      <span>
                        Sin adjuntos
                      </span>
                    );
                })()}

              </div>

            </div>

          </div>

        </Modal>
      )}


      {/* ==================================================
          EDITAR / FINALIZAR
      ================================================== */}

      {editar && (
        <Modal
          title={`Análisis #${editar.id_analisis}`}
          onClose={() =>
            setEditar(null)
          }
        >

          <form
            onSubmit={finalizar}
            className="space-y-4"
          >

            <Field label="Herramientas">
              <textarea
                name="herramientas"
                defaultValue={
                  editar.herramientas
                }
                rows="2"
                className={inputClass}
              />
            </Field>


            <Field label="Procedimiento">
              <textarea
                name="procedimiento"
                defaultValue={
                  editar.procedimiento
                }
                rows="3"
                className={inputClass}
              />
            </Field>


            <Field label="Hallazgos">
              <textarea
                name="hallazgos"
                defaultValue={
                  editar.hallazgos
                }
                rows="3"
                className={inputClass}
              />
            </Field>


            <Field label="Conclusiones">
              <textarea
                name="conclusiones"
                defaultValue={
                  editar.conclusiones
                }
                rows="3"
                className={inputClass}
              />
            </Field>


            <label className="flex items-center gap-2">

              <input
                name="finalizar"
                type="checkbox"
              />

              Finalizar análisis y dejarlo
              de solo lectura

            </label>


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