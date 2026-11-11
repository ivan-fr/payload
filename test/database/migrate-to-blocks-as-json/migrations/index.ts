import * as migration_20261111_145832 from './20261111_145832'
import * as migration_20261111_145839_blocks_as_json from './20261111_145839_blocks_as_json'

export const migrations = [
  {
    up: migration_20261111_145832.up,
    down: migration_20261111_145832.down,
    name: '20261111_145832',
  },
  {
    up: migration_20261111_145839_blocks_as_json.up,
    down: migration_20261111_145839_blocks_as_json.down,
    name: '20261111_145839_blocks_as_json',
  },
]
