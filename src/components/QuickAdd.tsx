'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation.js'

/** A box to type a title into; Enter creates the document with the rest of its fields given here. */
export const QuickAdd = ({ api, slug, field = 'title', data = {}, placeholder, failed }: {
  api: string; slug: string; field?: string; data?: Record<string, unknown>; placeholder: string
  /** What to say where Payload does not say why it could not be added. */
  failed: string
}) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        try {
          const response = await fetch(`${api}/${slug}`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, [field]: value }),
          })
          if (!response.ok) {
            const body = await response.json().catch(() => null)
            throw new Error(body?.errors?.[0]?.message || failed)
          }
          input.value = ''
          router.refresh()
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : failed)
        } finally {
          setBusy(false)
        }
      }}
    >
      <input name="value" type="text" maxLength={200} placeholder={placeholder} aria-label={placeholder} disabled={busy} />
      {error ? <p className="widgets-tile__error" role="alert">{error}</p> : null}
    </form>
  )
}
