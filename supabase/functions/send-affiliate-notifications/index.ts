import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.50.0"
import { procesarAvisos } from "./core.mjs"

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!)
const entero = (valor: string | undefined, porOmision: number) => {
  const n = Number(valor)
  return Number.isInteger(n) ? n : porOmision
}
const entre = (valor: string | undefined, porOmision: number, minimo: number, maximo: number) => {
  const n = entero(valor, porOmision)
  return n >= minimo && n <= maximo ? n : porOmision
}

Deno.serve(async (request) => {
  // Sin secreto configurado no hay forma válida de invocar: se rechaza siempre.
  const esperado = Deno.env.get("AFFILIATE_CRON_SECRET")
  if (!esperado || request.headers.get("x-cron-secret") !== esperado) {
    return Response.json({ error: "Acceso denegado" }, { status: 401 })
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Valores configurables; los predeterminados están documentados en el README.
  const lote = entre(Deno.env.get("AFFILIATE_OUTBOX_BATCH"), 20, 1, 100)
  const arriendo = entre(Deno.env.get("AFFILIATE_OUTBOX_LEASE_SECONDS"), 300, 1, 3600)
  const gracia = entre(Deno.env.get("AFFILIATE_OUTBOX_LEGACY_GRACE_SECONDS"), 900, 0, 86400)
  const envioMs = entre(Deno.env.get("AFFILIATE_OUTBOX_SEND_TIMEOUT_MS"), 10000, 1000, 30000)
  const maxEjecucion = entre(Deno.env.get("AFFILIATE_OUTBOX_MAX_RUN_SECONDS"), 240, 5, 3600)
  // El lote nunca debe durar más que el arriendo: 80 % del arriendo o el tope.
  const presupuestoMs = Math.max(1000, Math.min(maxEjecucion * 1000, Math.round(arriendo * 1000 * 0.8)))

  const registrar = (evento: string, datos: Record<string, unknown>) => {
    console.error(evento + " " + JSON.stringify(datos))
  }

  const deps = {
    registrar,
    // Reclamación atómica con arriendo y token de identidad.
    reclamar: async (limite: number) => {
      const { data, error } = await supabase.rpc("claim_affiliate_notifications", {
        p_limit: limite, p_lease_seconds: arriendo, p_legacy_grace_seconds: gracia,
      })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enviar: async (row: { id: string; recipient: string; payload: Record<string, unknown> }) => {
      const payload = row.payload as Record<string, unknown>
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          // Best-effort: evita el reenvío si el proveedor respeta la clave.
          "Idempotency-Key": row.id,
        },
        // Un envío bloqueado no puede retener la ejecución más allá de este plazo.
        signal: AbortSignal.timeout(envioMs),
        body: JSON.stringify({
          from: Deno.env.get("AFFILIATE_EMAIL_FROM") ?? "Comisiones Llantera Digital <comisiones@llantera.digital>",
          to: [row.recipient], subject: "Nueva comisión generada — Llantera Digital",
          html: `<h2>Nueva comisión generada</h2><p><strong>Llantera:</strong> ${escapeHtml(payload.llantera)}</p><p><strong>Ciudad:</strong> ${escapeHtml(payload.ciudad || "—")}</p><p><strong>Comisión:</strong> $${Number(payload.commission_amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</p><p><strong>Estado:</strong> Pendiente</p><p><strong>Mensualidad:</strong> ${escapeHtml(payload.payment_number)}</p>`,
        }),
      })
      if (!response.ok) throw new Error((await response.text()).slice(0, 1000))
    },
    // Las marcas exigen el token: si el arriendo se perdió, no actualizan nada.
    marcarEnviado: async (id: string, token: string) => {
      const { data, error } = await supabase.from("affiliate_notification_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, claim_expires_at: null })
        .eq("id", id).eq("claim_token", token).select("id")
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length > 0
    },
    marcarFallido: async (id: string, token: string, detalle: string) => {
      const { data, error } = await supabase.from("affiliate_notification_outbox")
        .update({ status: "failed", last_error: detalle, claim_expires_at: null })
        .eq("id", id).eq("claim_token", token).select("id")
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length > 0
    },
  }

  try {
    const resultado = await procesarAvisos(deps, { limite: lote, presupuestoMs })
    // Se conservan `processed` y `sent`; `failed` y `late` son aditivos.
    return Response.json({
      processed: resultado.procesados,
      sent: resultado.enviados,
      failed: resultado.fallidos,
      late: resultado.tardios,
    })
  } catch (error) {
    registrar("OUTBOX_RUN_FAILED", { error: String(error?.message ?? error) })
    return Response.json({ error: "No se pudo procesar" }, { status: 500 })
  }
})
