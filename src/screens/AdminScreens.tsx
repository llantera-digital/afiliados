import { useEffect, useState, type FormEvent } from 'react'
import { BadgeDollarSign, Building2, CircleCheckBig, Clock3, Users } from 'lucide-react'
import { StatusTag } from '../components/StatusTag'
import { formatDate, mxn } from '../lib/format'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Affiliate = { id:string; name:string; email:string|null; status:string; default_discount_amount:number; created_at:string }
type ClientOption = { cliente_id:string; nombre_negocio:string; ciudad:string|null; estado:string|null }
type AffiliateOption = { id:string; name:string }

export function AdminDashboard() {
  const [metrics,setMetrics]=useState({affiliates:0,clients:0,pending:0,available:0})
  useEffect(()=>{if(!isSupabaseConfigured)return;void Promise.all([
    supabase.from('affiliates').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('client_affiliations').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('affiliate_commissions').select('commission_amount,status').in('status',['pending','available']),
  ]).then(([a,c,commissions])=>{const totals=(commissions.data??[]).reduce((sum,row)=>{sum[row.status as 'pending'|'available']+=Number(row.commission_amount);return sum},{pending:0,available:0});setMetrics({affiliates:a.count??0,clients:c.count??0,...totals})})},[])
  const cards = [['Afiliados activos',String(metrics.affiliates),Users],['Clientes afiliados',String(metrics.clients),Building2],['Pendiente de liberar',mxn.format(metrics.pending),Clock3],['Disponible para pago',mxn.format(metrics.available),BadgeDollarSign]] as const
  return <section className="page-content"><div className="metric-grid">{cards.map(([label,value,Icon]) => <article className="metric" key={label}><div><span>{label}</span><strong>{value}</strong><small>Vista operativa</small></div><Icon/></article>)}</div><div className="admin-callout"><CircleCheckBig/><div><h2>Operación al día</h2><p>Las comisiones vencidas se liberan mediante el proceso programado e idempotente.</p></div></div></section>
}

export function AffiliatesAdmin() {
  const [rows, setRows] = useState<Affiliate[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const load = () => { if (isSupabaseConfigured) void supabase.from('affiliates').select('id,name,email,status,default_discount_amount,created_at').order('created_at',{ascending:false}).then(({data}) => setRows(data ?? [])) }
  useEffect(load, [])
  const create = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget)
    const {error:operationError}=await supabase.functions.invoke('affiliate-admin-user',{body:{
      username:form.get('username'),password:form.get('password'),role:'affiliate',name:form.get('name'),email:form.get('email'),
      coupon:form.get('coupon'),discount_amount:Number(form.get('discount')),
      tiers:[{start:1,end:12,rate:Number(form.get('rate1')),indefinite:false},{start:13,end:24,rate:Number(form.get('rate2')),indefinite:false}],
    }})
    if(operationError){setError(operationError.message);return}
    setOpen(false); load()
  }
  return <section className="page-content"><div className="section-heading"><div><h2>Afiliados</h2><p>Socios, cupones y esquemas predeterminados.</p></div><button className="primary-button compact" onClick={() => setOpen(true)}>Nuevo afiliado</button></div>{open ? <form className="inline-form" onSubmit={(e)=>void create(e)}><label>Nombre<input name="name" required/></label><label>Correo<input name="email" type="email" required/></label><label>Usuario<input name="username" minLength={3} required/></label><label>Contraseña inicial<input name="password" type="password" minLength={8} required/></label><label>Cupón<input name="coupon" required/></label><label>Descuento fijo<input name="discount" type="number" min="0" step="0.01" required/></label><label>% meses 1–12<input name="rate1" type="number" min="0" max="100" step="0.01" required/></label><label>% meses 13–24<input name="rate2" type="number" min="0" max="100" step="0.01" required/></label>{error?<div className="form-error">{error}</div>:null}<button className="primary-button">Guardar</button><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancelar</button></form>:null}<div className="table-wrap"><table><thead><tr><th>Afiliado</th><th>Correo</th><th>Descuento</th><th>Estado</th><th>Alta</th></tr></thead><tbody>{rows.length ? rows.map(a=><tr key={a.id}><td><strong>{a.name}</strong></td><td>{a.email??'—'}</td><td>{mxn.format(a.default_discount_amount)}</td><td><StatusTag status={a.status}/></td><td>{formatDate(a.created_at)}</td></tr>):<tr><td colSpan={5} className="empty">Aún no hay afiliados. Crea el primero para comenzar.</td></tr>}</tbody></table></div></section>
}

