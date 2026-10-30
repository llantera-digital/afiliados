import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AuthProvider, useAuth } from './AuthContext'

const backend = vi.hoisted(() => ({ configured: false, signIn: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() { return backend.configured },
  supabase: { auth: { signInWithPassword: backend.signIn } },
  usernameToInternalEmail: (value: string) => `${value.trim().toLowerCase()}@afiliados.llantera.digital`,
}))

function auth() {
  let captured: ReturnType<typeof useAuth> | undefined
  function Probe() { captured = useAuth(); return null }
  renderToString(<AuthProvider><Probe /></AuthProvider>)
  if (!captured) throw new Error('No se obtuvo el contexto')
  return captured
}

beforeEach(() => {
  backend.configured = false
  backend.signIn.mockReset()
  vi.stubEnv('PROD', true)
})
afterEach(() => vi.unstubAllEnvs())

describe('acceso sin configuración de servidor', () => {
  it.each(['admin.demo', 'afiliado.demo'])('producción rechaza %s sin llamar a Auth', async username => {
    const context = auth()
    await expect(context.signIn(username, 'clave-sintetica')).rejects.toThrow('El portal no está configurado')
    expect(backend.signIn).not.toHaveBeenCalled()
    expect(context.identity).toBeNull()
  })

  it('conserva la demostración local cuando no es producción', async () => {
    vi.stubEnv('PROD', false)
    await expect(auth().signIn('admin.demo', 'clave-sintetica')).resolves.toBeUndefined()
    expect(backend.signIn).not.toHaveBeenCalled()
  })
})

describe('acceso con configuración', () => {
  it('usa el proveedor existente y conserva la contraseña exacta', async () => {
    backend.configured = true
    backend.signIn.mockResolvedValue({ error: null })
    await auth().signIn(' Socio.Demo ', ' clave sintética ')
    expect(backend.signIn).toHaveBeenCalledTimes(1)
    expect(backend.signIn).toHaveBeenCalledWith({
      email: 'socio.demo@afiliados.llantera.digital', password: ' clave sintética ',
    })
  })

  it('un rechazo real no cae en la identidad de demostración', async () => {
    backend.configured = true
    backend.signIn.mockResolvedValue({ error: new Error('rechazo sintético') })
    await expect(auth().signIn('admin.demo', 'clave-sintetica')).rejects.toThrow('Usuario o contraseña incorrectos')
    expect(backend.signIn).toHaveBeenCalledTimes(1)
  })
})
