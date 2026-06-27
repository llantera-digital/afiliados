import { useEffect, useState } from 'react'
import { Banknote, CircleDollarSign, Clock3, Users } from 'lucide-react'
import { StatusTag } from '../components/StatusTag'
import { demoClients, demoCommissions, demoSummary } from '../data/demo'
import { formatDate, mxn } from '../lib/format'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { DashboardSummary, VisibleClient, VisibleCommission } from '../types'

function CommissionTable({ rows }: { rows: VisibleCommission[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Llantera</th><th>Ciudad</th><th>Mensualidad</th><th>Base sin IVA</th><th>Porcentaje</th><th>Comisión</th><th>Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.nombre_negocio}</strong></td><td>{row.ciudad ?? '—'}</td><td>#{row.payment_number}</td><td>{mxn.format(row.commissionable_amount)}</td><td>{row.commission_rate}%</td><td><strong>{mxn.format(row.commission_amount)}</strong></td><td><StatusTag status={row.status}/></td></tr>)}</tbody></table></div>
}

export function AffiliateDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(demoSummary)
  const [commissions, setCommissions] = useState<VisibleCommission[]>(demoCommissions)
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
  const [rows, setRows] = useState<VisibleClient[]>(demoClients)
  useEffect(() => { if (isSupabaseConfigured) void supabase.from('affiliate_visible_clients').select('*').then(({data}) => { if(data) setRows(data) }) }, [])
  return <section className="page-content"><div className="section-heading"><div><h2>Mis clientes</h2><p>Solo se muestran clientes que contrataron con tu cupón.</p></div></div><div className="client-list">{rows.map(c => <article key={c.affiliation_id}><div><h3>{c.nombre_negocio}</h3><p>{[c.ciudad,c.estado,c.pais].filter(Boolean).join(', ')}</p></div><StatusTag status={c.status}/><dl><div><dt>Mensualidades cobradas</dt><dd>{c.paid_months}</dd></div><div><dt>Última mensualidad</dt><dd>{formatDate(c.last_paid_at)}</dd></div><div><dt>Esquema</dt><dd>{c.commission_tiers.map(t => `${t.start}–${t.indefinite ? '∞' : t.end}: ${t.rate}%`).join(' · ')}</dd></div></dl></article>)}</div></section>
}

export function CommissionsScreen() { return <section className="page-content"><div className="section-heading"><div><h2>Comisiones</h2><p>Todos los importes se muestran sin IVA.</p></div></div><CommissionTable rows={demoCommissions}/></section> }

export function CouponScreen() { return <section className="page-content"><div className="coupon-card"><div><span>Tu cupón</span><strong>AFILIADO1000</strong><p>Tu público recibe un descuento permanente al contratar.</p></div><div><span>Descuento fijo</span><strong>{mxn.format(1000)}</strong><p>Se conserva mientras el cliente mantenga o reactive su cuenta.</p></div><div><span>Esquema para clientes nuevos</span><strong>50%</strong><p>Mensualidades 1–12 · después 10% hasta la 24.</p></div></div></section> }

