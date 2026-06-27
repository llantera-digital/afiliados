export const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

export const shortDate = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (value?: string | null) => value ? shortDate.format(new Date(value)) : '—'

export const statusLabel: Record<string, string> = {
  pending: 'Pendiente', available: 'Disponible', paid: 'Pagada', annulled: 'Anulada',
  active: 'Activa', suspended: 'Suspendida', cancelled: 'Cancelada', inactive: 'Inactiva',
}

