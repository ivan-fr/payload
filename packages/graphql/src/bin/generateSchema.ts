import type { SanitizedConfig } from 'payload'

import { printSchema } from 'graphql'
import fs from 'node:fs'

import { configToSchema } from '../index.js'
export function generateSchema(config: SanitizedConfig): void {
  const outputFile = process.env.PAYLOAD_GRAPHQL_SCHEMA_PATH || config.graphQL.schemaOutputFile

  const { schema } = configToSchema(config)

  fs.writeFileSync(outputFile, printSchema(schema))
}
