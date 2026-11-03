import type { PayloadRequest } from 'payload'

import { deleteDocumentsInputSchema } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { deleteDocumentsTool } from './deleteTool.js'

describe('MCP trash deletion (#19050)', () => {
  it.each([true, false])('should accept trash=%s in the strict public schema', (trash) => {
    expect(deleteDocumentsInputSchema.safeParse({ slug: 'posts', id: 'one', trash }).success).toBe(
      true,
    )
  })

  it('should keep access bypass out of the public schema', () => {
    expect(
      deleteDocumentsInputSchema.safeParse({
        slug: 'posts',
        id: 'one',
        trash: true,
        overrideAccess: true,
      }).success,
    ).toBe(false)
  })

  it.each([
    { id: 'one', trash: true },
    { where: { id: { equals: 'one' } }, trash: true },
    { id: 'one', trash: false },
    { where: { id: { equals: 'one' } }, trash: false },
  ])('should pass trash and authorization to the actual delete handler: %j', async (input) => {
    const remove = vi.fn().mockImplementation(async (args) => {
      if (args.trash !== input.trash) throw new Error('Wrong trash scope')
      return args.id ? { id: args.id } : { docs: [{ id: 'one' }], errors: [] }
    })
    const req = {
      payload: {
        collections: { posts: {} },
        db: { defaultIDType: 'text' },
        delete: remove,
        config: { plugins: [{ slug: '@payloadcms/plugin-mcp', sanitizedOptions: {} }] },
        logger: { child: () => ({ info: vi.fn(), error: vi.fn() }) },
      },
    } as unknown as PayloadRequest
    const args = {
      slug: 'posts',
      authorizedMCP: { overrideAccess: false },
      input,
      req,
    } as unknown as Parameters<typeof deleteDocumentsTool.handler>[0]
    const result = await deleteDocumentsTool.handler(args)

    expect(result.doc).toBeDefined()
    expect(remove).toHaveBeenCalledWith(
      expect.objectContaining({ req, trash: input.trash, overrideAccess: false }),
    )
  })
})
