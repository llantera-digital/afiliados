import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.50.0"
import { validarAlta, ejecutarAlta, parsearCuerpo } from "./core.mjs"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

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

  let crudo: string
  try { crudo = await request.text() }
  catch { return json({ error: "Cuerpo inválido" }, 400) }

  // Se valida el cuerpo completo antes de escribir cualquier cosa.
  const parseado = parsearCuerpo(crudo)
  if (!parseado.ok) return json({ error: parseado.error }, 400)
  const validacion = validarAlta(parseado.body)
  if (!validacion.ok) return json({ error: validacion.error }, 400)

  // Los adaptadores convierten los errores de Supabase en excepciones, para que
  // el núcleo tenga un solo camino de error y pueda compensar.
  const exigir = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  const deps = {
    registrar: (evento: string, datos: Record<string, unknown>) => {
      console.error(evento + " " + JSON.stringify(datos))
    },
    crearUsuario: async (datos: { email: string; password: string; role: string }) => {
      const { data, error } = await admin.auth.admin.createUser({
        email: datos.email, password: datos.password, email_confirm: true,
        app_metadata: { portal: "affiliates", role: datos.role },
      })
      if (error || !data.user) throw new Error(error?.message ?? "No se creó el usuario")
      return { id: data.user.id }
    },
    borrarUsuario: async (id: string) => { const { error } = await admin.auth.admin.deleteUser(id); exigir(error) },
    crearAfiliado: async (datos: Record<string, unknown>) => {
      const { data, error } = await admin.from("affiliates").insert(datos).select("id").single()
      if (error || !data) throw new Error(error?.message ?? "No se creó el afiliado")
      return { id: data.id }
    },
    borrarAfiliado: async (id: string) => { const { error } = await admin.from("affiliates").delete().eq("id", id); exigir(error) },
    crearPerfil: async (datos: Record<string, unknown>) => { const { error } = await admin.from("affiliate_portal_users").insert(datos); exigir(error) },
    borrarPerfil: async (id: string) => { const { error } = await admin.from("affiliate_portal_users").delete().eq("auth_user_id", id); exigir(error) },
    crearCupon: async (datos: Record<string, unknown>) => { const { error } = await admin.from("affiliate_coupons").insert(datos); exigir(error) },
    borrarCuponesDeAfiliado: async (id: string) => { const { error } = await admin.from("affiliate_coupons").delete().eq("affiliate_id", id); exigir(error) },
    crearEtapas: async (filas: Record<string, unknown>[]) => { const { error } = await admin.from("affiliate_default_commission_tiers").insert(filas); exigir(error) },
    borrarEtapasDeAfiliado: async (id: string) => { const { error } = await admin.from("affiliate_default_commission_tiers").delete().eq("affiliate_id", id); exigir(error) },
  }

  const resultado = await ejecutarAlta(deps, validacion.datos)
  return json(resultado.body, resultado.status)
})
