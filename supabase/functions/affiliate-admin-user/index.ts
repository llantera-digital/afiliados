import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.50.0"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
const internalEmail = (username: string) => `${username.trim().toLocaleLowerCase("es-MX").replace(/[^a-z0-9._-]/g, "")}@afiliados.llantera.digital`

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405)

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return json({ error: "No autenticado" }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401)
  const { data: profile } = await admin.from("affiliate_portal_users").select("role,is_active").eq("auth_user_id", userData.user.id).single()
  if (profile?.role !== "admin" || !profile.is_active) return json({ error: "Acceso denegado" }, 403)

  const body = await request.json()
  const username = String(body.username ?? "").trim()
  const password = String(body.password ?? "")
  const role = body.role === "admin" ? "admin" : "affiliate"
  let affiliateId = role === "affiliate" ? String(body.affiliate_id ?? "") : null
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) || password.length < 8) {
    return json({ error: "Datos de usuario inválidos" }, 400)
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail(username), password, email_confirm: true,
    app_metadata: { portal: "affiliates", role },
  })
  if (createError || !created.user) return json({ error: createError?.message ?? "No se creó el usuario" }, 400)

  if (role === "affiliate" && !affiliateId) {
    const { data: affiliate, error: affiliateError } = await admin.from("affiliates").insert({
      name: String(body.name ?? "").trim(), email: String(body.email ?? "").trim(),
      default_discount_amount: Number(body.discount_amount ?? 0),
    }).select("id").single()
    if (affiliateError || !affiliate) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: affiliateError?.message ?? "No se creó el afiliado" }, 400) }
    affiliateId = affiliate.id
  }

  const { error: profileError } = await admin.from("affiliate_portal_users").insert({
    auth_user_id: created.user.id, username, role, affiliate_id: affiliateId,
  })
  if (profileError) {
    if (affiliateId && !body.affiliate_id) await admin.from("affiliates").delete().eq("id", affiliateId)
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: profileError.message }, 400)
  }

  if (role === "affiliate" && !body.affiliate_id) {
    const discount = Number(body.discount_amount ?? 0)
    const { error: couponError } = await admin.from("affiliate_coupons").insert({ affiliate_id: affiliateId, code: String(body.coupon ?? ""), discount_amount: discount })
    const { error: tiersError } = await admin.from("affiliate_default_commission_tiers").insert(body.tiers.map((tier: Record<string, unknown>) => ({
      affiliate_id: affiliateId, start_payment_number: tier.start, end_payment_number: tier.end,
      commission_rate: tier.rate, is_indefinite: Boolean(tier.indefinite),
    })))
    if (couponError || tiersError) {
      await admin.from("affiliate_coupons").delete().eq("affiliate_id", affiliateId)
      await admin.from("affiliate_default_commission_tiers").delete().eq("affiliate_id", affiliateId)
      await admin.from("affiliate_portal_users").delete().eq("auth_user_id", created.user.id)
      await admin.from("affiliates").delete().eq("id", affiliateId)
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: couponError?.message ?? tiersError?.message }, 400)
    }
  }
  return json({ id: created.user.id, username, role }, 201)
})
