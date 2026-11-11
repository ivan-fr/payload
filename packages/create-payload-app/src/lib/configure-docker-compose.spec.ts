import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { configureDockerCompose } from './configure-docker-compose.js'

let projectDir: string
const original =
  'services:\n  payload:\n    image: node:24.22.1-alpine\n    depends_on: [mongo, redis]\n    environment: {CUSTOM: kept}\n  mongo:\n    image: mongo:latest\n  redis:\n    image: redis:7\nvolumes:\n  data:\n  node_modules:\n'

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), 'payload-compose-'))
})
afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true })
})

describe('selected Postgres development stack (#12764)', () => {
  it('should replace the template Mongo service and preserve unrelated services and settings', async () => {
    await writeFile(path.join(projectDir, 'docker-compose.yml'), original)
    await configureDockerCompose({
      projectDir,
      databaseType: 'postgres',
      databaseUri: 'postgres://ivan:test%24password@127.0.0.1:5544/app',
    })
    const result = parse(await readFile(path.join(projectDir, 'docker-compose.yml'), 'utf8'))

    expect(result.services.mongo).toBeUndefined()
    expect(result.services.postgres.environment).toEqual({
      POSTGRES_USER: 'ivan',
      POSTGRES_PASSWORD: 'test$$password',
      POSTGRES_DB: 'app',
    })
    expect(result.services.postgres.ports).toEqual(['127.0.0.1:5544:5432'])
    expect(result.services.payload.environment).toEqual({
      CUSTOM: 'kept',
      DATABASE_URL: 'postgres://ivan:test%24password@postgres:5432/app',
    })
    expect(result.services.payload.depends_on).toEqual({
      redis: { condition: 'service_started' },
      postgres: { condition: 'service_healthy' },
    })
    expect(result.services.redis.image).toBe('redis:7')
    expect(result.volumes).toHaveProperty('data')
    expect(result.volumes).toHaveProperty('pgdata')
  })

  it('should keep existing Postgres and custom database stacks unchanged', async () => {
    for (const contents of [
      original.replace('mongo:latest', 'custom/database:latest'),
      original.replace('  redis:', '  postgres:'),
    ]) {
      await writeFile(path.join(projectDir, 'docker-compose.yml'), contents)
      await configureDockerCompose({ projectDir, databaseType: 'postgres' })
      expect(await readFile(path.join(projectDir, 'docker-compose.yml'), 'utf8')).toBe(contents)
    }
  })

  it('should leave Mongo selection and absent Compose files alone', async () => {
    await configureDockerCompose({ projectDir, databaseType: 'postgres' })
    await writeFile(path.join(projectDir, 'docker-compose.yml'), original)
    await configureDockerCompose({ projectDir, databaseType: 'mongodb' })
    expect(await readFile(path.join(projectDir, 'docker-compose.yml'), 'utf8')).toBe(original)
  })

  it('should retain list-form environment values and use POSTGRES_URL for the Vercel adapter', async () => {
    await writeFile(
      path.join(projectDir, 'docker-compose.yml'),
      original.replace('environment: {CUSTOM: kept}', 'environment: [CUSTOM=kept]'),
    )
    await configureDockerCompose({
      projectDir,
      databaseType: 'vercel-postgres',
      databaseUri: 'postgres://postgres:test@localhost/app',
    })
    const result = parse(await readFile(path.join(projectDir, 'docker-compose.yml'), 'utf8'))

    expect(result.services.payload.environment).toEqual([
      'CUSTOM=kept',
      'POSTGRES_URL=postgres://postgres:test@postgres:5432/app',
    ])
    await writeFile(path.join(projectDir, 'docker-compose.yml'), original)
    await configureDockerCompose({
      projectDir,
      databaseType: 'postgres',
      databaseUri: 'postgres://localhost/app',
    })
    const withoutUser = parse(await readFile(path.join(projectDir, 'docker-compose.yml'), 'utf8'))

    expect(withoutUser.services.postgres.environment.POSTGRES_USER).toBe('postgres')
    expect(withoutUser.services.payload.environment.DATABASE_URL).toBe(
      'postgres://postgres@postgres:5432/app',
    )
  })
})
