const db = require('../config/db');
const fs = require('fs');
const { calcularHashSHA256 } = require('../services/hashService');
const { registrarAuditoria } = require('../services/auditoriaService');


/* =========================================================
   TRANSFERIR CUSTODIA
========================================================= */

const transferirCustodia = async (req, res) => {
  const {
    id_evidencia,
    id_recibe,
    motivo,
    observaciones,
    firma_entrega
  } = req.body;

  if (
    !id_evidencia ||
    !id_recibe ||
    !motivo ||
    !firma_entrega
  ) {
    return res.status(400).json({
      mensaje:
        'Evidencia, receptor, motivo y firma de entrega son obligatorios'
    });
  }

  if (
    Number(id_recibe) ===
    req.usuario.id_usuario
  ) {
    return res.status(400).json({
      mensaje:
        'No puedes transferirte la evidencia a ti mismo'
    });
  }

  try {
    const ev = await db.query(
      `
        SELECT
          e.id_custodio_actual,
          e.estado,
          u.area AS area_entrega
        FROM evidencia e
        LEFT JOIN usuario u
          ON u.id_usuario = e.id_custodio_actual
        WHERE e.id_evidencia = $1
      `,
      [id_evidencia]
    );

    if (!ev.rows.length) {
      return res.status(404).json({
        mensaje: 'Evidencia no encontrada'
      });
    }

    if (
      ![
        'Recolectada',
        'En Custodia'
      ].includes(ev.rows[0].estado)
    ) {
      return res.status(409).json({
        mensaje:
          'CP-008: solo puede transferirse evidencia en estado Recolectada o En Custodia'
      });
    }

    if (
      ev.rows[0].id_custodio_actual !==
      req.usuario.id_usuario
    ) {
      return res.status(403).json({
        mensaje:
          'Solo el custodio actual puede transferir la evidencia'
      });
    }

    const receptor = await db.query(
      `
        SELECT
          u.id_usuario,
          u.area,
          u.estado,
          u.id_rol,
          r.nombre AS rol
        FROM usuario u
        JOIN rol r
          ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1
      `,
      [id_recibe]
    );

    if (
      !receptor.rows.length ||
      receptor.rows[0].estado !== 'activo'
    ) {
      return res.status(400).json({
        mensaje:
          'El receptor no existe o está inactivo'
      });
    }

    if (
      ![2, 4].includes(
        receptor.rows[0].id_rol
      )
    ) {
      return res.status(400).json({
        mensaje:
          'RN-014: la custodia solo puede transferirse a un Recolector o Custodio'
      });
    }

    const areaEntrega =
      ev.rows[0].area_entrega;

    const areaRecibe =
      receptor.rows[0].area;

    const requiereAutorizacion =
      !areaEntrega ||
      !areaRecibe ||
      areaEntrega !== areaRecibe;

    const estadoAutorizacion =
      requiereAutorizacion
        ? 'Pendiente'
        : 'No requerida';

    const estadoTransferencia =
      requiereAutorizacion
        ? 'Pendiente autorización'
        : 'Pendiente recepción';

    const r = await db.query(
      `
        INSERT INTO movimiento_custodia (
          id_evidencia,
          id_entrega,
          id_recibe,
          motivo,
          observaciones,
          requiere_autorizacion,
          estado_autorizacion,
          estado_transferencia,
          firma_entrega
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
        RETURNING *
      `,
      [
        id_evidencia,
        req.usuario.id_usuario,
        id_recibe,
        motivo,
        observaciones || null,
        requiereAutorizacion,
        estadoAutorizacion,
        estadoTransferencia,
        firma_entrega
      ]
    );

    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        'Transferencia de Custodia Iniciada',

      modulo:
        'Custodia',

      id_entidad_afectada:
        Number(id_evidencia),

      tipo_entidad:
        'evidencia',

      detalles:
        `Movimiento ${r.rows[0].id_movimiento}; ` +
        `${areaEntrega || 'Sin área'} -> ` +
        `${areaRecibe || 'Sin área'}; ` +
        `${estadoTransferencia}`,

      direccion_ip:
        req.ip
    });

    res.status(201).json({
      mensaje:
        requiereAutorizacion
          ? 'Transferencia enviada a autorización del Supervisor'
          : 'Transferencia pendiente de recepción y firma del destinatario',

      datos:
        r.rows[0],

      requiere_autorizacion:
        requiereAutorizacion
    });

  } catch (e) {
    console.error(
      'ERROR TRANSFERIR CUSTODIA:',
      e
    );

    res.status(500).json({
      mensaje:
        'Error al transferir custodia'
    });
  }
};


