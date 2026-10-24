const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditoriaService');
const { enviarPDF } = require('../services/pdfService');
const { buildFiltros } = require('./auditoriaController');


/* =========================================================
   MANEJO DE FECHAS
========================================================= */

/*
 * Fechas ingresadas manualmente por el usuario.
 *
 * Ejemplos:
 * - fecha_deteccion
 * - fecha_recoleccion
 *
 * Queremos conservar exactamente la hora seleccionada
 * en el formulario, sin aplicar un desplazamiento UTC.
 */
const fechaLocal = (v) => {
  if (!v) return '—';

  let d;

  if (v instanceof Date) {
    d = v;
  } else {
    d = new Date(
      String(v).trim().replace(' ', 'T')
    );
  }

  if (Number.isNaN(d.getTime())) {
    return String(v);
  }

  /*
   * Tomamos los componentes tal como llegaron y los
   * mostramos sin desplazamiento de zona horaria.
   */
  const fija = new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    )
  );

  return fija.toLocaleString('es-GT', {
    timeZone: 'UTC',
  });
};


/*
 * Fechas generadas automáticamente por PostgreSQL/Neon.
 *
 * Ejemplos:
 * - fecha_registro
 * - fecha_hora
 * - fecha_recepcion
 * - fecha_generacion
 * - fecha_inicio
 * - fecha_fin
 * - fecha_resolucion
 *
 * Actualmente las columnas son TIMESTAMP sin zona horaria
 * y Neon las está generando tomando UTC como referencia.
 *
 * Reconstruimos esos componentes como UTC y luego los
 * convertimos a America/Guatemala.
 */
const fechaServidor = (v) => {
  if (!v) return '—';

  let utc;

  if (v instanceof Date) {
    utc = new Date(
      Date.UTC(
        v.getFullYear(),
        v.getMonth(),
        v.getDate(),
        v.getHours(),
        v.getMinutes(),
        v.getSeconds(),
        v.getMilliseconds()
      )
    );
  } else {
    let valor = String(v)
      .trim()
      .replace(' ', 'T');

    /*
     * Si el valor ya trae Z o un offset como -06:00,
     * respetamos esa información.
     */
    const tieneZona =
      /(?:Z|[+-]\d{2}:?\d{2})$/i.test(valor);

    if (!tieneZona) {
      valor += 'Z';
    }

    utc = new Date(valor);
  }

  if (Number.isNaN(utc.getTime())) {
    return String(v);
  }

  return utc.toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
  });
};


/*
 * Hora real del momento en el que se está generando
 * el documento.
 */
const fechaActualGuatemala = () => {
  return new Date().toLocaleString(
    'es-GT',
    {
      timeZone: 'America/Guatemala',
    }
  );
};


const campo = (label, valor) =>
  `${label}: ${valor ?? '—'}`;

const separador =
  '------------------------------------------------------------';


/* =========================================================
   TRAZABILIDAD DE UNA EVIDENCIA
========================================================= */

async function trazabilidadEvidencia(
  idEvidencia
) {
  const [
    mov,
    copias,
    analisis,
    alertas,
  ] = await Promise.all([
    /* MOVIMIENTOS */
    db.query(
      `
        SELECT
          m.*,

          ue.nombre || ' ' || ue.apellido
            AS entrega,

          ur.nombre || ' ' || ur.apellido
            AS recibe,

          ua.nombre || ' ' || ua.apellido
            AS autorizador

        FROM movimiento_custodia m

        LEFT JOIN usuario ue
          ON ue.id_usuario = m.id_entrega

        LEFT JOIN usuario ur
          ON ur.id_usuario = m.id_recibe

        LEFT JOIN usuario ua
          ON ua.id_usuario = m.id_autorizador

        WHERE m.id_evidencia = $1

        ORDER BY m.fecha_hora
      `,
      [idEvidencia]
    ),


    /* COPIAS AUTORIZADAS */
    db.query(
      `
        SELECT
          c.*,

          ua.nombre || ' ' || ua.apellido
            AS analista,

          ug.nombre || ' ' || ug.apellido
            AS generador

        FROM copia_autorizada c

        LEFT JOIN usuario ua
          ON ua.id_usuario = c.id_analista

        LEFT JOIN usuario ug
          ON ug.id_usuario = c.id_generador

        WHERE c.id_evidencia = $1

        ORDER BY c.fecha_generacion
      `,
      [idEvidencia]
    ),


    /* ANÁLISIS FORENSES */
    db.query(
      `
        SELECT
          a.*,

          c.codigo
            AS copia_codigo,

          u.nombre || ' ' || u.apellido
            AS analista

        FROM analisis_forense a

        LEFT JOIN copia_autorizada c
          ON c.id_copia = a.id_copia

        LEFT JOIN usuario u
          ON u.id_usuario = a.id_analista

        WHERE a.id_evidencia = $1

        ORDER BY a.fecha_inicio
      `,
      [idEvidencia]
    ),


    /* ALERTAS */
    db.query(
      `
        SELECT
          a.*,

          u.nombre || ' ' || u.apellido
            AS revisor

        FROM alerta a

        LEFT JOIN usuario u
          ON u.id_usuario = a.id_revisor

        WHERE a.id_evidencia = $1

        ORDER BY a.fecha_generacion
      `,
      [idEvidencia]
    ),
  ]);


  return {
    movimientos: mov.rows,
    copias: copias.rows,
    analisis: analisis.rows,
    alertas: alertas.rows,
  };
}


