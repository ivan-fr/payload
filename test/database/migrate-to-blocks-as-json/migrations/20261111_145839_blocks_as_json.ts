import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

import { getBlocksToJsonMigrator } from '@payloadcms/db-sqlite/migration-utils'
import { fileURLToPath } from 'url'
import path from 'path'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Configure migration options (optional)
const BATCH_SIZE = 100 // Number of entities to process per batch
const TEMP_FOLDER = path.resolve(dirname, '.payload-blocks-migration') // Folder path to store migration batch

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const migrator = getBlocksToJsonMigrator(payload)
  migrator.setTempFolder(TEMP_FOLDER)
  await migrator.collectAndSaveEntitiesToBatches(req, { batchSize: BATCH_SIZE })

  await db.run(sql`CREATE TABLE \`posts_locales\` (
  	\`localized_content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE UNIQUE INDEX \`posts_locales_parent_id_locale_unique\` ON \`posts_locales\` (\`_parent_id\`,\`_locale\`);`,
  )
  await db.run(sql`DROP TABLE \`posts_versioned_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`_posts_versioned_v_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`posts_batches_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`posts_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`posts_blocks_block_second\`;`)
  await db.run(sql`DROP TABLE \`posts_blocks_block_third\`;`)
  await db.run(sql`DROP TABLE \`posts_blocks_text_block_localized\`;`)
  await db.run(sql`DROP TABLE \`global_versioned_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`_global_versioned_v_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`global_blocks_text_block\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_posts_versioned_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts_versioned\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_posts_versioned_rels\`("id", "order", "parent_id", "path", "users_id") SELECT "id", "order", "parent_id", "path", "users_id" FROM \`posts_versioned_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`posts_versioned_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_posts_versioned_rels\` RENAME TO \`posts_versioned_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE INDEX \`posts_versioned_rels_order_idx\` ON \`posts_versioned_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`posts_versioned_rels_parent_idx\` ON \`posts_versioned_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`posts_versioned_rels_path_idx\` ON \`posts_versioned_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`posts_versioned_rels_users_id_idx\` ON \`posts_versioned_rels\` (\`users_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`__new__posts_versioned_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_versioned_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new__posts_versioned_v_rels\`("id", "order", "parent_id", "path", "users_id") SELECT "id", "order", "parent_id", "path", "users_id" FROM \`_posts_versioned_v_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`_posts_versioned_v_rels\`;`)
  await db.run(
    sql`ALTER TABLE \`__new__posts_versioned_v_rels\` RENAME TO \`_posts_versioned_v_rels\`;`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_versioned_v_rels_order_idx\` ON \`_posts_versioned_v_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_versioned_v_rels_parent_idx\` ON \`_posts_versioned_v_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_versioned_v_rels_path_idx\` ON \`_posts_versioned_v_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_versioned_v_rels_users_id_idx\` ON \`_posts_versioned_v_rels\` (\`users_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`__new_posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_posts_rels\`("id", "order", "parent_id", "path", "users_id") SELECT "id", "order", "parent_id", "path", "users_id" FROM \`posts_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_posts_rels\` RENAME TO \`posts_rels\`;`)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_users_id_idx\` ON \`posts_rels\` (\`users_id\`);`)
  await db.run(sql`ALTER TABLE \`posts_versioned\` ADD \`content\` text;`)
  await db.run(sql`ALTER TABLE \`_posts_versioned_v\` ADD \`version_content\` text;`)
  await db.run(sql`ALTER TABLE \`posts_batches\` ADD \`content\` text;`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`content\` text;`)
  await db.run(sql`ALTER TABLE \`global_versioned\` ADD \`content\` text;`)
  await db.run(sql`ALTER TABLE \`_global_versioned_v\` ADD \`version_content\` text;`)
  await db.run(sql`ALTER TABLE \`global\` ADD \`content\` text;`)
  payload.logger.info('Executed blocks to JSON migration statements.')

  await migrator.migrateEntitiesFromTempFolder(req, { clearBatches: true })
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Migration code
}
