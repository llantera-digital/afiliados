// Núcleo del procesador de avisos del portal de afiliados.
// Recibe `reclamar`, `enviar` y las marcas de estado como dependencias, para
// poder probarlo con dobles y para que la reclamación viva en la base
// (claim_affiliate_notifications), no en el proceso.
//
// Cada fila trae un `claim_token`. Las marcas exigen ese token: si el arriendo
// venció y otro worker reclamó la fila, la actualización afecta cero filas y
// este worker la cuenta como tardía en lugar de sobrescribir el estado.
//
// `presupuestoMs` acota el tiempo total del lote. Si se agota, las filas no
// procesadas quedan reclamadas y las recupera el siguiente worker al vencer el
// arriendo; nunca se procesan a medias ni se reenvían en esta ejecución.

export async function procesarAvisos(deps, { limite = 20, presupuestoMs = 0 } = {}) {
  const filas = await deps.reclamar(limite);
  const inicio = Date.now();
  const resultado = { procesados: filas.length, enviados: 0, fallidos: 0, tardios: 0 };
  let restantes = filas.length;

  for (const fila of filas) {
    if (presupuestoMs > 0 && Date.now() - inicio >= presupuestoMs) {
      deps.registrar?.('OUTBOX_BUDGET_EXHAUSTED', { restantes });
      break;
    }
    restantes -= 1;

    try {
      await deps.enviar(fila);
    } catch (error) {
      const detalle = String(error?.message ?? 'Error de envío').slice(0, 1000);
      if (Number(fila.attempts) >= 5) {
        deps.registrar?.('OUTBOX_EXHAUSTED', { id: fila.id, attempts: fila.attempts });
      }
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