/* =========================================================
   LISTAR MOVIMIENTOS
========================================================= */

const listarMovimientos = async (
  req,
  res
) => {
  try {
    const vals = [];
    const filtros = [];

    if (req.query.id_evidencia) {
      vals.push(
        req.query.id_evidencia
      );

      filtros.push(
        `m.id_evidencia=$${vals.length}`
      );
    }

    if (
      req.query.pendientes_mios ===
      'true'
    ) {
      vals.push(
        req.usuario.id_usuario
      );

      filtros.push(
        `m.id_recibe=$${vals.length}
         AND m.estado_transferencia='Pendiente recepción'`
      );
    }

    const r = await db.query(
      `
        SELECT
          m.*,
          e.codigo AS evidencia_codigo,
          e.estado_integridad,

          ue.nombre || ' ' || ue.apellido
            AS entrega,

          ue.area AS area_entrega,

          ur.nombre || ' ' || ur.apellido
            AS recibe,

          ur.area AS area_recibe,

          ua.nombre || ' ' || ua.apellido
            AS autorizador

        FROM movimiento_custodia m

        JOIN evidencia e
          ON e.id_evidencia =
             m.id_evidencia

        LEFT JOIN usuario ue
          ON ue.id_usuario =
             m.id_entrega

        LEFT JOIN usuario ur
          ON ur.id_usuario =
             m.id_recibe

        LEFT JOIN usuario ua
          ON ua.id_usuario =
             m.id_autorizador

        ${
          filtros.length
            ? 'WHERE ' +
              filtros.join(
                ' AND '
              )
            : ''
        }

        ORDER BY
          m.fecha_hora DESC
      `,
      vals
    );

    res.json(r.rows);

  } catch (e) {
    console.error(
      'ERROR LISTAR MOVIMIENTOS:',
      e
    );

    res.status(500).json({
      mensaje:
        'Error al obtener movimientos'
    });
  }
};


/* =========================================================
   RESOLVER TRANSFERENCIA
========================================================= */

const resolverTransferencia = async (req, res) => {
  const { estado, observaciones } = req.body;

  /* =====================================================
     VALIDAR ESTADO
  ===================================================== */

  if (!['Aprobada', 'Rechazada'].includes(estado)) {
    return res.status(400).json({
      mensaje:
        'Estado debe ser Aprobada o Rechazada',
    });
  }


  try {
    const nuevoEstado =
      estado === 'Aprobada'
        ? 'Pendiente recepción'
        : 'Rechazada';


    /*
     * Limpiamos espacios para evitar guardar textos
     * aparentemente distintos por espacios al inicio/final.
     */
    const resolucion =
      observaciones?.trim() || null;


    /* =====================================================
       ACTUALIZACIÓN ATÓMICA

       IMPORTANTE:
       Solo puede actualizarse mientras siga en Pendiente.

       Si llegan dos solicitudes casi al mismo tiempo,
       únicamente la primera podrá modificar el registro.
    ===================================================== */

    const r = await db.query(
      `
        UPDATE movimiento_custodia

        SET
          estado_autorizacion = $1,

          id_autorizador = $2,

          estado_transferencia = $3,

          observaciones =
            CASE

              /* Sin observación del Supervisor */
              WHEN $4::text IS NULL
                THEN observaciones


              /*
               * Si esta misma resolución ya existe,
               * NO volver a concatenarla.
               */
              WHEN POSITION(
                (
                  'Resolución: ' ||
                  $4::text
                )
                IN COALESCE(
                  observaciones,
                  ''
                )
              ) > 0
                THEN observaciones


              /* Agregarla solamente una vez */
              ELSE CONCAT_WS(
                ' | ',

                NULLIF(
                  observaciones,
                  ''
                ),

                'Resolución: ' ||
                $4::text
              )

            END

        WHERE
          id_movimiento = $5

          AND requiere_autorizacion = TRUE

          AND estado_autorizacion = 'Pendiente'

        RETURNING *
      `,
      [
        estado,
        req.usuario.id_usuario,
        nuevoEstado,
        resolucion,
        req.params.id,
      ]
    );


    /* =====================================================
       SI NO SE ACTUALIZÓ
    ===================================================== */

    if (!r.rows.length) {
      const existente =
        await db.query(
          `
            SELECT
              id_movimiento,
              requiere_autorizacion,
              estado_autorizacion

            FROM movimiento_custodia

            WHERE id_movimiento = $1
          `,
          [req.params.id]
        );


      if (!existente.rows.length) {
        return res.status(404).json({
          mensaje:
            'Movimiento no encontrado',
        });
      }


      const movimiento =
        existente.rows[0];


      if (
        !movimiento.requiere_autorizacion
      ) {
        return res.status(409).json({
          mensaje:
            'Esta transferencia no requiere autorización del Supervisor',
        });
      }


      return res.status(409).json({
        mensaje:
          'El movimiento ya fue resuelto anteriormente',
      });
    }


    const movimiento =
      r.rows[0];


    /* =====================================================
       AUDITORÍA
    ===================================================== */

    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        `Transferencia ${estado} por Supervisor`,

      modulo:
        'Custodia',

      id_entidad_afectada:
        movimiento.id_evidencia,

      tipo_entidad:
        'evidencia',

      detalles:
        `Movimiento ${movimiento.id_movimiento}`,

      direccion_ip:
        req.ip,
    });


    /* =====================================================
       RESPUESTA
    ===================================================== */

    res.json({
      mensaje:
        estado === 'Aprobada'
          ? 'Transferencia autorizada; ahora debe firmar el receptor'
          : 'Transferencia rechazada',

      datos:
        movimiento,
    });

  } catch (e) {
    console.error(
      'ERROR RESOLVER TRANSFERENCIA:',
      e
    );

    res.status(500).json({
      mensaje:
        'Error al resolver transferencia',
    });
  }
};


