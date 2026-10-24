import {
  useContext,
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { ModalIncidente } from '../components/ModalIncidente';
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


export function Incidentes() {
  const { tienePermiso } = useContext(AuthContext);

  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [cierre, setCierre] = useState(null);
  const [error, setError] = useState('');


  /* =====================================================
     CARGAR INCIDENTES
  ===================================================== */

  const cargar = async () => {
    try {
      setError('');

      const respuesta = await api.get(
        '/incidentes'
      );

      setRows(respuesta.data);

    } catch (e) {
      setError(
        e.response?.data?.mensaje ||
          'No se pudieron cargar los incidentes'
      );
    }
  };


  useEffect(() => {
    cargar();
  }, []);


  /* =====================================================
     VER DETALLE
  ===================================================== */

  const ver = async (incidente) => {
    try {
      const respuesta = await api.get(
        `/incidentes/${incidente.id_incidente}`
      );

      setDetalle(respuesta.data);

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo abrir el incidente'
      );
    }
  };


  /* =====================================================
     CERRAR CASO

     IMPORTANTE:
     Ya NO descarga automáticamente el PDF.
  ===================================================== */

  const cerrar = async (e) => {
    e.preventDefault();

    const formulario = new FormData(
      e.currentTarget
    );

    try {
      const actual = cierre;

      const { data } = await api.put(
        `/incidentes/${actual.id_incidente}/cerrar`,
        {
          observaciones:
            formulario.get(
              'observaciones'
            ),
        }
      );

      alert(
        `${data.mensaje}\n\nEl reporte final ya está disponible en la opción "PDF FINAL".`
      );

      setCierre(null);

      await cargar();

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo cerrar el caso'
      );
    }
  };


  /* =====================================================
     REPORTE ÚNICO

     ABIERTO:
       INC-XXXX-trazabilidad.pdf

     CERRADO:
       INC-XXXX-trazabilidad-final.pdf
  ===================================================== */

  const reporte = async (incidente) => {
    try {
      const esFinal =
        incidente.estado === 'Cerrado';

      const nombreArchivo =
        esFinal
          ? `${incidente.codigo}-trazabilidad-final.pdf`
          : `${incidente.codigo}-trazabilidad.pdf`;

      await descargarArchivo(
        `/reportes/incidentes/${incidente.id_incidente}/trazabilidad.pdf`,
        nombreArchivo
      );

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo generar el reporte'
      );
    }
  };


  /* =====================================================
     COLUMNAS
  ===================================================== */

  const cols = [
    {
      key: 'codigo',
      label: 'Código',
    },

    {
      key: 'titulo',
      label: 'Título',
    },

    {
      key: 'tipo_incidente',
      label: 'Tipo',
    },

    {
      key: 'severidad',
      label: 'Severidad',
    },

    {
      key: 'estado',
      label: 'Estado',
    },

    {
      key: 'total_evidencias',
      label: 'Evidencias',
    },

    {
      key: 'acciones',
      label: 'Acciones',

      render: (incidente) => (
        <div className="flex gap-3 flex-wrap">

          {/* DETALLE */}
          <button
            type="button"
            className="text-[#cbfffc]"
            onClick={() =>
              ver(incidente)
            }
          >
            Detalle
          </button>


          {/* REGISTRAR EVIDENCIA */}
          {tienePermiso(
            'Evidencias',
            'crear'
          ) &&
            incidente.estado !==
              'Cerrado' && (
              <button
                type="button"
                className="text-[#cbfffc]"
                onClick={() =>
                  nav(
                    `/evidencias?incidente=${incidente.id_incidente}&nuevo=1`
                  )
                }
              >
                Registrar evidencia
              </button>
            )}


          {/* CERRAR CASO */}
          {tienePermiso(
            'Incidentes',
            'cerrar'
          ) &&
            incidente.estado !==
              'Cerrado' && (
              <button
                type="button"
                className="text-amber-200"
                onClick={() =>
                  setCierre(
                    incidente
                  )
                }
              >
                Cerrar caso
              </button>
            )}


          {/* REPORTE ÚNICO */}
          {tienePermiso(
            'Reportes',
            'generar'
          ) && (
            <button
              type="button"
              className={
                incidente.estado ===
                'Cerrado'
                  ? 'text-emerald-300'
                  : 'text-fuchsia-200'
              }
              onClick={() =>
                reporte(incidente)
              }
            >
              {incidente.estado ===
              'Cerrado'
                ? 'PDF FINAL'
                : 'PDF trazabilidad'}
            </button>
          )}

        </div>
      ),
    },
  ];


  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <PageHeader
        title="Incidentes"
        subtitle="Registro y seguimiento de incidentes de seguridad."
        actions={
          tienePermiso(
            'Incidentes',
            'crear'
          ) ? (
            <Button
              onClick={() =>
                setModal(true)
              }
            >
              Registrar incidente
            </Button>
          ) : null
        }
      />


      <ErrorBox message={error} />


      {/* TABLA */}

      <Panel>
        {rows.length ? (
          <Table
            columns={cols}
            rows={rows}
            keyField="id_incidente"
          />
        ) : (
          <Empty />
        )}
      </Panel>


      {/* =================================================
          REGISTRAR INCIDENTE
      ================================================= */}

      {modal && (
        <ModalIncidente
          onClose={() =>
            setModal(false)
          }
          onGuardado={cargar}
        />
      )}


      {/* =================================================
          DETALLE
      ================================================= */}

      {detalle && (
        <Modal
          title={`Incidente ${detalle.codigo}`}
          onClose={() =>
            setDetalle(null)
          }
          max="max-w-3xl"
        >

          <div className="grid md:grid-cols-2 gap-4 text-sm">

            <div>
              <span className="text-silver-mist">
                Título
              </span>

              <div>
                {detalle.titulo}
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
                Reportante
              </span>

              <div>
                {detalle.reportante_nombre}{' '}
                {detalle.reportante_apellido}
              </div>
            </div>


            <div>
              <span className="text-silver-mist">
                Fecha detección
              </span>

              <div>
                {fechaLocal(
                  detalle.fecha_deteccion
                )}
              </div>
            </div>


            <div className="md:col-span-2">
              <span className="text-silver-mist">
                Descripción
              </span>

              <div>
                {detalle.descripcion}
              </div>
            </div>


            <div className="md:col-span-2">
              <span className="text-silver-mist">
                Observaciones
              </span>

              <div>
                {detalle.observaciones ||
                  '—'}
              </div>
            </div>

          </div>


          {/* ADJUNTOS PRELIMINARES */}

          <h3 className="mt-6 mb-3 font-medium">
            Información preliminar adjunta
          </h3>


          {detalle.adjuntos?.length ? (

            <div className="space-y-2">

              {detalle.adjuntos.map(
                (archivo) => (

                  <div
                    key={
                      archivo.id_adjunto
                    }
                    className="flex justify-between items-center gap-3 border border-white/10 rounded-lg p-3"
                  >

                    <span className="truncate">
                      {
                        archivo.nombre_original
                      }
                    </span>


                    <button
                      type="button"
                      className="text-[#cbfffc]"
                      onClick={() =>
                        descargarArchivo(
                          `/incidentes/${detalle.id_incidente}/adjuntos/${archivo.id_adjunto}/descargar`,
                          archivo.nombre_original
                        )
                      }
                    >
                      Descargar
                    </button>

                  </div>

                )
              )}

            </div>

          ) : (

            <div className="text-silver-mist">
              Sin adjuntos.
            </div>

          )}

        </Modal>
      )}


      {/* =================================================
          CERRAR CASO
      ================================================= */}

      {cierre && (
        <Modal
          title={`Cerrar caso ${cierre.codigo}`}
          onClose={() =>
            setCierre(null)
          }
        >

          <form
            onSubmit={cerrar}
            className="space-y-4"
          >

            <div className="text-sm text-silver-mist">
              El sistema verificará
              automáticamente que exista
              evidencia, que todas las
              evidencias estén en estado
              final y que no haya alertas
              activas ni evidencia
              comprometida.
            </div>


            <Field label="Observaciones de cierre">

              <textarea
                name="observaciones"
                required
                rows="4"
                className={inputClass}
              />

            </Field>


            <div className="flex justify-end">

              <Button type="submit">
                Validar y cerrar
              </Button>

            </div>

          </form>

        </Modal>
      )}

    </>
  );
}