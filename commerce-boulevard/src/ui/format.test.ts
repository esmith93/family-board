/** How figures are written. Municipal budgets are read in millions. */
import { describe, expect, it } from 'vitest'
import { constantValue, duration, escapeHtml, money, percent, signedMoney } from './format'

describe('money', () => {
  it('scales to the size of the number', () => {
    expect(money(742)).toBe('$742')
    expect(money(86_400)).toBe('$86k')
    expect(money(2_590_000)).toBe('$2.59M')
    expect(money(18_200_000)).toBe('$18.2M')
  })

  it('uses a real minus sign, not a hyphen', () => {
    expect(money(-4_100_000)).toBe('−$4.10M')
    expect(signedMoney(120_000)).toBe('+$120k')
  })

  it('can be precise when the exact figure matters', () => {
    expect(money(1_234_567, true)).toBe('$1,234,567')
  })
})

describe('durations', () => {
  it('counts construction in seasons', () => {
    expect(duration(0)).toBe('immediate')
    expect(duration(1)).toBe('1 season')
    expect(duration(3)).toBe('3 seasons')
  })
})

describe('constants in the provenance panel', () => {
  it('writes money with its qualifier', () => {
    expect(constantValue(450000, 'dollars per lane-mile')).toBe('$450k per lane-mile')
  })

  it('writes a fraction as a percentage, keeping what it is a fraction of', () => {
    expect(constantValue(0.9, 'fraction funded by the state')).toBe('90% funded by the state')
    expect(constantValue(0.045, 'fraction per year')).toBe('4.5% per year')
  })

  it('leaves dimensionless figures alone', () => {
    expect(constantValue(0.75, 'dimensionless')).toBe('0.75')
    expect(constantValue(0.71, 'multiplier')).toBe('0.71 multiplier')
  })

  it('writes plain quantities with their units', () => {
    expect(constantValue(25, 'years')).toBe('25 years')
    expect(constantValue(1900, 'passenger cars per hour of green per lane'))
      .toBe('1,900 passenger cars per hour of green per lane')
  })
})

describe('percentages and escaping', () => {
  it('formats a share', () => {
    expect(percent(0.178, 1)).toBe('17.8%')
  })

  it('escapes anything going into the page', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
  })
})
