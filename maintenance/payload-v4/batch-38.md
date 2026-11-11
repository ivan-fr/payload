# Batch 38: sessions, locks, nested rows, selects and query fixes

Payload `4.0.0-beta.6`, branch `codex/six-more-payload-fixes-20261111`, fork PR #10. No upstream issue is closed.

## Origin

The branch was cut before batches 29 to 37 were merged, and its own batches were numbered 29 to 33. After merging `main`, those reports were regrouped here. Seven reports fixed on the branch were already fixed on `main` (#19017, #19055, #16318, #17119, #17778, #16718, #17493), as were thirteen of its earlier ones. For all of them `main`'s implementation was kept and the branch's version dropped. What remains is the thirteen reports below.

Upstream state: the issue pages did not expose an open or closed state in the session and the upstream API was not available. The reports are open in the 2026-11-02 snapshot and marked `not_verified` in the inventory. #19490 was recorded as open on 2026-11-11 by the earlier branch batch.

## Changes

| Official report                                                                                                                                                                          | Change                                                                                                                                         | Evidence                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18132](https://github.com/payloadcms/payload/issues/18132)                                                                                                                             | Logins append their session with the adapters' `$push` instead of writing back the list read earlier in the request.                           | SQLite: eight concurrent logins store eight sessions and all tokens authenticate. One session is stored without the fix.                                |
| [#18160](https://github.com/payloadcms/payload/issues/18160), [#17724](https://github.com/payloadcms/payload/issues/17724), [#16647](https://github.com/payloadcms/payload/issues/16647) | SQL adapters delete the relationship, text and number rows stored below an array or blocks field whenever that field is rewritten.             | SQLite: shorten an array and a blocks field, append an item, read and query. Without the fix the appended item returns the removed item's relationship. |
| [#13089](https://github.com/payloadcms/payload/issues/13089)                                                                                                                             | `sanitizeSelect` no longer mutates its input, so the dataloader cache key matches and relationships that select a virtual field are populated. | SQLite: `defaultPopulate` and `populate` with a virtual field return a bare ID without the fix. Unit tests for non-mutation.                            |
| [#18200](https://github.com/payloadcms/payload/issues/18200)                                                                                                                             | Deleting a user deletes the document locks that user owns. A lock without an owner locks nobody out.                                           | SQLite: delete by ID and in bulk, an ownerless lock, and a control with a living owner that still returns 423.                                          |
| [#17249](https://github.com/payloadcms/payload/issues/17249)                                                                                                                             | Refreshing the token of the `admin.autoLogin` user starts a session instead of returning 403.                                                  | SQLite REST: 200 and one stored session; 403 without the fix. Two controls still return 403.                                                            |
| [#17858](https://github.com/payloadcms/payload/issues/17858)                                                                                                                             | A locale object without a `code` is rejected during config sanitization.                                                                       | Unit tests, one through `sanitizeConfig`.                                                                                                               |
| [#16195](https://github.com/payloadcms/payload/issues/16195)                                                                                                                             | A polymorphic predicate with no compatible ID columns compiles to a constant false, or true for negated operators, instead of disappearing.    | Carried over from the branch's earlier batch; its SQLite UUID suite passes on the merged tree.                                                          |
| [#18273](https://github.com/payloadcms/payload/issues/18273), [#18312](https://github.com/payloadcms/payload/issues/18312)                                                               | Nested block queries and inverse joins through blocks resolve tables, parent IDs and aliases from the root document.                           | Carried over; query-compilation unit tests and the SQLite suite pass on the merged tree.                                                                |
| [#18355](https://github.com/payloadcms/payload/issues/18355)                                                                                                                             | MongoDB appends explicit AND predicates and conjoins repeated OR groups instead of overwriting them.                                           | Carried over; unit tests pass. Not run against a live MongoDB in this session.                                                                          |
| [#19490](https://github.com/payloadcms/payload/issues/19490)                                                                                                                             | The admin config provider stays mounted while the layout synchronizes.                                                                         | Carried over; its component spec passes on the merged tree.                                                                                             |

## Limits

- **Sessions.** Adapters cannot remove single array rows, so removing expired sessions, logout and refresh still rewrite the list. Expired sessions are removed in a separate step that re-reads the list right before writing; a session added inside that short window can still be lost. The list is not bounded.
- **Nested rows.** Rows already orphaned in an existing database are removed the next time the affected field is saved. No migration removes them proactively.
- **Locales.** A config with a locale object lacking `code` now fails at startup. It did not work before either, but failed later.
- **Not verified:** live PostgreSQL, MongoDB and D1; multi-process login races; browser or e2e runs for the admin lock status change.

## Validation on the merged tree

Runtime: Node `22.23.4` (the repository asks for `>=24.22.1`), pnpm `11.28.6`, Linux x64.

- `test/server-regressions-batch38`, `batch39` and `batch40` on SQLite: **27 passed across 4 files**.
- Existing SQLite integration suites, all passing: fields, relationships, joins, auth, locked-documents, select, array-update (**745 passed**); localization, versions, access-control, hooks, `server-regressions-batch30` to `batch37` and plugin-ecommerce (**522 passed**).
- Unit: **1,525 passed across 169 files** for drizzle, db-mongodb, next, plugin-ecommerce and the touched areas of payload.
- Types: `pnpm exec tsc -b packages/payload packages/drizzle packages/db-mongodb packages/ui --pretty false` passed.

`test/database` was not run on the merged tree: that suite rewrites its own migration fixtures.

## Inventory

**565 snapshot reports = 205 scoped fixes + 360 unassessed**. The additional-report count is **30**, giving **235 scoped fork fixes**.
