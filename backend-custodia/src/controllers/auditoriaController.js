const db = require('../config/db');


/* =========================================================
   CONSTRUIR FILTROS DE AUDITORÍA
========================================================= */

function buildFiltros(q) {
  const vals = [];
  const f = [];


  /* =====================================================
     MÓDULO
  ===================================================== */

  if (q.modulo) {
    vals.push(q.modulo);

    f.push(
      `LOWER(b.modulo) = LOWER($${vals.length})`
    );
  }


  /* =====================================================
     USUARIO
  ===================================================== */

  if (q.id_usuario) {
    vals.push(q.id_usuario);

    f.push(
      `b.id_usuario = $${vals.length}`
    );
  }


  /* =====================================================
     ACCIÓN
  ===================================================== */

  if (q.accion) {
    vals.push(
      `%${q.accion}%`
    );

    f.push(
      `b.accion ILIKE $${vals.length}`
    );
  }


  /* =====================================================
     DESDE

     El navegador manda una hora local de Guatemala:

     2026-10-23T23:00

     Pero Neon guarda nuestros TIMESTAMP automáticos
     utilizando UTC como referencia.

     Entonces:

     23:00 Guatemala
          ↓
     05:00 UTC
  ===================================================== */

  if (q.desde) {
    vals.push(q.desde);

    f.push(`
      b.fecha_hora >= (
        $${vals.length}::timestamp
        AT TIME ZONE 'America/Guatemala'
        AT TIME ZONE 'UTC'
      )
    `);
  }


  /* =====================================================
     HASTA
  ===================================================== */

  if (q.hasta) {
    vals.push(q.hasta);

    f.push(`
      b.fecha_hora <= (
        $${vals.length}::timestamp
        AT TIME ZONE 'America/Guatemala'
        AT TIME ZONE 'UTC'
      )
    `);
  }


  return {
    vals,
    f,
  };
}


/* =========================================================
   OBTENER BITÁCORA
========================================================= */

const obtenerBitacora = async (
  req,
  res
) => {
  try {
    const {
      vals,
      f,
    } = buildFiltros(
      req.query
    );


    const r = await db.query(
      `
        SELECT

          b.id_registro,

          /*
           * MUY IMPORTANTE:
           *
           * fecha_hora es TIMESTAMP sin zona.
           *
           * La enviamos como TEXTO exactamente como está
           * almacenada en Neon.
           *
           * Auditoria.jsx la interpretará como UTC y luego
           * la convertirá a America/Guatemala.
           */
          TO_CHAR(
            b.fecha_hora,
            'YYYY-MM-DD"T"HH24:MI:SS.MS'
          ) AS fecha_hora,

          b.id_usuario,

          b.accion,

          b.modulo,

          b.id_entidad_afectada,

          b.tipo_entidad,

          b.detalles,

          b.direccion_ip,

          u.nombre,

          u.apellido,

          u.correo

        FROM bitacora_auditoria b

        LEFT JOIN usuario u
          ON u.id_usuario =
             b.id_usuario

        ${
          f.length
            ? `WHERE ${f.join(
                ' AND '
              )}`
            : ''
        }

        ORDER BY
          b.fecha_hora DESC

        LIMIT 2000
      `,
      vals
    );


    res.json(
      r.rows
    );

  } catch (e) {
    console.error(
      'ERROR OBTENER BITÁCORA:',
      e
    );


    res.status(500).json({
      mensaje:
        'Error al consultar la bitácora',
    });
  }
};


/* =========================================================
   OPCIONES PARA FILTROS
========================================================= */

const opcionesAuditoria = async (
  _req,
  res
) => {
  try {

    /* =====================================================
       USUARIOS
    ===================================================== */

    const usuarios = (
      await db.query(
        `
          SELECT DISTINCT
            u.id_usuario,
            u.nombre,
            u.apellido

          FROM bitacora_auditoria b

          JOIN usuario u
            ON u.id_usuario =
               b.id_usuario

          ORDER BY
            u.nombre,
            u.apellido
        `
      )
    ).rows;


    /* =====================================================
       MÓDULOS
    ===================================================== */

    const modulos = (
      await db.query(
        `
          SELECT DISTINCT
            modulo

          FROM bitacora_auditoria

          ORDER BY modulo
        `
      )
    ).rows.map(
      (x) => x.modulo
    );


    /* =====================================================
       ACCIONES
    ===================================================== */

    const acciones = (
      await db.query(
        `
          SELECT DISTINCT
            accion

          FROM bitacora_auditoria

          ORDER BY accion
        `
      )
    ).rows.map(
      (x) => x.accion
    );


    res.json({
      usuarios,
      modulos,
      acciones,
    });

  } catch (e) {
    console.error(
      'ERROR OPCIONES AUDITORÍA:',
      e
    );


    res.status(500).json({
      mensaje:
        'Error al cargar filtros de auditoría',
    });
  }
};


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  obtenerBitacora,
  opcionesAuditoria,
  buildFiltros,
};