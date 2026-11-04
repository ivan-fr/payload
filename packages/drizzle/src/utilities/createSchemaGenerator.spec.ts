import type { DrizzleAdapter } from '../types.js'

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pgEnum, pgSchema } from 'drizzle-orm/pg-core'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { columnToCodeConverter } from '../postgres/columnToCodeConverter.js'
import { createSchemaGenerator } from './createSchemaGenerator.js'

describe('generated locale enum (#17736)', () => {
  it.each([undefined, 'tenant'])(
    'should preserve the runtime SQL enum name for schema %s',
    async (schemaName) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'payload-locale-enum-'))
      const outputFile = path.join(directory, 'schema.ts')
      const adapter = {
        packageName: '@payloadcms/db-postgres',
        schemaName,
        payload: { config: { localization: { localeCodes: ['en', 'fr'] } } },
        rawTables: {
          posts_locales: {
            name: 'posts_locales',
            columns: {
              _locale: { name: '_locale', type: 'enum', locale: true, options: ['en', 'fr'] },
            },
            indexes: {},
            foreignKeys: {},
          },
        },
        rawRelations: {},
      } as unknown as DrizzleAdapter

      try {
        await createSchemaGenerator({
          columnToCodeConverter,
          corePackageSuffix: 'pg-core',
          enumImport: 'pgEnum',
          schemaImport: 'pgSchema',
          tableImport: 'pgTable',
        }).call(adapter, { outputFile, log: false, prettify: false })
        const code = await readFile(outputFile, 'utf8')
        const parsed = ts.createSourceFile('schema.ts', code, ts.ScriptTarget.Latest, true)
        const declaration = parsed.statements
          .filter(ts.isVariableStatement)
          .flatMap((statement) => [...statement.declarationList.declarations])
          .find((item) => item.name.getText(parsed) === 'enum__locales')!
        const initializer = declaration.initializer as ts.CallExpression
        const generatedName = initializer.arguments[0] as ts.StringLiteral
        const runtimeEnum = schemaName
          ? pgSchema(schemaName).enum('_locales', ['en', 'fr'])
          : pgEnum('_locales', ['en', 'fr'])

        expect(ts.isCallExpression(initializer)).toBe(true)
        expect(generatedName.text).toBe(runtimeEnum.enumName)
        expect(code).toContain("enum__locales('_locale')")
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
  )
})