export function PaymentsAdmin() {
  const [message,setMessage]=useState('')
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setMessage('');const f=new FormData(event.currentTarget);const {error}=await supabase.rpc('register_client_payment',{p_billing_period_id:f.get('period'),p_payment_date:f.get('date'),p_amount:Number(f.get('amount')),p_amount_without_tax:Number(f.get('net')),p_concept:f.get('concept'),p_payment_method:f.get('method'),p_internal_reference:f.get('reference')||null,p_is_commissionable:f.get('commissionable')==='on'});setMessage(error?error.message:'Pago registrado correctamente. Los totales y la comisión fueron actualizados.')}
  return <section className="page-content narrow"><div className="section-heading"><div><h2>Registrar pago</h2><p>El sistema rechazará cualquier sobrepago de mensualidad.</p></div></div><form className="stack-form" onSubmit={(e)=>void submit(e)}><label>ID del periodo<input name="period" required placeholder="UUID de la mensualidad"/></label><div className="form-row"><label>Fecha<input name="date" type="date" required/></label><label>Método<select name="method"><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="deposito">Depósito</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select></label></div><div className="form-row"><label>Importe cobrado<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Importe sin IVA<input name="net" type="number" min="0.01" step="0.01" required/></label></div><label>Concepto<input name="concept" required value="Mensualidad SaaS" readOnly/></label><label>Referencia interna (opcional)<input name="reference"/></label><label className="check"><input name="commissionable" type="checkbox" defaultChecked/>Aplicar a la mensualidad recurrente comisionable</label>{message?<div className="form-message">{message}</div>:null}<button className="primary-button">Registrar pago</button></form></section>
}

