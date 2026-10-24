import { useEffect, useState } from 'react';
import api from '../services/api';

import { Button } from '../components/ui/Button';

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


/* =========================================================
   COMPONENTE
========================================================= */

export function Auditoria() {
  const [rows, setRows] =
    useState([]);

  const [
    opciones,
    setOpciones,
  ] = useState({
    usuarios: [],
    modulos: [],
    acciones: [],
  });


  const [f, setF] =
    useState({
      desde: '',
      hasta: '',
      id_usuario: '',
      modulo: '',
      accion: '',
    });


  const [error, setError] =
    useState('');


  /* =====================================================
     CONSTRUIR QUERY DE FILTROS
  ===================================================== */

  const query = () => {
    const q =
      new URLSearchParams();


    Object.entries(f).forEach(
      ([key, value]) => {
        if (value) {
          q.set(
            key,
            value
          );
        }
      }
    );


    return q.toString();
  };


  /* =====================================================
     CARGAR BITÁCORA
  ===================================================== */

  const cargar = async () => {
    try {
      setError('');


      const filtros =
        query();


      const respuesta =
        await api.get(
          `/auditoria${
            filtros
              ? `?${filtros}`
              : ''
          }`
        );


      setRows(
        respuesta.data
      );

    } catch (e) {
      setError(
        e.response?.data?.mensaje ||
          'No se pudo cargar la bitácora'
      );
    }
  };


  /* =====================================================
     CARGA INICIAL
  ===================================================== */

  useEffect(() => {
    cargar();


    api
      .get(
        '/auditoria/opciones'
      )
      .then((r) =>
        setOpciones(
          r.data
        )
      )
      .catch(() => {});

  }, []);


  /* =====================================================
     EXPORTAR PDF
  ===================================================== */

  const exportar = async () => {
    try {
      const filtros =
        query();


      await descargarArchivo(
        `/reportes/auditoria.pdf${
          filtros
            ? `?${filtros}`
            : ''
        }`,

        'bitacora-auditoria.pdf'
      );

    } catch (e) {
      alert(
        e.response?.data?.mensaje ||
          'No se pudo exportar'
      );
    }
  };


  /* =====================================================
     COLUMNAS
  ===================================================== */

  const cols = [
    {
      key: 'fecha_hora',
      label: 'Fecha',

      render: (r) =>
        fechaServidorGuatemala(
          r.fecha_hora
        ),
    },


    {
      key: 'nombre',
      label: 'Usuario',

      render: (r) =>
        `${
          r.nombre || ''
        } ${
          r.apellido || ''
        }`.trim() ||
        'Sistema',
    },


    {
      key: 'accion',
      label: 'Acción',
    },


    {
      key: 'modulo',
      label: 'Módulo',
    },


    {
      key: 'tipo_entidad',
      label: 'Entidad',
    },


    {
      key:
        'id_entidad_afectada',

      label: 'ID',
    },


    {
      key: 'detalles',
      label: 'Detalles',
    },


    {
      key: 'direccion_ip',
      label: 'IP',
    },
  ];


  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Bitácora inalterable, filtros y exportación PDF."

        actions={
          <div className="flex gap-2">

            <Button
              variant="ghost"
              onClick={cargar}
            >
              Aplicar filtros
            </Button>


            <Button
              onClick={exportar}
            >
              Exportar PDF
            </Button>

          </div>
        }
      />


      <ErrorBox
        message={error}
      />


      {/* =================================================
          FILTROS
      ================================================= */}

      <Panel className="mb-5">

        <div className="grid md:grid-cols-5 gap-3">

          {/* DESDE */}

          <Field label="Desde">

            <input
              type="datetime-local"
              className={inputClass}
              value={f.desde}

              onChange={(e) =>
                setF({
                  ...f,

                  desde:
                    e.target.value,
                })
              }
            />

          </Field>


          {/* HASTA */}

          <Field label="Hasta">

            <input
              type="datetime-local"
              className={inputClass}
              value={f.hasta}

              onChange={(e) =>
                setF({
                  ...f,

                  hasta:
                    e.target.value,
                })
              }
            />

          </Field>


          {/* USUARIO */}

          <Field label="Usuario">

            <select
              className={inputClass}
              value={
                f.id_usuario
              }

              onChange={(e) =>
                setF({
                  ...f,

                  id_usuario:
                    e.target.value,
                })
              }
            >

              <option value="">
                Todos
              </option>


              {opciones.usuarios.map(
                (u) => (

                  <option
                    key={
                      u.id_usuario
                    }

                    value={
                      u.id_usuario
                    }
                  >
                    {u.nombre}{' '}
                    {u.apellido}
                  </option>

                )
              )}

            </select>

          </Field>


          {/* MÓDULO */}

          <Field label="Módulo">

            <select
              className={inputClass}
              value={f.modulo}

              onChange={(e) =>
                setF({
                  ...f,

                  modulo:
                    e.target.value,
                })
              }
            >

              <option value="">
                Todos
              </option>


              {opciones.modulos.map(
                (x) => (

                  <option
                    key={x}
                    value={x}
                  >
                    {x}
                  </option>

                )
              )}

            </select>

          </Field>


          {/* ACCIÓN */}

          <Field label="Acción contiene">

            <input
              className={inputClass}

              list="acciones-audit"

              value={f.accion}

              onChange={(e) =>
                setF({
                  ...f,

                  accion:
                    e.target.value,
                })
              }
            />


            <datalist id="acciones-audit">

              {opciones.acciones.map(
                (x) => (

                  <option
                    key={x}
                    value={x}
                  />

                )
              )}

            </datalist>

          </Field>

        </div>

      </Panel>


      {/* =================================================
          TABLA
      ================================================= */}

      <Panel>

        {rows.length ? (

          <Table
            columns={cols}
            rows={rows}
            keyField="id_registro"
          />

        ) : (

          <Empty />

        )}

      </Panel>
    </>
  );
}