'use client'

import React, { useEffect, useRef } from 'react'
import type { JSONFieldClientComponent, SelectFieldClientComponent } from 'payload'
import { QueryPresetsWhereField, SelectField, useAuth, useField } from '@payloadcms/ui'

// The two fields of a widget's settings that Payload's own cannot be: which source, kept to what whoever is looking
// may read, and which of its records, set up with the filter builder of the admin's lists.

type Collections = { collections?: Record<string, string> }

/** The sources to choose from: those of a collection the signed-in user may read. */
export const SourceField: SelectFieldClientComponent = props => {
  const { collections = {} } = props as Collections
  const { permissions } = useAuth()
  const options = props.field.options.filter(option => {
    const slug = collections[typeof option === 'string' ? option : option.value]
    return !slug || !!permissions?.collections?.[slug]?.read
  })
  return <SelectField {...props} field={{ ...props.field, options }} />
}

/** A field that is kept without being drawn. */
export const Unseen = () => null

/**
 * Which records, as the admin's lists are filtered: conditions that all hold, and alternatives of them. Payload's
 * builder asks a field called `relatedCollection` which collection it is for, so that is kept next to the source.
 */
export const WhereField: JSONFieldClientComponent = props => {
  const { collections = {} } = props as Collections
  const { value: source } = useField<string>({ path: 'source' })
  const { value: related, setValue: setRelated } = useField<string>({ path: 'relatedCollection' })
  const { value, setValue } = useField<unknown>()
  const slug = source ? collections[source] : undefined
  const before = useRef(slug)
  useEffect(() => {
    // the conditions are on the fields of one collection: with another they mean nothing
    if (before.current && before.current !== slug && value) setValue(null)
    before.current = slug
    if (related === slug) return
    // a moment later: the form puts back what it was loaded with as it mounts, and anything set before that is lost
    const later = setTimeout(() => setRelated(slug ?? null, true))
    return () => clearTimeout(later)
  }, [slug, related, setRelated, value, setValue])

  if (!slug || related !== slug) return null
  return <QueryPresetsWhereField {...(props as React.ComponentProps<typeof QueryPresetsWhereField>)} />
}
