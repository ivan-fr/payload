import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Posts } from './collections/Posts.js'
import { seed } from './seed/index.js'

process.env.NEXT_TRAILING_SLASH = 'true'

export default buildConfigWithDefaults({
  config: {
    admin: { autoLogin: false },
    collections: [Posts],
    serverURL: `http://localhost:${process.env.PORT || 3000}`,
  },
  seed,
  suite: 'trailing-slash',
})
