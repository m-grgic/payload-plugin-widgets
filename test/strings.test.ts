import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { STRINGS } from '../src/strings'

// What a project translates is the list in ../src/strings.ts: these keep it to what the widgets really say.

const src = join(dirname(fileURLToPath(import.meta.url)), '../src')
const files = (directory: string): string[] => readdirSync(directory).flatMap(name => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(path) && !path.endsWith('strings.ts') ? [path] : []
})
const code = files(src).map(path => readFileSync(path, 'utf8')).join('\n')
// with what is only said about the code taken out
const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const literal = String.raw`'((?:[^'\\\n]|\\.)*)'`
const unescaped = (text: string) => text.replace(/\\(.)/g, '$1')
const known = new Set<string>(STRINGS)

test('everything a widget says is in the list a project translates', () => {
  // said through `t`, as the label or the description of a field, or as a problem
  const said = [
    new RegExp(String.raw`\bt\(${literal}`, 'g'),
    new RegExp(String.raw`\b(?:label|description|text):\s*${literal}`, 'g'),
    new RegExp(String.raw`\b(?:missing|unset)\((?:req,\s*)?${literal}`, 'g'),
  ].flatMap(pattern => [...bare.matchAll(pattern)].map(match => unescaped(match[1])))
  assert.ok(said.length > 60, `only ${said.length} found: the patterns no longer match how things are said`)
  const missing = [...new Set(said)].filter(text => !known.has(text))
  assert.deepEqual(missing, [])
})

test('nothing is listed that no widget says', () => {
  const unsaid = STRINGS.filter(text => !bare.includes(`'${text.replace(/'/g, "\\'")}'`) && !bare.includes(`"${text}"`) && !bare.includes(`\`${text}\``))
  assert.deepEqual(unsaid, [])
})

test('no string is listed twice', () => {
  assert.equal(known.size, STRINGS.length)
})
