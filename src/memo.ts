// What one request has already asked is not asked again while it lasts: who may see a source, and what the records
// of a selection come to. A dashboard draws every widget with the same request, and a widget asks some of it more
// than once (whether it is for whoever looks, and again as it reads). Kept for the request alone, so nothing of it
// outlives what it was asked for. One store for every copy of this file a bundler makes.
// Nothing here may import a component: this is read by the Payload config.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

const ONCE = Symbol.for('payload-plugin-widgets.once')
const store = (): WeakMap<object, Map<unknown, Loose>> => ((globalThis as Loose)[ONCE] ??= new WeakMap())

/**
 * What `make` comes to, made once for a request and the same `keys`: by what they are, an object by itself. Without
 * a request it is made every time.
 */
export const once = <T>(req: unknown, keys: unknown[], make: () => T): T => {
  if (!req || typeof req !== 'object') return make()
  const all = store()
  let level = all.get(req)
  if (!level) all.set(req, (level = new Map()))
  for (const key of keys.slice(0, -1)) {
    let next = level.get(key)
    if (!next) level.set(key, (next = new Map()))
    level = next as Map<unknown, Loose>
  }
  const last = keys.at(-1)
  if (level.has(last)) return level.get(last) as T
  const made = make()
  level.set(last, made)
  return made
}