/* =========================================================
   AGREGAR TRAZABILIDAD AL PDF
========================================================= */

function agregarTrazabilidad(
  lines,
  trazabilidad
) {
  /* =====================================================
     CADENA DE CUSTODIA
  ===================================================== */

  lines.push(
    '',
    'CADENA DE CUSTODIA'
  );


  if (
    !trazabilidad.movimientos.length
  ) {
    lines.push(
      'Sin transferencias registradas; la custodia permanece con el recolector inicial.'
    );
  }


  for (
    const m of
    trazabilidad.movimientos
  ) {
    lines.push(
      separador,

      campo(
        'Fecha entrega',
        fechaServidor(
          m.fecha_hora
        )
      ),

      campo(
        'Entrega',
        m.entrega
      ),

      campo(
        'Recibe',
        m.recibe
      ),

      campo(
        'Motivo',
        m.motivo
      ),

      campo(
        'Firma entrega',
        m.firma_entrega
      ),

      campo(
        'Autorizacion',
        m.requiere_autorizacion
          ? `${
              m.estado_autorizacion ||
              'Pendiente'
            }${
              m.autorizador
                ? ` - ${m.autorizador}`
                : ''
            }`
          : 'No requerida'
      ),

      campo(
        'Estado transferencia',
        m.estado_transferencia
      ),

      campo(
        'Fecha recepcion',
        fechaServidor(
          m.fecha_recepcion
        )
      ),

      campo(
        'Firma recepcion',
        m.firma_recepcion
      ),

      campo(
        'Observaciones',
        m.observaciones
      )
    );
  }


  /* =====================================================
     COPIAS AUTORIZADAS
  ===================================================== */

  lines.push(
    '',
    'COPIAS AUTORIZADAS PARA ANALISIS'
  );


  if (!trazabilidad.copias.length) {
    lines.push(
      'Sin copias autorizadas registradas.'
    );
  }


  for (
    const c of trazabilidad.copias
  ) {
    lines.push(
      separador,

      campo(
        'Copia',
        c.codigo
      ),

      campo(
        'Analista autorizado',
        c.analista
      ),

      campo(
        'Generada por',
        c.generador
      ),

      campo(
        'Fecha generacion',
        fechaServidor(
          c.fecha_generacion
        )
      ),

      campo(
        'Hash SHA-256 copia',
        c.hash_copia
      ),

      campo(
        'Estado',
        c.estado
      )
    );
  }


  /* =====================================================
     ANÁLISIS FORENSES
  ===================================================== */

  lines.push(
    '',
    'ANALISIS FORENSES'
  );


  if (
    !trazabilidad.analisis.length
  ) {
    lines.push(
      'Sin analisis forenses registrados.'
    );
  }


  for (
    const a of trazabilidad.analisis
  ) {
    lines.push(
      separador,

      campo(
        'Analisis',
        `#${a.id_analisis}`
      ),

      campo(
        'Copia autorizada',
        a.copia_codigo
      ),

      campo(
        'Analista',
        a.analista
      ),

      campo(
        'Inicio',
        fechaServidor(
          a.fecha_inicio
        )
      ),

      campo(
        'Fin',
        fechaServidor(
          a.fecha_fin
        )
      ),

      campo(
        'Herramientas',
        a.herramientas
      ),

      campo(
        'Procedimiento',
        a.procedimiento
      ),

      campo(
        'Hallazgos',
        a.hallazgos
      ),

      campo(
        'Conclusiones',
        a.conclusiones
      ),

      campo(
        'Informes tecnicos adjuntos',
        a.archivos_adjuntos
          ? 'Si'
          : 'No'
      )
    );
  }


  /* =====================================================
     ALERTAS
  ===================================================== */

  lines.push(
    '',
    'ALERTAS DE INTEGRIDAD'
  );


  if (
    !trazabilidad.alertas.length
  ) {
    lines.push(
      'Sin alertas registradas.'
    );
  }


  for (
    const a of trazabilidad.alertas
  ) {
    lines.push(
      separador,

      campo(
        'Tipo',
        a.tipo
      ),

      campo(
        'Descripcion',
        a.descripcion
      ),

      campo(
        'Generada',
        fechaServidor(
          a.fecha_generacion
        )
      ),

      campo(
        'Estado',
        a.estado
      ),

      campo(
        'Revisor',
        a.revisor
      ),

      campo(
        'Fecha resolucion',
        fechaServidor(
          a.fecha_resolucion
        )
      ),

      campo(
        'Resolucion',
        a.observaciones_resolucion
      )
    );
  }
}


