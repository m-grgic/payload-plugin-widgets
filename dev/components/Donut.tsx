'use client'

import React, { useState } from 'react'
import type { ChartViewProps } from 'payload-plugin-widgets/rsc'

// A view of the demo's own, and one for the browser: it is handed what the chart tile would be made of, as plain
// data, and keeps which part the pointer is on. A chart library is given `bars` and `series` the same way.

const COLOURS = ['var(--theme-success-500)', 'var(--color-blue-500)', 'var(--theme-warning-500)', 'var(--theme-error-500)', 'var(--theme-elevation-500)']
const ROUND = 2 * Math.PI * 40

export const Donut = ({ label, note, bars, empty, name }: Omit<ChartViewProps, 'req'>) => {
  const [on, setOn] = useState<number | null>(null)
  const whole = bars.reduce((sum, bar) => sum + Math.max(0, bar.amount), 0)
  const parts = bars.map(bar => (Math.max(0, bar.amount) / (whole || 1)) * ROUND)
  return (
    <section className="widgets-tile widgets-tile--plain" data-kind="chart" data-view="donut" data-widget={name}>
      <span className="widgets-tile__label">{label}</span>
      <span className="widgets-tile__note">{on === null ? note : `${bars[on].label}: ${bars[on].shown}`}</span>
      {whole ? (
        <svg viewBox="0 0 100 100" style={{ display: 'block', height: 140, margin: '8px auto 0' }} role="img" aria-label={bars.map(bar => `${bar.label} ${bar.shown}`).join(', ')}>
          {bars.map((bar, index) => {
            const part = parts[index]
            const offset = -parts.slice(0, index).reduce((sum, one) => sum + one, 0)
            return (
              <circle
                key={index} cx="50" cy="50" r="40" fill="none" stroke={COLOURS[index % COLOURS.length]} strokeWidth={on === index ? 16 : 12}
                strokeDasharray={`${part} ${ROUND - part}`} strokeDashoffset={offset} transform="rotate(-90 50 50)"
                onMouseEnter={() => setOn(index)} onMouseLeave={() => setOn(null)}
              />
            )
          })}
        </svg>
      ) : <span className="widgets-tile__note">{empty}</span>}
    </section>
  )
}