/* =========================================================
   RECIBIR TRANSFERENCIA
========================================================= */

const recibirTransferencia = async (
  req,
  res
) => {
  const {
    firma_recepcion,
    observaciones
  } = req.body;

  if (!firma_recepcion) {
    return res.status(400).json({
      mensaje:
        'La firma electrónica de recepción es obligatoria'
    });
  }

  const client =
    await db.pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    const m = await client.query(
      `
        SELECT *
        FROM movimiento_custodia
        WHERE id_movimiento = $1
        FOR UPDATE
      `,
      [req.params.id]
    );

    if (!m.rows.length) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        mensaje:
          'Movimiento no encontrado'
      });
    }

    const mov = m.rows[0];

    if (
      mov.id_recibe !==
      req.usuario.id_usuario
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(403).json({
        mensaje:
          'Solo el destinatario puede aceptar esta transferencia'
      });
    }

    if (
      mov.estado_transferencia !==
      'Pendiente recepción'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        mensaje:
          'La transferencia no está pendiente de recepción'
      });
    }

    const current =
      await client.query(
        `
          SELECT
            id_custodio_actual
          FROM evidencia
          WHERE id_evidencia = $1
          FOR UPDATE
        `,
        [mov.id_evidencia]
      );

    if (
      current.rows[0]
        ?.id_custodio_actual !==
      mov.id_entrega
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        mensaje:
          'La custodia cambió desde que se inició esta transferencia; el movimiento ya no puede completarse'
      });
    }

    const r = await client.query(
      `
        UPDATE movimiento_custodia

        SET
          firma_recepcion = $1,
          fecha_recepcion = NOW(),
          estado_transferencia =
            'Completada',

          observaciones =
            CASE
              WHEN $2::text IS NULL
                THEN observaciones
              ELSE CONCAT_WS(
                ' | ',
                observaciones,
                'Recepción: ' ||
                $2::text
              )
            END

        WHERE id_movimiento = $3

        RETURNING *
      `,
      [
        firma_recepcion,
        observaciones || null,
        req.params.id
      ]
    );

    await client.query(
      `
        UPDATE evidencia

        SET
          id_custodio_actual = $1,

          estado =
            CASE
              WHEN estado =
                'Recolectada'
                THEN 'En Custodia'
              ELSE estado
            END

        WHERE id_evidencia = $2
      `,
      [
        req.usuario.id_usuario,
        mov.id_evidencia
      ]
    );

    await client.query(
      'COMMIT'
    );

    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        'Recepción de Custodia firmada',

      modulo:
        'Custodia',

      id_entidad_afectada:
        mov.id_evidencia,

      tipo_entidad:
        'evidencia',

      detalles:
        `Movimiento ${req.params.id} completado`,

      direccion_ip:
        req.ip
    });

    res.json({
      mensaje:
        'Custodia recibida y registrada correctamente',

      datos:
        r.rows[0]
    });

  } catch (e) {
    await client.query(
      'ROLLBACK'
    );

    console.error(
      'ERROR RECIBIR CUSTODIA:',
      e
    );

    res.status(500).json({
      mensaje:
        'Error al recibir la custodia'
    });

  } finally {
    client.release();
  }
};


/* =========================================================
   VERIFICAR INTEGRIDAD
========================================================= */

