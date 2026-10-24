// src/utils/fecha.js

/*
 * Para fechas generadas automáticamente por el servidor/Neon.
 * Las interpretamos como UTC y las mostramos en Guatemala.
 */
export const fechaServidorGuatemala = (valor) => {
  if (!valor) return '—';

  const texto = String(valor).trim();

  const tieneZona =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto);

  let fecha;

  if (tieneZona) {
    fecha = new Date(texto);
  } else {
    const normalizado =
      texto.replace(' ', 'T');

    fecha = new Date(
      `${normalizado}Z`
    );
  }

  if (Number.isNaN(fecha.getTime())) {
    return texto;
  }

  return fecha.toLocaleString(
    'es-GT',
    {
      timeZone: 'America/Guatemala',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }
  );
};


/*
 * Para fechas que el usuario escogió manualmente,
 * como fecha_deteccion o fecha_recoleccion.
 *
 * No debemos restarle seis horas.
 */
export const fechaLocal = (valor) => {
  if (!valor) return '—';

  const fecha = new Date(
    String(valor)
      .replace(' ', 'T')
  );

  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return fecha.toLocaleString(
    'es-GT',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }
  );
};