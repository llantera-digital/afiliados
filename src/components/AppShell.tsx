import { BadgeDollarSign, Building2, ClipboardList, LayoutDashboard, LogOut, ReceiptText, TicketPercent, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

const affiliateLinks = [
  ['/portal', 'Resumen', LayoutDashboard], ['/portal/clientes', 'Mis clientes', Users],
  ['/portal/comisiones', 'Comisiones', BadgeDollarSign], ['/portal/cupon', 'Mi cupón', TicketPercent],
] as const
const adminLinks = [
  ['/admin', 'Resumen', LayoutDashboard], ['/admin/afiliados', 'Afiliados', Users],
  ['/admin/clientes', 'Clientes afiliados', Building2], ['/admin/pagos', 'Registrar pago', ReceiptText],
  ['/admin/comisiones', 'Comisiones', BadgeDollarSign], ['/admin/auditoria', 'Auditoría', ClipboardList],
] as const

export function AppShell() {
  const { identity, signOut } = useAuth()
  const isAdmin = identity?.role === 'admin'
  const links = isAdmin ? adminLinks : affiliateLinks
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/portal' || to === '/admin'}><Icon size={20}/><span>{label}</span></NavLink>)}</nav>
      <button className="sidebar-logout" onClick={() => void signOut()}><LogOut size={19}/>Cerrar sesión</button>
    </aside>
    <main className="main"><header className="topbar"><div><h1>{isAdmin ? 'Administración de afiliados' : `Hola, ${identity?.username ?? 'afiliado'}`}</h1><p>{isAdmin ? 'Control financiero y trazabilidad' : 'Tu actividad de referidos, con cuentas claras'}</p></div></header><Outlet /></main>
  </div>
}

