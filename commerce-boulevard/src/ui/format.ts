/**
 * How numbers are written on screen.
 *
 * Municipal budgets are read in millions and thousands, not in digits, and a
 * player deciding between a $620,000 restripe and a $2.4M reconstruction needs
 * to see the difference at a glance rather than count zeroes.
 */

export function money(value: number, precise = false): string {
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (precise || abs < 1000) return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
  if (abs < 1_000_000) return `${sign}$${Math.round(abs / 1000).toLocaleString('en-US')}k`
  const millions = abs / 1_000_000
  return `${sign}$${millions >= 10 ? millions.toFixed(1) : millions.toFixed(2)}M`
}

export function signedMoney(value: number): string {
  return value >= 0 ? `+${money(value)}` : money(value)
}

export function percent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function duration(years: number): string {
  if (years <= 0) return 'immediate'
  return years === 1 ? '1 season' : `${years} seasons`
}

/** Format a constant's value in its own units, for the provenance panel. */
export function constantValue(value: number, unit: string): string {
  const lower = unit.toLowerCase()
  if (lower.startsWith('dollar')) return `${money(value, value < 1000)} ${unit.replace(/^dollars?/, '').trim()}`.trim()
  if (lower.startsWith('fraction')) {
    // A fraction reads better as a percentage, with whatever the unit says it
    // is a fraction OF kept alongside it.
    const of = unit.replace(/^fraction\s*(of)?\s*/i, '').trim()
    const shown = `${(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`
    return of ? `${shown} ${of}` : shown
  }
  if (lower.includes('multiplier') || lower.includes('ratio') || lower.includes('dimensionless')) {
    return `${value} ${unit === 'dimensionless' ? '' : unit}`.trim()
  }
  const rounded = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US')
    : Math.abs(value) >= 1 ? String(Math.round(value * 1000) / 1000)
      : String(value)
  return `${rounded} ${unit}`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
