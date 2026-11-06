import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const directory = fileURLToPath(new URL('./languages/', import.meta.url))
const resources = fs.readdirSync(directory).filter((name) => name.endsWith('.ts'))

describe('declarative language resources', () => {
  it.each(resources)('should keep %s limited to typed dictionary data', (name) => {
    expect(
      isDataModule({ name, text: fs.readFileSync(`${directory}/${name}`, 'utf8') }),
      name,
    ).toBe(true)
  })

  it.each([
    'export const value = (() => "message")()',
    'export const value = new Date()',
    'globalThis.value = "message"',
    'import value from "runtime-module"',
  ])('should reject executable resource content: %s', (text) => {
    expect(isDataModule({ name: 'invalid.ts', text })).toBe(false)
  })
})

function isDataModule({ name, text }: { name: string; text: string }): boolean {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)
  const knownNames = new Set<string>()

  return source.statements.every((statement) => {
    if (ts.isImportDeclaration(statement)) {
      return statement.importClause?.isTypeOnly === true
    }
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      return false
    }
    return statement.declarationList.declarations.every((declaration) => {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !isDataExpression({ node: declaration.initializer, knownNames })
      ) {
        return false
      }
      knownNames.add(declaration.name.text)
      return true
    })
  })
}

function isDataExpression({
  node,
  knownNames,
}: {
  node: ts.Expression
  knownNames: Set<string>
}): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return true
  }
  if (ts.isIdentifier(node)) {
    return knownNames.has(node.text)
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        isDataExpression({ node: property.initializer, knownNames }),
    )
  }
  return false
}
