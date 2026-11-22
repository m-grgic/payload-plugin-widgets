// What is published: every file of src as JavaScript with its types, and the stylesheet beside them as it is.
// The source imports its own files without an extension, as a bundler reads them; what is published says them in
// full, so Node reads it as it is.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')

rmSync(dist, { recursive: true, force: true })
execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json')], { stdio: 'inherit' })
copyFileSync(join(root, 'src/widgets.css'), join(dist, 'widgets.css'))

const files = directory => readdirSync(directory).flatMap(name => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? files(path) : [path]
})

/** A file of its own a specifier stands for, said in full. */
const full = (from, specifier) => {
  if (/\.(js|css|json)$/.test(specifier)) return specifier
  const target = join(dirname(from), specifier)
  if (existsSync(`${target}.js`)) return `${specifier}.js`
  if (existsSync(join(target, 'index.js'))) return `${specifier}/index.js`
  throw new Error(`${from}: nothing is built for "${specifier}"`)
}

for (const file of files(dist).filter(path => /\.(js|d\.ts)$/.test(path))) {
  const before = readFileSync(file, 'utf8')
  let after = before.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g, (_, lead, quote, specifier) => `${lead}${quote}${full(file, specifier)}${quote}`)
  // tsc keeps `import './widgets.css'` in the types too, where there is nothing for it to name: a consumer that
  // checks the types of its libraries (skipLibCheck: false) fails on it. The JavaScript keeps it; the types drop it.
  if (file.endsWith('.d.ts')) after = after.replace(/^\s*import\s*(['"])[^'"]+\.css\1\s*;?[^\S\n]*\n?/gm, '')
  if (after !== before) writeFileSync(file, after)
}
