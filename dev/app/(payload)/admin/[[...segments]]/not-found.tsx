import type { Metadata } from 'next'

import payloadConfig from '@payload-config'
import { generatePageMetadata, NotFoundPage } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config: payloadConfig, params, searchParams })

const NotFound = ({ params, searchParams }: Args) => NotFoundPage({ config: payloadConfig, params, searchParams, importMap })

export default NotFound
