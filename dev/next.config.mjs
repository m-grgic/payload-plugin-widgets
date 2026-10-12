import { existsSync } from 'node:fs'
import path from 'node:path'
import { withPayload } from '@payloadcms/next/withPayload'

// the nearest directory up from here that Next is installed in: the package's own, or the repository's it is kept in
const root = (from => {
  for (let at = from; at !== path.dirname(at); at = path.dirname(at)) if (existsSync(path.join(at, 'node_modules/next'))) return at
  return from
})(import.meta.dirname)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // the plugin is read from its source here
  transpilePackages: ['payload-plugin-widgets'],
  turbopack: { root },
  outputFileTracingRoot: root,
  typescript: { ignoreBuildErrors: true },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
