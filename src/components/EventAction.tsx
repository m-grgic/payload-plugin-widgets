'use client'

import React from 'react'

/** A quick action that is not a link: it sends an event to the window, and whatever on the page listens for it does the rest. */
export const EventAction = ({ name, detail, children }: { name: string; detail?: unknown; children: React.ReactNode }) => (
  <button type="button" className="widgets-quick__item" onClick={() => window.dispatchEvent(new CustomEvent(name, { detail }))}>
    {children}
  </button>
)
