'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation.js'

/**
 * A box to type a title into, and a button beside it; either creates the document with the rest of its fields given
 * here. That it was added is said where a screen reader hears it, until the next one is typed.
 */
export const QuickAdd = ({ api, slug, field = 'title', data = {}, placeholder, failed, submit = 'Add', added = 'Added' }: {
  api: string; slug: string; field?: string; data?: Record<string, unknown>; placeholder: string
  /** What to say where Payload does not say why it could not be added. */
  failed: string
  /** What the button says, and what is said once it is added. */
  submit?: string; added?: string
}) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <form
      className="widgets-tile__add"
      onSubmit={async event => {
        event.preventDefault()
        const input = event.currentTarget.elements.namedItem('value') as HTMLInputElement
        const value = input.value.trim()
        if (!value || busy) return
        setBusy(true)
        setError(null)
        setDone(false)
        try {
          const response = await fetch(`${api}/${slug}`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, [field]: value }),
          })
          if (!response.ok) {
            const body = await response.json().catch(() => null)
            throw new Error(body?.errors?.[0]?.message || failed)
          }
          input.value = ''
          setDone(true)
          router.refresh()
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : failed)
        } finally {
          setBusy(false)
        }
      }}
    >
      <span className="widgets-tile__field">
        <input name="value" type="text" maxLength={200} placeholder={placeholder} aria-label={placeholder} disabled={busy} onInput={() => setDone(false)} />
        <button type="submit" className="widgets-tile__submit" disabled={busy}>{submit}</button>
      </span>
      {/* in the page from the start, so that what comes into it is heard */}
      <p className="widgets-tile__done" aria-live="polite">{done ? added : ''}</p>
      {error ? <p className="widgets-tile__error" role="alert">{error}</p> : null}
    </form>
  )
}
