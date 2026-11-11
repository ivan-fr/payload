# Batch 33: six data-integrity, access and query fixes

Revision: `eaaff6f`, Payload `4.0.0-beta.6`, branch `codex/six-more-payload-fixes-20261111`. No PR or upstream issue closure was made.

Upstream state: the issue pages were readable but did not expose an open or closed state in this session, and the GitHub API for the upstream repository was not available. All reports below are open in the 2026-11-02 snapshot and are marked `not_verified` in the inventory.

| Official report                                                                                                                                                                                  | Change                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18160](https://github.com/payloadcms/payload/issues/18160), with [#17724](https://github.com/payloadcms/payload/issues/17724) and [#16647](https://github.com/payloadcms/payload/issues/16647) | SQL adapters delete the relationship, text and number rows stored below an array or blocks field whenever that field is rewritten. An item appended later no longer inherits the values of a removed item.  | SQLite: shorten an array and a blocks field, append a new item, read and query. At baseline the appended item returns the removed item's relationship. A control keeps the values of fields that the update does not touch. |
| [#13089](https://github.com/payloadcms/payload/issues/13089)                                                                                                                                     | `sanitizeSelect` no longer mutates the select it receives. The dataloader cache key therefore still matches, and a relationship whose `defaultPopulate` or `populate` selects a virtual field is populated. | SQLite: at baseline the relationship comes back as a bare ID for both `defaultPopulate` and `populate`. Unit tests cover non-mutation and an already selected `version` group.                                              |
| [#16718](https://github.com/payloadcms/payload/issues/16718)                                                                                                                                     | Restoring a version keeps the current value of a field the user may not update, instead of dropping it and failing `required`. Fields the user may update still come from the version only.                 | SQLite: restore with `overrideAccess: false` on a required field with `access.update: () => false` returns 400 at baseline. A control restores every field when access is overridden.                                       |
| [#18200](https://github.com/payloadcms/payload/issues/18200)                                                                                                                                     | Deleting a user deletes the document locks that user owns, on all three delete paths. A lock without an owner no longer locks anyone out or crashes the lock status lookup.                                 | SQLite: delete by ID and in bulk; an ownerless lock created directly in the database; a control with a living lock owner still returns 423.                                                                                 |
| [#17493](https://github.com/payloadcms/payload/issues/17493)                                                                                                                                     | With `limitedBoundParameters` (D1), `in` and `not_in` lists on a version's `parent` relationship are written into the SQL like `id` lists, instead of binding one parameter per ID.                         | Compiled SQLite queries with 150 IDs bind fewer than five parameters and return the right rows from a real in-memory SQLite database. Controls: no limit configured, and a text field named `parent`.                       |
| [#17858](https://github.com/payloadcms/payload/issues/17858)                                                                                                                                     | A locale object without a `code` is rejected during config sanitization with the index of the entry, and a hint when a `value` key is found.                                                                | Unit tests for valid string and object locales, missing and empty codes, mixed arrays and the existing empty-list default; one test through `sanitizeConfig`.                                                               |

The preference half of #18200 was already handled in this source. #17724 and #16647 describe the blocks variant of #18160 and are covered by the same change and test; they are recorded in the inventory but the batch counts as six fixes plus two duplicates.

## Behavior and compatibility

**Nested rows.** The cleanup runs only for array and blocks fields present in the written data, and never for `$push` appends. The prefix is compared with `substr`, not `LIKE`, so a field name such as `rows_extra` cannot match the prefix of `rows`. Rows that are already orphaned in an existing database are removed the next time the affected field is saved; no migration removes them proactively. The related open upstream PR #17913 covers blocks only.

**Restore.** The previous behavior, before upstream #16272, backfilled every missing value from the current document. Only the access-denied case is restored here. A user without update access to a field cannot change it through a restore either: the current value wins over the version.

**Locks.** Ownerless locks written by earlier versions are ignored by `getIsLocked` and by the server-side lock check until they expire.

**D1.** A `parent` list containing anything other than numbers, `null` or ID-shaped strings falls back to bound parameters rather than throwing. The separate D1 limit on queries per invocation, mentioned in the report, is not addressed.

**Locales.** A config that mixes string and object locales, or has an object without `code`, now fails at startup. Such a config did not work before; it failed later with unrelated errors. An empty locale list is still accepted.

## Addendum: concurrent logins (#18132)

[#18132](https://github.com/payloadcms/payload/issues/18132) was first excluded and then fixed on request. `addSessionToUser` appends the new session with the adapters' existing `$push` operation instead of writing back the session list it read earlier in the request. Concurrent logins therefore no longer overwrite each other.

Evidence on SQLite: eight concurrent logins store eight sessions and all eight tokens authenticate; at baseline one session is stored. Logging out one of two concurrent sessions leaves the other in place, which also fails at baseline because only one session existed. Expired sessions are still removed on login.

Limits. Adapters cannot remove single array rows, so removing expired sessions, logout and refresh still rewrite the list. Expired sessions are now removed in a separate step that re-reads the list immediately before writing and runs only when something has expired; a session added by another request inside that short window can still be lost. The list is not bounded in length. The MongoDB path uses the same `$push` support as the job log, but was not run against a live MongoDB, and no multi-process or PostgreSQL run was made.

## Investigated and excluded

#17443 reproduces only for non-draft restores, which validate on purpose; the admin restores as drafts. #16199, #14682 and #17928 need a design decision. #17645, #18086, #18139, #18246, #19198 and #15740 are already handled in this source. #14527, #14748, #15585, #15962, #17133 and #17923 did not reproduce on SQLite. Their inventory status is unchanged.

## Validation

Runtime: Node `22.23.4` (the repository asks for `>=24.22.1`), pnpm `11.28.6`, Linux x64.

- `test/server-regressions-batch33` on SQLite: **14 passed**. Against the previous implementation, 9 of those fail and the 5 controls pass.
- Broader SQLite integration, all passing: fields, relationships, array-update, select, locked-documents (**434 passed**); localization, versions, joins, auth, access-control (**716 passed**); database, hooks, trash, collections-rest (**445 passed**).
- Unit: **1,141 passed across 114 files** for `packages/drizzle` and the touched areas of `packages/payload`.
- Types: `pnpm exec tsc -b packages/payload packages/drizzle packages/ui --pretty false` passed. Formatting and oxlint pass on the changed package files.

Not verified: live PostgreSQL, MongoDB and D1. The nested-row cleanup and the `parent` inlining are SQL-adapter code exercised on SQLite and on compiled queries only; the reports were filed against Postgres and D1. No browser or e2e run covers the lock status change in the admin panel.

## Inventory

The historical snapshot now contains **174 scoped fixes and 391 unassessed reports**, plus **27 later fixed reports**: **201 scoped fixes in this fork**. The inventory counts fork changes, not upstream issue closures.