const verificarIntegridad = async (
  req,
  res
) => {
  try {
    /* -----------------------------------------------------
       1. Buscar evidencia
    ----------------------------------------------------- */

    const r = await db.query(
      `
        SELECT
          hash_original,
          ruta_archivo,
          id_custodio_actual
        FROM evidencia
        WHERE id_evidencia = $1::integer
      `,
      [
        Number(
          req.params.id_evidencia
        )
      ]
    );

    if (!r.rows.length) {
      return res.status(404).json({
        mensaje:
          'Evidencia no encontrada'
      });
    }


    /* -----------------------------------------------------
       2. Validar custodio
    ----------------------------------------------------- */

    if (
      req.usuario.id_rol === 4 &&
      r.rows[0]
        .id_custodio_actual !==
        req.usuario.id_usuario
    ) {
      return res.status(403).json({
        mensaje:
          'Solo el custodio actual puede verificar esta evidencia'
      });
    }


    /* -----------------------------------------------------
       3. Comprobar existencia del archivo
    ----------------------------------------------------- */

    if (
      !fs.existsSync(
        r.rows[0].ruta_archivo
      )
    ) {
      return res.status(404).json({
        mensaje:
          'El archivo original no existe en el servidor'
      });
    }


    /* -----------------------------------------------------
       4. Calcular SHA-256 actual
    ----------------------------------------------------- */

    const hash =
      await calcularHashSHA256(
        r.rows[0].ruta_archivo
      );


    /* -----------------------------------------------------
       5. Comparar hashes
    ----------------------------------------------------- */

    const integra =
      r.rows[0].hash_original ===
      hash;


    /* -----------------------------------------------------
       6. Actualizar evidencia

       IMPORTANTE:
       Esta es la consulta corregida.
       Evita el error PostgreSQL 42P08.
    ----------------------------------------------------- */

    await db.query(
      `
        UPDATE evidencia

        SET
          estado_integridad =
            $1::varchar,

          hash_actual =
            $2::varchar,

          estado =
            CASE
              WHEN $3::boolean
                THEN estado
              ELSE 'Comprometida'
            END

        WHERE
          id_evidencia =
            $4::integer
      `,
      [
        integra
          ? 'Integra'
          : 'Comprometida',

        hash,

        integra,

        Number(
          req.params.id_evidencia
        )
      ]
    );


    /* -----------------------------------------------------
       7. Si está comprometida, crear alerta
    ----------------------------------------------------- */

    if (!integra) {
      const existe =
        await db.query(
          `
            SELECT 1

            FROM alerta

            WHERE
              id_evidencia =
                $1::integer

              AND LOWER(estado) <>
                'resuelta'

            LIMIT 1
          `,
          [
            Number(
              req.params
                .id_evidencia
            )
          ]
        );

      if (!existe.rows.length) {
        await db.query(
          `
            INSERT INTO alerta (
              id_evidencia,
              tipo,
              descripcion
            )

            VALUES (
              $1::integer,
              'Violación de Integridad',
              'El hash de verificación no coincide con el hash original'
            )
          `,
          [
            Number(
              req.params
                .id_evidencia
            )
          ]
        );
      }
    }


    /* -----------------------------------------------------
       8. Auditoría
    ----------------------------------------------------- */

    await registrarAuditoria({
      id_usuario:
        req.usuario.id_usuario,

      accion:
        'Verificación de Integridad',

      modulo:
        'Evidencias',

      id_entidad_afectada:
        Number(
          req.params.id_evidencia
        ),

      tipo_entidad:
        'evidencia',

      detalles:
        integra
          ? 'Semáforo verde: integridad válida'
          : 'Semáforo rojo: integridad comprometida',

      direccion_ip:
        req.ip
    });


    /* -----------------------------------------------------
       9. Respuesta
    ----------------------------------------------------- */

    if (!integra) {
      return res.status(409).json({
        mensaje:
          'ALERTA: La evidencia ha sido alterada. Se notificó al Supervisor mediante una alerta activa.',

        estado:
          'Rojo',

        hash_actual:
          hash
      });
    }

    res.json({
      mensaje:
        'Integridad validada exitosamente',

      estado:
        'Verde',

      hash_actual:
        hash
    });

  } catch (e) {
    console.error(
      'ERROR VERIFICAR INTEGRIDAD:',
      e
    );

    res.status(500).json({
      mensaje:
        'Error al verificar integridad',

      detalle:
        e.message
    });
  }
};


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  transferirCustodia,
  listarMovimientos,
  resolverTransferencia,
  recibirTransferencia,
  verificarIntegridad
};