/* =========================================================
   REPORTE INDIVIDUAL DE CADENA DE CUSTODIA
========================================================= */

async function reporteCadenaEvidencia(
  req,
  res
) {
  try {
    const ev = await db.query(
      `
        SELECT
          e.*,

          i.codigo
            AS incidente_codigo,

          i.titulo
            AS incidente_titulo,

          ur.nombre || ' ' || ur.apellido
            AS recolector,

          uc.nombre || ' ' || uc.apellido
            AS custodio_actual

        FROM evidencia e

        JOIN incidente i
          ON i.id_incidente =
             e.id_incidente

        LEFT JOIN usuario ur
          ON ur.id_usuario =
             e.id_recolector

        LEFT JOIN usuario uc
          ON uc.id_usuario =
             e.id_custodio_actual

        WHERE e.id_evidencia = $1
      `,
      [req.params.id]
    );


    if (!ev.rows.length) {
      return res.status(404).json({
        mensaje:
          'Evidencia no encontrada',
      });
    }


    const e = ev.rows[0];


    const trazabilidad =
      await trazabilidadEvidencia(
        req.params.id
      );


    const lines = [
      campo(
        'Generado',
        fechaActualGuatemala()
      ),

      '',

      'IDENTIFICACION DE LA EVIDENCIA',

      campo(
        'Incidente',
        `${e.incidente_codigo} - ${e.incidente_titulo}`
      ),

      campo(
        'Codigo',
        e.codigo
      ),

      campo(
        'Descripcion',
        e.descripcion
      ),

      campo(
        'Tipo',
        e.tipo_evidencia
      ),

      campo(
        'Origen',
        e.origen
      ),

      /*
       * Fecha ingresada manualmente
       * por el recolector.
       */
      campo(
        'Fecha recoleccion',
        fechaLocal(
          e.fecha_recoleccion
        )
      ),

      campo(
        'Metodo recoleccion',
        e.metodo_recoleccion
      ),

      campo(
        'Hash SHA-256 original',
        e.hash_original
      ),

      campo(
        'Hash actual',
        e.hash_actual
      ),

      campo(
        'Integridad',
        e.estado_integridad
      ),

      campo(
        'Estado',
        e.estado
      ),

      campo(
        'Recolector',
        e.recolector
      ),

      campo(
        'Custodio actual',
        e.custodio_actual
      ),

      campo(
        'Ubicacion fisica',
        e.ubicacion_fisica
      ),

      campo(
        'Ubicacion logica',
        e.ubicacion_logica
      ),

      campo(
        'Observaciones',
        e.observaciones
      ),
    ];


    agregarTrazabilidad(
      lines,
      trazabilidad
    );


    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        'Generación de reporte PDF de cadena de custodia',

      modulo:
        'Reportes',

      id_entidad_afectada:
        Number(req.params.id),

      tipo_entidad:
        'evidencia',

      detalles:
        e.codigo,

      direccion_ip:
        req.ip,
    });


    enviarPDF(
      res,

      `${e.codigo}-cadena-custodia.pdf`,

      `Reporte formal de Cadena de Custodia - ${e.codigo}`,

      lines
    );

  } catch (e) {
    console.error(
      'ERROR REPORTE EVIDENCIA:',
      e
    );

    if (!res.headersSent) {
      res.status(500).json({
        mensaje:
          'Error al generar reporte',
      });
    }
  }
}


