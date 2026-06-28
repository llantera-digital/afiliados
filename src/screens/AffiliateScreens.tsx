import { useEffect, useState } from 'react'
import { Banknote, CircleDollarSign, Clock3, Users } from 'lucide-react'
import { StatusTag } from '../components/StatusTag'
import { formatDate, mxn } from '../lib/format'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { DashboardSummary, VisibleClient, VisibleCommission, VisibleCoupon } from '../types'

function CommissionTable({ rows }: { rows: VisibleCommission[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Llantera</th><th>Ciudad</th><th>Mensualidad</th><th>Base sin IVA</th><th>Porcentaje</th><th>Comisión</th><th>Estado</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><strong>{row.nombre_negocio}</strong></td><td>{row.ciudad ?? '—'}</td><td>#{row.payment_number}</td><td>{mxn.format(row.commissionable_amount)}</td><td>{row.commission_rate}%</td><td><strong>{mxn.format(row.commission_amount)}</strong></td><td><StatusTag status={row.status}/></td></tr>) : <tr><td colSpan={7} className="empty">Aún no hay comisiones registradas.</td></tr>}</tbody></table></div>
}

export function AffiliateDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>({ pending_amount:0, available_amount:0, paid_amount:0, active_clients:0 })
  const [commissions, setCommissions] = useState<VisibleCommission[]>([])
  useEffect(() => { if (!isSupabaseConfigured) return; void Promise.all([
    supabase.from('affiliate_dashboard_summary').select('*').single(),
    supabase.from('affiliate_visible_commissions').select('*').order('completed_at', { ascending:false }).limit(6),
  ]).then(([s,c]) => { if (s.data) setSummary(s.data); if (c.data) setCommissions(c.data) }) }, [])
  const cards = [
    ['Comisiones pendientes', mxn.format(summary.pending_amount), Clock3, 'En periodo de seguridad'],
    ['Comisiones disponibles', mxn.format(summary.available_amount), CircleDollarSign, 'Listas para el próximo corte'],
    ['Total pagado', mxn.format(summary.paid_amount), Banknote, 'Comisiones depositadas'],
    ['Clientes activos', String(summary.active_clients), Users, 'Clientes comisionables'],
  ] as const
  return <section className="page-content"><div className="metric-grid">{cards.map(([label,value,Icon,help]) => <article className="metric" key={label}><div><span>{label}</span><strong>{value}</strong><small>{help}</small></div><Icon/></article>)}</div><div className="section-heading"><div><h2>Actividad reciente</h2><p>Últimas mensualidades que generaron comisión.</p></div></div><CommissionTable rows={commissions}/></section>
}

export function ClientsScreen() {
  const [rows, setRows] = useState<VisibleClient[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    void supabase.from('affiliate_visible_clients').select('*').then(({data}) => {
      setRows(data ?? [])
      setLoading(false)
    })
  }, [])
  return <section className="page-content"><div className="section-heading"><div><h2>Mis clientes</h2><p>Solo se muestran clientes que contrataron con tu cupón.</p></div></div>{loading ? <p>Cargando clientes…</p> : rows.length ? <div className="client-list">{rows.map(c => <article key={c.affiliation_id}><div><h3>{c.nombre_negocio}</h3><p>{[c.ciudad,c.estado,c.pais].filter(Boolean).join(', ')}</p></div><StatusTag status={c.status}/><dl><div><dt>Mensualidades cobradas</dt><dd>{c.paid_months}</dd></div><div><dt>Última mensualidad</dt><dd>{formatDate(c.last_paid_at)}</dd></div><div><dt>Esquema</dt><dd>{c.commission_tiers.map(t => `${t.start}–${t.indefinite ? '∞' : t.end}: ${t.rate}%`).join(' · ')}</dd></div></dl></article>)}</div> : <div className="empty">Aún no tienes clientes registrados con tu cupón.</div>}</section>
}

export function CommissionsScreen() {
  const [rows, setRows] = useState<VisibleCommission[]>([])
  useEffect(() => { if (isSupabaseConfigured) void supabase.from('affiliate_visible_commissions').select('*').order('completed_at', { ascending:false }).then(({data}) => setRows(data ?? [])) }, [])
  return <section className="page-content"><div className="section-heading"><div><h2>Comisiones</h2><p>Todos los importes se muestran sin IVA.</p></div></div><CommissionTable rows={rows}/></section>
}

export function CouponScreen() {
  const [coupon, setCoupon] = useState<VisibleCoupon | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void supabase.from('affiliate_visible_coupon').select('*').eq('status', 'active').single()
      .then(({ data, error: queryError }) => {
        if (queryError) setError('No fue posible cargar tu cupón.')
        else setCoupon(data as VisibleCoupon)
      })
  }, [])

  if (error) return <section className="page-content"><div className="form-error">{error}</div></section>
  if (!coupon) return <section className="page-content"><p>Cargando cupón…</p></section>

  const tiers = coupon.default_tiers
  const primaryRate = tiers[0]?.rate ?? 0
  const tierDescription = tiers.map((tier, index) => {
    const range = tier.indefinite ? `desde la mensualidad ${tier.start}` : `mensualidades ${tier.start}–${tier.end}`
    return `${index ? 'después, ' : ''}${tier.rate}% en ${range}`
  }).join(' · ')

  return <section className="page-content"><div className="coupon-card"><div><span>Tu cupón</span><strong>{coupon.code}</strong><p>Tu público recibe un descuento permanente al contratar.</p></div><div><span>Descuento fijo</span><strong>{mxn.format(Number(coupon.discount_amount))}</strong><p>Se conserva mientras el cliente mantenga o reactive su cuenta.</p></div><div><span>Esquema para clientes nuevos</span><strong>{primaryRate}%</strong><p>{tierDescription}</p></div></div></section>
}