export function AffiliatedClientsAdmin() {
  const [rows,setRows]=useState<Array<Record<string,unknown>>>([])
  const [clients,setClients]=useState<ClientOption[]>([])
  const [affiliates,setAffiliates]=useState<AffiliateOption[]>([])
  const [open,setOpen]=useState(false)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const today=new Date().toLocaleDateString('en-CA')
  const load=async()=>{
    if(!isSupabaseConfigured)return
    const [affiliationsResult,clientsResult,affiliatesResult]=await Promise.all([
      supabase.from('client_affiliations').select('id,client_id,status,discount_amount_snapshot,affiliated_at,clientes(nombre_negocio,ciudad,estado,pais),affiliates(name),affiliate_coupons(code)').order('affiliated_at',{ascending:false}),
      supabase.from('clientes').select('cliente_id,nombre_negocio,ciudad,estado').order('nombre_negocio'),
      supabase.from('affiliates').select('id,name').eq('status','active').order('name'),
    ])
    setRows(affiliationsResult.data??[])
    const assigned=new Set((affiliationsResult.data??[]).map(row=>String(row.client_id)))
    setClients((clientsResult.data??[]).filter(client=>!assigned.has(client.cliente_id)))
    setAffiliates(affiliatesResult.data??[])
  }
  useEffect(()=>{void load()},[])
  const assign=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setMessage('');setSaving(true)
    const form=new FormData(event.currentTarget)
    const {error}=await supabase.rpc('assign_affiliate_late',{
      p_client_id:form.get('client'),p_affiliate_id:form.get('affiliate'),
      p_effective_date:form.get('date'),p_reason:form.get('reason'),
    })
    setSaving(false)
    if(error){setMessage(error.message);return}
    setMessage('Afiliado asignado. Las comisiones comenzarán en la siguiente mensualidad.')
    setOpen(false);await load()
  }
  return <section className="page-content"><div className="section-heading"><div><h2>Clientes afiliados</h2><p>Afiliación original, cupón y descuento permanente.</p></div><button className="primary-button compact" onClick={()=>{setMessage('');setOpen(true)}}>Asignar afiliado</button></div>{open?<form className="inline-form" onSubmit={(event)=>void assign(event)}><label>Cliente<select name="client" required defaultValue=""><option value="" disabled>Selecciona un cliente</option>{clients.map(client=><option key={client.cliente_id} value={client.cliente_id}>{client.nombre_negocio}{client.ciudad?` · ${client.ciudad}${client.estado?`, ${client.estado}`:''}`:''}</option>)}</select></label><label>Afiliado<select name="affiliate" required defaultValue=""><option value="" disabled>Selecciona un afiliado</option>{affiliates.map(affiliate=><option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></label><label>Fecha efectiva<input name="date" type="date" required defaultValue={today} max={today}/></label><label>Motivo de la atribución<textarea name="reason" required minLength={10} placeholder="Ej. El cliente confirmó que fue referido por Susy."/></label>{clients.length===0?<div className="form-error">No hay clientes disponibles sin afiliado.</div>:null}<button className="primary-button" disabled={saving||clients.length===0}>{saving?'Asignando…':'Guardar asignación'}</button><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancelar</button></form>:null}{message?<div className={message.startsWith('Afiliado asignado')?'form-message':'form-error'}>{message}</div>:null}<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Ubicación</th><th>Afiliado</th><th>Cupón</th><th>Descuento</th><th>Fecha efectiva</th><th>Estado</th></tr></thead><tbody>{rows.length?rows.map((r)=>{const c=r.clientes as Record<string,unknown>,a=r.affiliates as Record<string,unknown>,q=r.affiliate_coupons as Record<string,unknown>;return <tr key={String(r.id)}><td><strong>{String(c?.nombre_negocio??'—')}</strong></td><td>{[c?.ciudad,c?.estado,c?.pais].filter(Boolean).join(', ')}</td><td>{String(a?.name??'—')}</td><td>{String(q?.code??'—')}</td><td>{mxn.format(Number(r.discount_amount_snapshot))}</td><td>{formatDate(String(r.affiliated_at))}</td><td><StatusTag status={String(r.status)}/></td></tr>}):<tr><td colSpan={7} className="empty">Aún no hay clientes afiliados.</td></tr>}</tbody></table></div></section>
}

export function CommissionsAdmin() {
  const [rows,setRows]=useState<Array<Record<string,unknown>>>([])
  useEffect(()=>{if(isSupabaseConfigured)void supabase.from('affiliate_commissions').select('id,payment_number,commissionable_amount,commission_rate,commission_amount,status,generated_at,affiliates(name),clientes(nombre_negocio)').order('generated_at',{ascending:false}).then(({data})=>setRows(data??[]))},[])
  return <section className="page-content"><div className="section-heading"><div><h2>Comisiones</h2><p>Filtra, revisa y prepara pagos sin alterar el historial.</p></div></div><div className="table-wrap"><table><thead><tr><th>Afiliado</th><th>Cliente</th><th>Mensualidad</th><th>Base</th><th>Tasa</th><th>Comisión</th><th>Estado</th></tr></thead><tbody>{rows.map(r=><tr key={String(r.id)}><td>{String((r.affiliates as Record<string,unknown>)?.name??'—')}</td><td><strong>{String((r.clientes as Record<string,unknown>)?.nombre_negocio??'—')}</strong></td><td>#{String(r.payment_number)}</td><td>{mxn.format(Number(r.commissionable_amount))}</td><td>{String(r.commission_rate)}%</td><td>{mxn.format(Number(r.commission_amount))}</td><td><StatusTag status={String(r.status)}/></td></tr>)}</tbody></table></div></section>
}

export function AuditAdmin() {
  const [rows,setRows]=useState<Array<Record<string,unknown>>>([])
  useEffect(()=>{if(isSupabaseConfigured)void supabase.from('affiliate_audit_log').select('id,created_at,action,entity_type,reason').order('created_at',{ascending:false}).limit(100).then(({data})=>setRows(data??[]))},[])
  return <section className="page-content"><div className="section-heading"><div><h2>Auditoría</h2><p>Registro de solo lectura de las operaciones sensibles.</p></div></div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Motivo</th></tr></thead><tbody>{rows.map(r=><tr key={String(r.id)}><td>{formatDate(String(r.created_at))}</td><td><strong>{String(r.action)}</strong></td><td>{String(r.entity_type)}</td><td>{String(r.reason??'—')}</td></tr>)}</tbody></table></div></section>
}
