import type { DashboardSummary, VisibleClient, VisibleCommission } from '../types'

export const demoSummary: DashboardSummary = { pending_amount: 6000, available_amount: 4400, paid_amount: 22400, active_clients: 4 }

export const demoCommissions: VisibleCommission[] = [
  { id:'1', nombre_negocio:'Llantas del Norte', ciudad:'Monterrey', completed_at:'2026-06-24T18:00:00Z', payment_method:'transferencia', payment_number:1, commissionable_amount:4000, commission_rate:50, commission_amount:2000, status:'pending', release_at:'2026-07-09T18:00:00Z', paid_at:null },
  { id:'2', nombre_negocio:'Llantera Diamante', ciudad:'Guadalajara', completed_at:'2026-06-08T18:00:00Z', payment_method:'tarjeta', payment_number:3, commissionable_amount:4000, commission_rate:50, commission_amount:2000, status:'available', release_at:'2026-06-23T18:00:00Z', paid_at:null },
  { id:'3', nombre_negocio:'Ruedas del Bajío', ciudad:'León', completed_at:'2026-05-04T18:00:00Z', payment_method:'deposito', payment_number:8, commissionable_amount:4000, commission_rate:50, commission_amount:2000, status:'paid', release_at:'2026-05-19T18:00:00Z', paid_at:'2026-06-07T18:00:00Z' },
]

export const demoClients: VisibleClient[] = [
  { affiliation_id:'1', nombre_negocio:'Llantas del Norte', ciudad:'Monterrey', estado:'Nuevo León', pais:'México', status:'active', paid_months:1, last_paid_at:'2026-06-24T18:00:00Z', commission_tiers:[{start:1,end:12,rate:50,indefinite:false},{start:13,end:24,rate:10,indefinite:false}] },
  { affiliation_id:'2', nombre_negocio:'Llantera Diamante', ciudad:'Guadalajara', estado:'Jalisco', pais:'México', status:'active', paid_months:3, last_paid_at:'2026-06-08T18:00:00Z', commission_tiers:[{start:1,end:12,rate:50,indefinite:false}] },
]

