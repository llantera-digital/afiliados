import { statusLabel } from '../lib/format'

export function StatusTag({ status }: { status: string }) {
  return <span className={`status status-${status}`}><i />{statusLabel[status] ?? status}</span>
}