/* =========================================================
   REPORTE DEL INCIDENTE
========================================================= */

async function reporteIncidente(
  req,
  res
) {
  try {
    /* =====================================================
       1. OBTENER INCIDENTE
    ===================================================== */

    const inc = await db.query(
      `
        SELECT
          i.*,

          u.nombre || ' ' || u.apellido
            AS reportante

        FROM incidente i

        LEFT JOIN usuario u
          ON u.id_usuario =
             i.id_reportante

        WHERE i.id_incidente = $1
      `,
      [req.params.id]
    );


    if (!inc.rows.length) {
      return res.status(404).json({
        mensaje:
          'Incidente no encontrado',
      });
    }


    const i = inc.rows[0];


    const esFinal =
      i.estado === 'Cerrado';


    /* =====================================================
       2. OBTENER EVIDENCIAS
    ===================================================== */

    const evidencias =
      await db.query(
        `
          SELECT
            e.*,

            u.nombre || ' ' || u.apellido
              AS custodio,

            r.nombre || ' ' || r.apellido
              AS recolector

          FROM evidencia e

          LEFT JOIN usuario u
            ON u.id_usuario =
               e.id_custodio_actual

          LEFT JOIN usuario r
            ON r.id_usuario =
               e.id_recolector

          WHERE e.id_incidente = $1

          ORDER BY e.fecha_registro
        `,
        [req.params.id]
      );


    /* =====================================================
       3. DATOS FORMALES DEL CIERRE
    ===================================================== */

    let cierre = null;


    if (esFinal) {
      const cierreResult =
        await db.query(
          `
            SELECT
              b.fecha_hora,
              b.detalles,

              u.nombre || ' ' ||
              u.apellido
                AS supervisor

            FROM bitacora_auditoria b

            LEFT JOIN usuario u
              ON u.id_usuario =
                 b.id_usuario

            WHERE
              b.id_entidad_afectada =
                $1

              AND b.tipo_entidad =
                  'incidente'

              AND b.modulo =
                  'Incidentes'

              AND b.accion
                  ILIKE '%cierre%'

            ORDER BY
              b.fecha_hora DESC

            LIMIT 1
          `,
          [req.params.id]
        );


      if (
        cierreResult.rows.length
      ) {
        cierre =
          cierreResult.rows[0];
      }
    }


    /* =====================================================
       4. INFORMACIÓN GENERAL
    ===================================================== */

    const lines = [
      campo(
        'Generado',
        fechaActualGuatemala()
      ),

      '',

      'INCIDENTE',

      campo(
        'Codigo',
        i.codigo
      ),

      campo(
        'Titulo',
        i.titulo
      ),

      campo(
        'Descripcion',
        i.descripcion
      ),

      campo(
        'Tipo',
        i.tipo_incidente
      ),

      campo(
        'Severidad',
        i.severidad
      ),

      campo(
        'Estado',
        i.estado
      ),

      campo(
        'Area afectada',
        i.area_afectada
      ),

      campo(
        'Reportante',
        i.reportante
      ),

      /*
       * Seleccionada manualmente
       * por el Reportante.
       */
      campo(
        'Fecha deteccion',
        fechaLocal(
          i.fecha_deteccion
        )
      ),

      /*
       * Generada automáticamente
       * por PostgreSQL.
       */
      campo(
        'Fecha registro',
        fechaServidor(
          i.fecha_registro
        )
      ),

      campo(
        'Observaciones',
        i.observaciones
      ),
    ];


    /* =====================================================
       5. CIERRE FORMAL DEL CASO
    ===================================================== */

    if (esFinal) {
      lines.push(
        '',

        'CIERRE FORMAL DEL CASO',

        separador,

        campo(
          'Estado final',
          'Cerrado'
        ),

        campo(
          'Supervisor responsable',
          cierre?.supervisor ||
            'Supervisor autorizado'
        ),

        campo(
          'Fecha y hora de cierre',
          cierre?.fecha_hora
            ? fechaServidor(
                cierre.fecha_hora
              )
            : '—'
        ),

        campo(
          'Observaciones de cierre',
          cierre?.detalles ||
            'Caso cerrado después de validar las condiciones de cierre.'
        )
      );
    }


    /* =====================================================
       6. EVIDENCIAS DEL CASO
    ===================================================== */

    lines.push(
      '',

      `EVIDENCIAS DEL CASO (${evidencias.rows.length})`
    );


    if (
      !evidencias.rows.length
    ) {
      lines.push(
        'El incidente no tiene evidencias registradas.'
      );
    }


    for (
      const e of evidencias.rows
    ) {
      lines.push(
        '',

        '============================================================',

        campo(
          'Evidencia',
          `${e.codigo} - ${e.descripcion}`
        ),

        campo(
          'Tipo',
          e.tipo_evidencia
        ),

        campo(
          'Estado / Integridad',
          `${e.estado} / ${e.estado_integridad}`
        ),

        campo(
          'Recolector',
          e.recolector
        ),

        campo(
          'Custodio',
          e.custodio
        ),

        campo(
          'Hash original',
          e.hash_original
        ),

        campo(
          'Hash actual',
          e.hash_actual
        ),

        campo(
          'Ubicacion fisica',
          e.ubicacion_fisica
        ),

        campo(
          'Ubicacion logica',
          e.ubicacion_logica
        )
      );


      const trazabilidad =
        await trazabilidadEvidencia(
          e.id_evidencia
        );


      agregarTrazabilidad(
        lines,
        trazabilidad
      );
    }


    /* =====================================================
       7. AUDITORÍA DE GENERACIÓN
    ===================================================== */

    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        esFinal
          ? 'Generación de informe PDF final de trazabilidad'
          : 'Generación de informe PDF de trazabilidad',

      modulo:
        'Reportes',

      id_entidad_afectada:
        Number(req.params.id),

      tipo_entidad:
        'incidente',

      detalles:
        esFinal
          ? `${i.codigo} - Informe final`
          : `${i.codigo} - Informe de trazabilidad`,

      direccion_ip:
        req.ip,
    });


    /* =====================================================
       8. NOMBRE DEL DOCUMENTO
    ===================================================== */

    const nombreArchivo =
      esFinal
        ? `${i.codigo}-trazabilidad-final.pdf`
        : `${i.codigo}-trazabilidad.pdf`;


    const titulo =
      esFinal
        ? `Informe Final de Trazabilidad del Caso - ${i.codigo}`
        : `Informe de Trazabilidad del Caso - ${i.codigo}`;


    /* =====================================================
       9. GENERAR PDF
    ===================================================== */

    enviarPDF(
      res,
      nombreArchivo,
      titulo,
      lines
    );

  } catch (e) {
    console.error(
      'ERROR REPORTE INCIDENTE:',
      e
    );


    if (!res.headersSent) {
      res.status(500).json({
        mensaje:
          'Error al generar informe',
      });
    }
  }
}


