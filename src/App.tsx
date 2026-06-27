import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { AdminDashboard, AffiliatesAdmin, AffiliatedClientsAdmin, AuditAdmin, CommissionsAdmin, PaymentsAdmin } from './screens/AdminScreens'
import { AffiliateDashboard, ClientsScreen, CommissionsScreen, CouponScreen } from './screens/AffiliateScreens'
import { LoginScreen } from './screens/LoginScreen'

function Protected({ role }: { role: 'admin'|'affiliate' }) {
  const { identity, loading } = useAuth()
  if (loading) return <div className="loading">Cargando portal…</div>
  if (!identity) return <Navigate to="/login" replace />
  if (identity.role !== role) return <Navigate to={identity.role === 'admin' ? '/admin' : '/portal'} replace />
  return <AppShell />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginScreen/>}/>
    <Route element={<Protected role="affiliate"/>}>
      <Route path="/portal" element={<AffiliateDashboard/>}/><Route path="/portal/clientes" element={<ClientsScreen/>}/><Route path="/portal/comisiones" element={<CommissionsScreen/>}/><Route path="/portal/cupon" element={<CouponScreen/>}/>
    </Route>
    <Route element={<Protected role="admin"/>}>
      <Route path="/admin" element={<AdminDashboard/>}/><Route path="/admin/afiliados" element={<AffiliatesAdmin/>}/><Route path="/admin/clientes" element={<AffiliatedClientsAdmin/>}/><Route path="/admin/pagos" element={<PaymentsAdmin/>}/><Route path="/admin/comisiones" element={<CommissionsAdmin/>}/><Route path="/admin/auditoria" element={<AuditAdmin/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes>
}
