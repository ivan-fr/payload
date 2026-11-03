import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Cloud, cloudPlugin, Fillers, Media, Other, Posts } from './collections/index.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch13',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    upload: { transformers: [] },
    collections: [Posts, Media, Other, Cloud, ...Fillers],
    plugins: [cloudPlugin],
    endpoints: [
      {
        path: '/batch13-explicit',
        method: 'get',
        handler: () => new Response('GET', { headers: { 'x-handler': 'get' } }),
      },
      {
        path: '/batch13-explicit',
        method: 'head',
        handler: () => new Response('HEAD', { headers: { 'x-handler': 'head' } }),
      },
      {
        path: '/batch13-fallback',
        method: 'get',
        handler: (req) =>
          Response.json({ method: req.method }, { headers: { 'x-handler': req.method! } }),
      },
      { path: '/batch13-post', method: 'post', handler: () => Response.json({ created: true }) },
      {
        path: '/batch13-error',
        method: 'get',
        handler: () => {
          throw new Error('Test failure')
        },
      },
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