/* =========================================================
   REPORTE DE AUDITORÍA
========================================================= */

async function reporteAuditoria(
  req,
  res
) {
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
          b.*,
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


    const lines = [
      campo(
        'Generado',
        fechaActualGuatemala()
      ),

      campo(
        'Desde',
        req.query.desde
      ),

      campo(
        'Hasta',
        req.query.hasta
      ),

      campo(
        'Usuario',
        req.query.id_usuario
      ),

      campo(
        'Modulo',
        req.query.modulo
      ),

      campo(
        'Accion contiene',
        req.query.accion
      ),

      '',

      `REGISTROS (${r.rows.length})`,
    ];


    for (
      const x of r.rows
    ) {
      lines.push(
        separador,

        campo(
          'Fecha',
          fechaServidor(
            x.fecha_hora
          )
        ),

        campo(
          'Usuario',
          `${
            x.nombre || ''
          } ${
            x.apellido || ''
          }`.trim() ||
            'Sistema'
        ),

        campo(
          'Accion',
          x.accion
        ),

        campo(
          'Modulo',
          x.modulo
        ),

        campo(
          'Entidad',
          `${
            x.tipo_entidad ||
            '—'
          } #${
            x.id_entidad_afectada ||
            '—'
          }`
        ),

        campo(
          'Detalles',
          x.detalles
        ),

        campo(
          'IP',
          x.direccion_ip
        )
      );
    }


    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        'Exportación PDF de bitácora',

      modulo:
        'Reportes',

      tipo_entidad:
        'bitacora_auditoria',

      direccion_ip:
        req.ip,
    });


    enviarPDF(
      res,

      'bitacora-auditoria.pdf',

      'Bitácora de Auditoría - Exportación PDF',

      lines
    );

  } catch (e) {
    console.error(
      'ERROR REPORTE AUDITORIA:',
      e
    );


    if (!res.headersSent) {
      res.status(500).json({
        mensaje:
          'Error al exportar bitácora',
      });
    }
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  reporteCadenaEvidencia,
  reporteIncidente,
  reporteAuditoria,
};