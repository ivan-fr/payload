export type ArrayRowToInsert = {
  arrays: {
    [tableName: string]: ArrayRowToInsert[]
  }
  arraysToPush: {
    [tableName: string]: ArrayRowToInsert[]
  }
  locales: {
    [locale: string]: Record<string, unknown>
  }
  row: Record<string, unknown>
}

export type BlockRowToInsert = {
  arrays: {
    [tableName: string]: ArrayRowToInsert[]
  }
  arraysToPush: {
    [tableName: string]: ArrayRowToInsert[]
  }
  locales: {
    [locale: string]: Record<string, unknown>
  }
  row: Record<string, unknown>
}

export type RelationshipToDelete = {
  /**
   * When true, `path` is a prefix: every row stored below it is deleted. Used when an array or
   * blocks field is rewritten, so rows that belonged to removed items do not stay behind.
   */
  isPathPrefix?: boolean
  itemToRemove?: any // For $remove operations - stores the item data to match
  locale?: string
  path: string
  relationTo?: string // For simple relationships - stores the relationTo field
}

export type RelationshipToAppend = {
  locale?: string
  path: string
  relationTo?: string // For polymorphic relationships
  value: any
}

export type TextToDelete = {
  /** When true, `path` is a prefix: every row stored below it is deleted. */
  isPathPrefix?: boolean
  locale?: string
  path: string
}

export type NumberToDelete = {
  /** When true, `path` is a prefix: every row stored below it is deleted. */
  isPathPrefix?: boolean
  locale?: string
  path: string
}

export type RowToInsert = {
  arrays: {
    [tableName: string]: ArrayRowToInsert[]
  }
  arraysToPush: {
    [tableName: string]: ArrayRowToInsert[]
  }
  blocks: {
    [tableName: string]: BlockRowToInsert[]
  }
  blocksToDelete: Set<string>
  locales: {
    [locale: string]: Record<string, unknown>
  }
  numbers: Record<string, unknown>[]
  numbersToDelete: NumberToDelete[]
  relationships: Record<string, unknown>[]
  relationshipsToAppend: RelationshipToAppend[]
  relationshipsToDelete: RelationshipToDelete[]
  row: Record<string, unknown>
  selects: {
    [tableName: string]: Record<string, unknown>[]
  }
  texts: Record<string, unknown>[]
  textsToDelete: TextToDelete[]
}
