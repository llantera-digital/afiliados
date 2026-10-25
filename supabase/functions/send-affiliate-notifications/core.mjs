// Núcleo del procesador de avisos del portal de afiliados.
// Recibe `reclamar`, `enviar` y las marcas de estado como dependencias, para
// poder probarlo con dobles y para que la reclamación viva en la base
// (claim_affiliate_notifications), no en el proceso.
//
// Cada fila trae un `claim_token`. Las marcas exigen ese token: si el arriendo
// venció y otro worker reclamó la fila, la actualización afecta cero filas y
// este worker la cuenta como tardía en lugar de sobrescribir el estado.

export async function procesarAvisos(deps, { limite = 20 } = {}) {
  const filas = await deps.reclamar(limite);
  const resultado = { procesados: filas.length, enviados: 0, fallidos: 0, tardios: 0 };

  for (const fila of filas) {
    try {
      await deps.enviar(fila);
    } catch (error) {
      const detalle = String(error?.message ?? 'Error de envío').slice(0, 1000);
      const aplicado = await marcar(deps, fila, 'fallido', () => deps.marcarFallido(fila.id, fila.claim_token, detalle));
      if (aplicado) resultado.fallidos += 1;
      else resultado.tardios += 1;
      continue;
    }

    const aplicado = await marcar(deps, fila, 'enviado', () => deps.marcarEnviado(fila.id, fila.claim_token));
    if (aplicado) resultado.enviados += 1;
    else resultado.tardios += 1;
  }

  return resultado;
}

async function marcar(deps, fila, fase, accion) {
  try {
    const aplicado = await accion();
    if (aplicado === false) {
      deps.registrar?.('OUTBOX_LEASE_LOST', { id: fila.id, fase });
      return false;
    }
    return true;
  } catch (error) {
    deps.registrar?.('OUTBOX_MARK_FAILED', { id: fila.id, fase, error: String(error?.message ?? error) });
    return false;
  }
}
