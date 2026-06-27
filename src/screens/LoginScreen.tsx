import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Logo'

export function LoginScreen() {
  const { identity, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (identity) return <Navigate to={identity.role === 'admin' ? '/admin' : '/portal'} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try { await signIn(username, password) } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión') } finally { setBusy(false) }
  }
  return <div className="login-page"><div className="login-brand"><Logo/><div><h1>Referencias que se convierten en relaciones duraderas.</h1><p>Consulta clientes, mensualidades y comisiones con total transparencia.</p></div><small>© 2026 Llantera Digital</small></div><div className="login-panel"><form className="login-card" onSubmit={(e) => void submit(e)}><h2>Iniciar sesión</h2><p>Ingresa tus credenciales del portal.</p><label>Usuario<div className="input-wrap"><UserRound size={19}/><input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Tu usuario"/></div></label><label>Contraseña<div className="input-wrap"><LockKeyhole size={19}/><input required minLength={8} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña"/><button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary-button" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button><div className="security-note">Tus credenciales están protegidas y nunca se muestran en el portal.</div></form></div></div>
}

