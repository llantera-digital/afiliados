export type UserRole = 'admin' | 'affiliate'

export interface PortalIdentity {
  username: string
  role: UserRole
  affiliateId: string | null
}

export interface DashboardSummary {
  pending_amount: number
  available_amount: number
  paid_amount: number
  active_clients: number
}

export interface VisibleCommission {
  id: string
  nombre_negocio: string
  ciudad: string | null
  completed_at: string
  payment_method: string
  payment_number: number
  commissionable_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'available' | 'paid' | 'annulled'
  release_at: string
  paid_at: string | null
}

export interface VisibleClient {
  affiliation_id: string
  nombre_negocio: string
  ciudad: string | null
  estado: string | null
  pais: string | null
  status: string
  paid_months: number
  last_paid_at: string | null
  commission_tiers: Array<{ start: number; end: number | null; rate: number; indefinite: boolean }>
}

export interface VisibleCoupon {
  code: string
  discount_amount: number
  status: string
  default_tiers: Array<{ start: number; end: number | null; rate: number; indefinite: boolean }>
}
