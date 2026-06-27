export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo" aria-label="Llantera Digital">
    <span className="logo-mark">LD</span>
    {compact ? null : <span>LLANTERA<br /><strong>DIGITAL</strong></span>}
  </div>
}

