import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.50.0"

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!)

Deno.serve(async (request) => {
  if (request.headers.get("x-cron-secret") !== Deno.env.get("AFFILIATE_CRON_SECRET")) {
    return Response.json({ error: "Acceso denegado" }, { status: 401 })
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: rows, error } = await supabase.from("affiliate_notification_outbox").select("*").in("status", ["pending", "failed"]).lt("attempts", 5).order("created_at").limit(20)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  let sent = 0
  for (const row of rows ?? []) {
    await supabase.from("affiliate_notification_outbox").update({ status: "processing", attempts: row.attempts + 1 }).eq("id", row.id)
    const payload = row.payload as Record<string, unknown>
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("AFFILIATE_EMAIL_FROM") ?? "Comisiones Llantera Digital <comisiones@llantera.digital>",
        to: [row.recipient], subject: "Nueva comisión generada — Llantera Digital",
        html: `<h2>Nueva comisión generada</h2><p><strong>Llantera:</strong> ${escapeHtml(payload.llantera)}</p><p><strong>Ciudad:</strong> ${escapeHtml(payload.ciudad || "—")}</p><p><strong>Comisión:</strong> $${Number(payload.commission_amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</p><p><strong>Estado:</strong> Pendiente</p><p><strong>Mensualidad:</strong> ${escapeHtml(payload.payment_number)}</p>`,
      }),
    })
    if (response.ok) { await supabase.from("affiliate_notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id); sent++ }
    else { await supabase.from("affiliate_notification_outbox").update({ status: "failed", last_error: (await response.text()).slice(0, 1000) }).eq("id", row.id) }
  }
  return Response.json({ processed: rows?.length ?? 0, sent })
})
