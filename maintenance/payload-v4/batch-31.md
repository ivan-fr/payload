# Batch 31: six backend query and access fixes

Revision: `23cca29c17`, Payload `4.0.0-beta.6`, branch `codex/six-more-payload-fixes-20261111`. This batch preserves the uncommitted changes from batches 29 and 30. All six official reports were checked open on 2026-11-11. This report records local validation before the later request to commit and push the branch. No PR or upstream issue closure was made.

| Official report                                              | Change                                                                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18331](https://github.com/payloadcms/payload/issues/18331) | Hidden fields return before hooks/defaults; field read access runs before afterRead hooks. Unreadable containers stop descendant traversal.                                                              | Unit tests cover denied, hidden, absent hidden, override and nested-group cases. SQLite and MongoDB Local API/REST controls omit private values and verify skipped hook side effects.                                                                                                                |
| [#18332](https://github.com/payloadcms/payload/issues/18332) | Each polymorphic target's read-access result constrains its own relationTo branch. A denied target cannot disable permitted targets. Generated constraints remain separate from caller-query validation. | Real SQLite and MongoDB reads retain accessible articles when notes are denied or visibility-filtered; counts exclude private notes. The established constrained-join suite also passes.                                                                                                             |
| [#18355](https://github.com/payloadcms/payload/issues/18355) | MongoDB appends explicit AND predicates to existing predicates and conjoins repeated OR groups instead of overwriting them.                                                                              | Unit tests cover key order, ranges and repeated OR groups. Live MongoDB tests cover both a range next to AND and relationship filters combined with target access and exists predicates. Both integration reproductions fail with the original parser.                                               |
| [#18312](https://github.com/payloadcms/payload/issues/18312) | Nested block queries resolve tables and parent IDs from the root document, constrain storage paths, and preserve aliases for repeated placements.                                                        | PostgreSQL query compilation and real SQLite queries cover scalar fields, relationship IDs, block type and repeated placements. An implicit relationship whose name matches its block slug remains supported.                                                                                        |
| [#18273](https://github.com/payloadcms/payload/issues/18273) | Internal inverse-join queries understand explicit block slugs. Storage-path depth prevents a direct relationship from also matching a deeper nested relationship.                                        | Real SQLite inverse joins through a block and through an array inside that block return the correct page and count. The original implementation throws while inspecting an undefined selected column. This is SQL coverage; support for explicit block-slug inverse joins on MongoDB is not claimed. |
| [#16195](https://github.com/payloadcms/payload/issues/16195) | A polymorphic predicate with no compatible ID columns emits a constant false for positive operators, rather than disappearing. Empty negative predicates retain their true identity.                     | PostgreSQL compilation checks in/equals with an empty UUID list. A real UUID-backed SQLite fixture verifies an access function returning in [] yields zero documents and totalDocs=0; nonempty matches and not_in [] remain covered.                                                                 |

## Behavior and compatibility

Field read-access functions now receive sanitized field data before afterRead hook transformations. Hidden or denied field hooks no longer run for side effects, and hooks cannot reintroduce a hidden field into the response. Trusted reads retain overrideAccess and showHiddenFields controls. The hook documentation records this ordering change; hook-based transformations should not be required to decide read access.

Polymorphic permissions apply per collection. Two established tests previously expected one collection's access Where to filter other collections. Their assertions now verify all independently permitted documents remain visible. Caller-supplied join filters, field-query validation, unsupported paths, operator handlers and collection-specific access constraints retain coverage in the existing suite.

SQL block joins use separate aliases for different placements and reuse an alias for the same placement. Root aliases survive nested arrays. SQL LIKE wildcards can consume dots, so storage-path predicates also verify the number of path segments; a direct block relationship cannot accidentally match an array nested farther inside the block. Existing block-join deduplication and flattened Live Preview input handling from batch 29 remain covered.

No database schema migration or application UI change is introduced. All integration databases are disposable test databases. The MongoDB run uses an isolated replica set started from the existing cached MongoDB 7.0.14 binary.

## Validation

Runtime: Node `24.22.1`, pnpm `11.28.6`, macOS arm64.

- Focused unit suites: **188 passed across 22 files** (Drizzle query/find, Payload field afterRead/database, MongoDB queries).
- SQLite: **68 distinct checks passed across 6 files**: 10 new regressions, 50 existing constrained-join/hook/access checks and 8 prior-batch compatibility tests. These were run as overlapping groups of 60 and 18 passing cases.
- Live MongoDB: **7 passed, 3 explicitly skipped**. The skips are the SQL inverse-join case and the two SQLite-specific UUID tests.
- Package TypeScript checks for payload, drizzle and db-mongodb: passed.
- Targeted oxlint: no errors; existing explicit-any warnings remain. Changed-file formatting and diff whitespace checks passed.
- Main and UUID fixture types were generated. The main fixture includes the shared UUID collection definitions for type coverage; the separate UUID config emits standalone types without another global module declaration. The fixture-wide typecheck still reports failures in the existing shared test/dependency graph, with no diagnostics in the new fixture files.

Representative commands (using the Node version above):

```sh
pnpm exec vitest run --project unit packages/drizzle/src/queries packages/drizzle/src/find packages/payload/src/fields/hooks/afterRead packages/payload/src/database packages/db-mongodb/src/queries
PAYLOAD_DATABASE=sqlite SQLITE_URL=file:/tmp/payload-batch31-final.db pnpm exec vitest run --project int test/server-regressions-batch31 test/joins/int.spec.ts test/hooks/int.spec.ts test/access-control/int.spec.ts -t 'batch 31|empty UUID|Constrained joins|afterRead|hidden fields|respect access control for join'
PAYLOAD_DATABASE=sqlite SQLITE_URL=file:/tmp/payload-batch31-final2.db pnpm exec vitest run --project int test/server-regressions-batch31 test/server-regressions-batch29
PAYLOAD_DATABASE=mongodb MONGODB_URL='<isolated test replica set>' pnpm exec vitest run --project int test/server-regressions-batch31
```

Baseline verification uses a temporary Vite loader with the starting working-tree versions of the behavior modules, preserving earlier uncommitted fixes. The initial focused unit baseline had **10 failures and 2 controls passing**. The final SQLite baseline had **7 failures and 3 controls passing**, reproducing failures across all six reports together with the MongoDB baseline. Both selected MongoDB filter reproductions fail with the original parser. No working source files were swapped for these comparisons.

A broader unit sweep over payload, drizzle and MongoDB query code produced **1,839 passed, 2 skipped and 5 timeouts across 196 files**. The timed-out animated WebP dimension case passed on an isolated rerun. Four unrelated compiled CLI subprocess checks continued timing out, including outside the sandbox. A SWC refresh made no progress and was stopped. A clean full-core unit run or complete build is therefore not claimed. Initial fixture imports, parameterized-test setup, adapter metadata assertions and unsupported public explicit-block-slug predicates were corrected during verification.

Live PostgreSQL/D1, complete monorepo tests and production application builds remain unverified. PostgreSQL evidence is query compilation, not live database execution. No Admin UI, accessibility or WCAG conformance claim is made by these backend tests.

## Inventory

The historical snapshot now contains **159 scoped fixes and 406 unassessed reports**, plus **27 later fixed reports**: **186 scoped fixes in this fork**. The inventory counts fork changes, not upstream issue closures. Existing untracked app files are preserved.
