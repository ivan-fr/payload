import type { Document, YAMLMap } from 'yaml'

import fs from 'node:fs/promises'
import path from 'node:path'
import { isMap, isSeq, parseDocument } from 'yaml'

import type { DbType } from '../types.js'

/** Adapt the template's Mongo development stack when PostgreSQL is selected. */
export async function configureDockerCompose({
  databaseType,
  databaseUri,
  projectDir,
}: {
  databaseType?: DbType
  databaseUri?: string
  projectDir: string
}): Promise<void> {
  if (databaseType !== 'postgres' && databaseType !== 'vercel-postgres') {
    return
  }

  const file = path.join(projectDir, 'docker-compose.yml')
  const document = await readTemplateCompose({ file })
  if (!document || !hasTemplateMongoStack({ document })) {
    return
  }
  const uri = new URL(
    databaseUri || 'postgres://postgres:postgres@127.0.0.1:5432/your-database-name',
  )
  if (uri.protocol !== 'postgres:' && uri.protocol !== 'postgresql:') {
    return
  }
  uri.username ||= 'postgres'
  if (!uri.pathname || uri.pathname === '/') {
    uri.pathname = '/your-database-name'
  }
  const application = document.getIn(['services', 'payload']) as YAMLMap

  document.deleteIn(['services', 'mongo'])
  document.setIn(['services', 'postgres'], document.createNode(buildPostgresService({ uri })))
  application.set(
    'depends_on',
    document.createNode(replaceMongoDependency({ dependencies: application.get('depends_on') })),
  )
  document.setIn(['volumes', 'pgdata'], null)
  setApplicationDatabaseURL({ application, databaseType, document, uri })
  await fs.writeFile(file, document.toString())
}

async function readTemplateCompose({ file }: { file: string }): Promise<Document | undefined> {
  try {
    return parseDocument(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function hasTemplateMongoStack({ document }: { document: Document }): boolean {
  const mongo = document.getIn(['services', 'mongo'])
  const application = document.getIn(['services', 'payload'])
  const dependencies = document.getIn(['services', 'payload', 'depends_on'])

  if (
    document.errors.length ||
    document.hasIn(['services', 'postgres']) ||
    !isMap(mongo) ||
    !isMap(application)
  ) {
    return false
  }
  if (!/^mongo(?::|@|$)/.test(String(mongo.get('image')))) {
    return false
  }
  return isSeq(dependencies)
    ? dependencies.toJSON().includes('mongo')
    : isMap(dependencies) && dependencies.has('mongo')
}

function buildPostgresService({ uri }: { uri: URL }) {
  const user = decodeURIComponent(uri.username || 'postgres')
  const password = decodeURIComponent(uri.password)
  const database = decodeURIComponent(uri.pathname.slice(1) || 'your-database-name')

  return {
    environment: {
      POSTGRES_DB: escapeInterpolation({ value: database }),
      POSTGRES_USER: escapeInterpolation({ value: user }),
      ...(password
        ? { POSTGRES_PASSWORD: escapeInterpolation({ value: password }) }
        : { POSTGRES_HOST_AUTH_METHOD: 'trust' }),
    },
    healthcheck: {
      interval: '2s',
      retries: 10,
      test: ['CMD-SHELL', 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'],
      timeout: '5s',
    },
    image: 'postgres:17-alpine',
    ports: [`127.0.0.1:${uri.port || '5432'}:5432`],
    restart: 'unless-stopped',
    volumes: ['pgdata:/var/lib/postgresql/data'],
  }
}

function replaceMongoDependency({ dependencies }: { dependencies: unknown }) {
  const otherDependencies = isSeq(dependencies)
    ? Object.fromEntries(
        (dependencies.toJSON() as string[])
          .filter((name) => name !== 'mongo')
          .map((name) => [name, { condition: 'service_started' }]),
      )
    : Object.fromEntries(
        Object.entries((dependencies as YAMLMap).toJSON()).filter(([name]) => name !== 'mongo'),
      )

  return { ...otherDependencies, postgres: { condition: 'service_healthy' } }
}

function setApplicationDatabaseURL({
  application,
  databaseType,
  document,
  uri,
}: {
  application: YAMLMap
  databaseType: DbType
  document: Document
  uri: URL
}) {
  if (!['::1', '[::1]', '127.0.0.1', 'localhost'].includes(uri.hostname)) {
    return
  }
  uri.hostname = 'postgres'
  uri.port = '5432'
  const key = databaseType === 'vercel-postgres' ? 'POSTGRES_URL' : 'DATABASE_URL'
  const environment = application.get('environment')
  const value = escapeInterpolation({ value: uri.toString() })

  if (isSeq(environment)) {
    const values = (environment.toJSON() as string[]).filter(
      (entry) => !entry.startsWith(`${key}=`),
    )
    application.set('environment', document.createNode([...values, `${key}=${value}`]))
  } else {
    document.setIn(['services', 'payload', 'environment', key], value)
  }
}

function escapeInterpolation({ value }: { value: string }): string {
  return value.replaceAll('$', () => '$$')
}
