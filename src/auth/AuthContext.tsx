import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, usernameToInternalEmail } from '../lib/supabase'
import type { PortalIdentity } from '../types'

interface AuthValue {
  session: Session | null
  identity: PortalIdentity | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<PortalIdentity | null>(null)
  const [loading, setLoading] = useState(true)

  const loadIdentity = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) { setIdentity(null); return }
    const { data, error } = await supabase
      .from('affiliate_portal_users')
      .select('username, role, affiliate_id')
      .eq('auth_user_id', activeSession.user.id)
      .eq('is_active', true)
      .single()
    if (error) throw error
    setIdentity({ username: data.username, role: data.role, affiliateId: data.affiliate_id })
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadIdentity(data.session).catch(() => supabase.auth.signOut())
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      queueMicrotask(() => loadIdentity(nextSession).catch(() => setIdentity(null)))
    })
    return () => listener.subscription.unsubscribe()
  }, [loadIdentity])

  const signIn = useCallback(async (username: string, password: string) => {
    if (!isSupabaseConfigured) {
      setIdentity({ username, role: username.toLowerCase().startsWith('admin') ? 'admin' : 'affiliate', affiliateId: null })
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToInternalEmail(username), password })
    if (error) throw new Error('Usuario o contraseña incorrectos')
  }, [])

  const signOut = useCallback(async () => {
    setIdentity(null)
    if (isSupabaseConfigured) await supabase.auth.signOut()
  }, [])

  const value = useMemo(() => ({ session, identity, loading, signIn, signOut }), [session, identity, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requiere AuthProvider')
  return context
}

