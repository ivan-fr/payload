# Payload v4 maintenance: core, storage and plugin regressions

This branch fixes eighty-four reported core, storage and plugin regressions against Payload **4.0.0-beta.6**, based on upstream commit `ec351643011603cf75dc91db5d03f80ff120f1e9`. The npm `beta` tag was checked on 2026-11-02; `latest` still points to 3.92.1. This is a beta fork, not a stable Payload 4 release.

The [inventory](issues.json) records **565 open issues**, excluding pull requests. Eighty-three snapshot issues have scoped fixes here; **482 snapshot issues remain unassessed**. Issue #19292 opened after the snapshot and is tracked under `additional_issues`, bringing this branch to **84 scoped fixes**. The historical snapshot total is unchanged. The machine-readable snapshot is [issues.json](issues.json). Inventorying a report does not establish that it still reproduces on v4, and no upstream issue has been closed.

## Changes and evidence

| Upstream issue                                               | Result in this branch                                                                                                                                                                | Regression coverage                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18653](https://github.com/payloadcms/payload/issues/18653) | A refused commit rejects instead of reporting success. Session cleanup preserves the original failure; intentional rollbacks still resolve.                                          | Successful commit, refused commit, rollback, connection failure, cleanup failure, and a real libSQL deferred foreign-key failure at COMMIT.                   |
| [#18935](https://github.com/payloadcms/payload/issues/18935) | `findByID` returns null for invalid IDs when `disableErrors` is true and retains 404 behavior otherwise.                                                                             | Null, undefined, empty string, NaN and both infinities with errors enabled/disabled. No database read for invalid IDs.                                        |
| [#19044](https://github.com/payloadcms/payload/issues/19044) | A joined delete lookup with no match returns null rather than replaying the joined filter without joins. Missing preference deletion returns 404.                                    | Empty joined selection, ordinary lookup, zero-valued numeric ID, and authenticated REST deletion of a missing preference with unrelated preferences retained. |
| [#19067](https://github.com/payloadcms/payload/issues/19067) | Global GraphQL updates default missing data to an empty object. Global policy type names use the configured entity name.                                                             | Resolver input default/preservation and custom/fallback global access type names.                                                                             |
| [#19167](https://github.com/payloadcms/payload/issues/19167) | SQL `not_like` excludes partial word matches consistently with the MongoDB implementation. Numeric/relationship/UUID comparisons use equality operators rather than string matching. | Real SQLite predicates, multiple words and case handling, parameterized Postgres SQL, and full Payload SQLite query integration.                              |
| [#19244](https://github.com/payloadcms/payload/issues/19244) | All callers share the actual reload promise. Config/reload failures reject waiting callers and leave reload retryable.                                                               | Rejected config, rejected reload, successful retry, and one shared reload for parallel calls.                                                                 |

## Validation

- New regression tests were first exercised against the original implementation and reproduced each of the six reported failures.
- Focused tests exercise the actual functions; driver/operation mocks are used only where stated by the tests. SQL predicate tests execute real SQLite queries. The commit failure test uses a real file-backed libSQL database and cleans up its files.
- Broader unit validation: **1,618 passed, 2 skipped across 144 files**. Command: `pnpm exec vitest run --project unit packages/drizzle packages/graphql packages/payload`.
- Types: passed. Command: `pnpm exec tsc -b packages/drizzle packages/graphql --pretty false`.
- Formatting: `pnpm exec oxfmt --check` on changed source, tests and maintenance files.
- Lint: `pnpm exec oxlint` on changed source and test files. Existing warnings in `index.ts` and `parseParams.ts` are outside this batch.
- SQLite query integration: **2 passed**. Command: `PAYLOAD_DATABASE=sqlite pnpm exec vitest run --project int test/fields/int.spec.ts -t 'should (query not_like on value|exclude partial word matches with not_like)'`.
- SQLite preference REST integration: **1 passed**. Command: `PAYLOAD_DATABASE=sqlite pnpm exec vitest run --project int test/auth/int.spec.ts -t 'should return 404 when deleting a missing preference key'`.

The first clean checkout needed Payload's SWC compilation for its CLI subprocess tests: `pnpm --filter payload build:swc`. After that compilation those tests pass. A normal install hit an environment-specific `better-sqlite3` build failure; dependencies were linked using `pnpm install --frozen-lockfile --ignore-scripts`. The libSQL-backed integration tests run successfully despite that optional tooling build failure.

Live PostgreSQL, MongoDB and Cloudflare D1 integration, full application builds, browser tests, and a full monorepo test run are **not claimed**. In particular, the Postgres query is compiled and the shared transaction code is exercised with a real SQLite driver, but a live Postgres deferred-constraint test remains necessary before treating that adapter as fully verified. No UI components were changed.

## Second batch: six additional open issues

The branch was synchronized with fork `main` at `dec32f05dcd892b71359909388c78d747eeea03c` before these changes. Each issue below was checked open on the official `payloadcms/payload` repository on 2026-11-03 and reproduced on this source revision before fixing it. No upstream issue is closed by this fork.

| Official issue                                               | Result                                                                                                                                                                                  | Regression evidence                                                                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#19292](https://github.com/payloadcms/payload/issues/19292) | File URLs keep the object filename without a trailing slash; admin/API routes and external URLs retain their behavior.                                                                  | Relative/absolute URLs with basePath, encoded filenames, transformer/prefix query strings, and route/external URL controls.                                                              |
| [#19267](https://github.com/payloadcms/payload/issues/19267) | Config reloads retain shared, already-sanitized blocks instead of dropping them.                                                                                                        | Repeated sanitization retains the flattened block and adds no duplicate base ID fields.                                                                                                  |
| [#19246](https://github.com/payloadcms/payload/issues/19246) | Direct-upload name collision checks use the signed semantic prefix when the filename compound index contains prefix. Global filename uniqueness stays global.                           | Real filename lookup and signed receipt logic with a query-aware database stub: cross-prefix, same-prefix, global, empty-prefix and composite-prefix cases.                              |
| [#18191](https://github.com/payloadcms/payload/issues/18191) | Internal metadata writes use isolated recursion context and restore the original context even if nested writes replace it or reject. Preserved buffers belong to the current operation. | Reused caller context across two uploads; normal and managed metadata success/failure; request query restoration; stale-buffer replacement. The related upstream PR #17558 remains open. |
| [#18382](https://github.com/payloadcms/payload/issues/18382) | Downloaded filesize is measured from the bytes read, rather than Content-Length.                                                                                                        | Missing and inaccurate headers with a multibyte body; the returned bytes and size must agree.                                                                                            |
| [#18180](https://github.com/payloadcms/payload/issues/18180) | An omitted request locale resolves to defaultLocale even when translation fallback is disabled.                                                                                         | Null/undefined/empty locale cases, explicit/wildcard controls, and SQLite REST collection queries, document reads and global reads.                                                      |

Before the fixes, all six focused unit files failed (17 failing cases), and the localized REST query returned 500. After the fixes, the focused cases pass and REST returns 200 with default-locale data. Unit tests stub provider/database boundaries where stated; they do not claim to contact live S3, R2, Azure, GCS or Vercel storage.

Final validation commands:

- `pnpm exec vitest run --project unit packages/payload packages/plugin-cloud-storage packages/drizzle packages/graphql packages/storage-s3 packages/storage-gcs packages/storage-azure packages/storage-r2 packages/storage-vercel-blob`: 1,748 passed, 2 pre-existing skips, 174 files.
- Selected SQLite integration coverage: **6 passed** (the three first-batch regressions and the three REST locale regressions), using `SQLITE_URL=file:/tmp/payload-twelve-isolated-20261103.db PAYLOAD_DATABASE=sqlite`. A previous run could not initialize the reused local database because it was corrupt; the isolated database run has no unhandled errors.
- `pnpm exec tsc -b packages/plugin-cloud-storage --pretty false`: passed (including Payload and referenced projects).
- `pnpm lint --quiet`: passed. This is the CI package/tool lint scope; the existing localization integration file has unrelated test-lint violations outside that scope.
- Repository formatting, the 24 CI helper tests and actionlint are checked before publication. Full remote validation must pass on the final PR revision before merge.

## Third batch: six additional open issues

These official reports were checked open on 2026-11-03. The fixes are additions to the twelve previous fixes on PR #1; the base remains fork main at `dec32f05dcd892b71359909388c78d747eeea03c`. GCS report #18284 was investigated but excluded because v4 already inserts storage fields when disabled.

| Official issue                                               | Result                                                                                                                                                  | Regression evidence                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18768](https://github.com/payloadcms/payload/issues/18768) | Local API calls inherit the caller's fallback locale when no override is supplied.                                                                      | Locale code, false and fallback-array preservation; explicit override and fresh-request default controls; real SQLite localized document read retaining the request fallback.                                                                         |
| [#18324](https://github.com/payloadcms/payload/issues/18324) | Config discovery resolves rootDir/outDir against tsconfig; synchronous and asynchronous upward searches normalize relative paths and terminate at root. | Bounded Node subprocesses reproduce both infinite loops, parent-file discovery, and config path selection relative to a tsconfig outside the working directory.                                                                                       |
| [#19050](https://github.com/payloadcms/payload/issues/19050) | MCP delete accepts trash and forwards true/false to single and bulk deletes.                                                                            | Strict schema accepts trash while rejecting access bypass; actual tool handler forwards trash, request and authorized access to a boundary stub.                                                                                                      |
| [#18338](https://github.com/payloadcms/payload/issues/18338) | Variant title/option validation and cart subtotal reads reuse the current request transaction.                                                          | Transaction-visibility boundary stubs for product/option/cart reads and duplicate validation; real SQLite product, variant and cart creation in one transaction, rolled back afterward.                                                               |
| [#18406](https://github.com/payloadcms/payload/issues/18406) | Single and bulk document-lock reads reuse the SQL transaction connection, preserving the MongoDB session exception.                                     | A transaction-aware database stub rejects reads that would acquire another connection; active foreign locks still return 423, bulk locking filters own/expired locks, and overrides skip reads. This is not a live PostgreSQL pool exhaustion test.   |
| [#18055](https://github.com/payloadcms/payload/issues/18055) | Task/workflow errors retain their cause and original handler stack through function and JSON workflows.                                                 | Actual runners and error persistence functions retain handler frames in job and task-log updates; cancellation/ownership signals and non-Error throws retain behavior. SQLite integration reads persisted task and workflow errors from payload-jobs. |

Before fixing, the final focused unit suite had **27 failing cases across all seven files** (9 controls passed). The localized read and the two persisted job-stack integration cases also fail against the original implementation. External provider/database boundaries are explicitly stubbed in unit tests. A live PostgreSQL pool exhaustion regression remains unverified; SQLite alone does not establish PostgreSQL transaction behavior. The complete remote database suites must also pass.

Final local validation:

- `pnpm exec vitest run --project unit packages/payload packages/plugin-cloud-storage packages/drizzle packages/graphql packages/plugin-ecommerce packages/plugin-mcp packages/storage-s3 packages/storage-gcs packages/storage-azure packages/storage-r2 packages/storage-vercel-blob`: **1,982 passed, 2 pre-existing skips, 192 files**, including all 36 new unit cases and the previous twelve fixes.
- Selected SQLite integration: **10 passed** across six files, using the isolated `SQLITE_URL=file:/tmp/payload-eighteen-final-20261103.db PAYLOAD_DATABASE=sqlite`. Four new cases cover inherited fallback, the ecommerce transaction, and persisted task/workflow stacks; the six prior selected regressions still pass. The name filter excludes 508 unrelated cases and is not a full integration run.
- `pnpm exec tsc -b packages/payload packages/plugin-ecommerce packages/plugin-mcp --pretty false`: passed, including referenced projects.
- `pnpm lint --quiet`, `pnpm format:check`, and the 24 CI helper tests: passed.

Full required CI must pass on the final PR revision before merge. No upstream issue is closed by this fork.

## Fourth batch: six additional open issues

These official reports were checked open on 2026-11-03 and reproduced on the preceding PR #1 head, `e86e77e37f795dfc1e47f64509199001617a7d37`. The branch still contains fork main at `dec32f05dcd892b71359909388c78d747eeea03c`. Auth-localization report #18081 was examined but excluded because this source already threads the localized request into authentication strategies.

| Official issue                                               | Result                                                                                                                                                                                                   | Regression evidence                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18072](https://github.com/payloadcms/payload/issues/18072) | The me endpoint reads draft from its own URL parameter, independently of depth.                                                                                                                          | Actual endpoint with an operation boundary stub: draft=true, explicit query override, numeric depth, and depth=true must not activate drafts.                                                                                                                                                                     |
| [#18656](https://github.com/payloadcms/payload/issues/18656) | PostgreSQL connect and initialization waiters reject with the same Error and original cause. The initialization promise is observed even without transactions, including after destroy/reinitialization. | Actual adapter factory, connect and destroy with a rejecting pg driver stub; waiting callers and event-loop turns without initialization consumers. No unhandled rejection after the fix. No live PostgreSQL server is claimed.                                                                                   |
| [#19204](https://github.com/payloadcms/payload/issues/19204) | Migration records deny create/read/update/delete with access enforcement; trusted migration calls retain explicit overrideAccess.                                                                        | Sanitized collection permissions and actual SQLite Local API 403s for all four operations, access results, and trusted create/read/update/delete controls.                                                                                                                                                        |
| [#18339](https://github.com/payloadcms/payload/issues/18339) | Variant stock/price validation runs before initiating payment instead of sitting inside the product-only branch.                                                                                         | Actual endpoint rejects low stock, missing price, missing variant and custom-policy failures without calling the provider; valid product/variant controls. SQLite cart with insufficient variant stock receives 400 and the offline adapter is not called.                                                        |
| [#19020](https://github.com/payloadcms/payload/issues/19020) | Duplicate variant validation compares latest draft options and excludes the current variant even if the join returns it.                                                                                 | Draft/published visibility boundary tests; SQLite sequence publishes A, changes its options as a draft, creates and publishes B with the freed combination, and rejects a combination still occupied by A's draft.                                                                                                |
| [#18258](https://github.com/payloadcms/payload/issues/18258) | MongoDB ordinary/polymorphic joins retain every sort key, fallback sort and projected merge-sort field. Join query types and strict input schema accept sort arrays.                                     | Actual MongoDB pipeline builder with filter/model boundaries stubbed; lookup sorting, merge sorting, projections, fallback and API schema. Integration queries check sorting before pagination; the polymorphic query is limited to MongoDB/Atlas because SQL explicitly does not support polymorphic multi-sort. |

The initial focused baseline had **20 failures and 4 passing controls across six unit files**. All 24 focused cases pass after the fixes. The migration access, duplicate-draft and payment-stock integration cases also fail against the previous implementation (including payment incorrectly returning 200). The existing ten-item join cap (#18498) and untranslated ecommerce validation messages (#19021) are separate unresolved issues and are not counted as fixes in this batch.

Final local validation:

- Broader unit command: `pnpm exec vitest run --project unit packages/payload packages/plugin-cloud-storage packages/drizzle packages/graphql packages/plugin-ecommerce packages/plugin-mcp packages/db-postgres packages/db-mongodb packages/storage-s3 packages/storage-gcs packages/storage-azure packages/storage-r2 packages/storage-vercel-blob`: **2,038 passed, 2 pre-existing skips, 204 files**.
- Selected SQLite integration: **15 passed across 10 files**, using `SQLITE_URL=file:/tmp/payload-24-final-int.db PAYLOAD_DATABASE=sqlite`. This includes the ten prior selected regressions, the three new SQLite reproductions, trusted migration execution/idempotency, and ordinary multi-key join pagination. The name filter excludes 508 unrelated cases; the one MongoDB-only polymorphic sort case is also skipped on SQLite (509 skips total).
- A local MongoDB integration attempt stopped before running tests because the configured MongoDB service was unreachable. The MongoDB/Atlas polymorphic integration test is committed for remote execution. SQL explicitly rejects polymorphic multi-sort, so this test is limited to those MongoDB adapters.
- `pnpm exec tsc -b packages/db-postgres packages/db-mongodb packages/plugin-ecommerce packages/plugin-mcp --pretty false`: passed, including referenced projects.
- `pnpm lint --quiet`, repository formatting and the 24 CI helper tests are checked before publication.

Live MongoDB and PostgreSQL outcomes must be established by remote CI; pipeline generation and a fake failing driver are not equivalent to live database integration. The full required CI must pass on the final revision before merge. No upstream issue is closed by this fork.

## PostgreSQL single-connection pool regression (#18406)

The dedicated `test/locked-documents-pool/int.spec.ts` suite uses the shared Payload integration fixture and a real `postgresAdapter` configured with `pool.max: 1` and a 2-second connection-acquisition timeout. It is selected only for `PAYLOAD_DATABASE=postgres`.

Five cases cover:

- A negative control: a raw lock read without req times out while the sole connection is held by a transaction, then rolls back cleanly. This proves the harness exercises the original second-connection failure mode.
- Three concurrent lock-checked document updates complete and persist their values.
- Three concurrent lock-checked document deletions complete and remove their records.
- Active foreign locks still reject single-document updates/deletes with 423; bulk deletion removes only unlocked documents.
- File rename completes inside its transaction, persists the new filename and preserves the stored bytes.

Successful cases also assert that no transaction sessions or pool waiters remain, the single connection is idle, and `SELECT 1` still succeeds. All operations are awaited, the negative-control transaction is rolled back in finally, and test file/pool resources are cleaned up.

The normal required integration matrix discovers this suite automatically. `.github/workflows/postgres-lock-pool.yml` additionally runs these five cases as a focused PR check with a PostgreSQL 18 service, avoiding a wait for the full integration shard. That focused check does not replace the required full PR gate.

Local PostgreSQL execution stopped before running tests because localhost:5433 was unreachable. SQLite discovery finds all five cases and correctly skips them; this is not a PostgreSQL pass. Fixture types were generated successfully. The test TypeScript project reports existing cross-adapter/workspace errors, with no diagnostics in the new fixture files after correction. Formatting, workflow YAML and all 24 CI helper checks pass. The real PostgreSQL result is reported by GitHub Actions on the new PR revision.

## Remaining mission

The requested resolution of every open issue is unfinished. Continue from the 530 unassessed snapshot entries: establish v4 applicability, inspect related fixes/PRs, reproduce the problem, add a meaningful regression test, then implement and validate. Feature requests and reports requiring a design decision or missing reproduction need separate treatment.

High-impact candidates for subsequent investigation include scheduled-publish document access (#19192), bulk-operation base filters (#19189), and tenant isolation during bulk deletes (#16325). These are priorities to investigate, not claims of confirmed vulnerabilities on this branch.

## Fifth batch: six additional open issues

All six reports were checked open on the official repository on 2026-11-03 and reproduced against this v4 branch. The prior 24 fixes and fork main are preserved.

| Official issue                                               | Result                                                                                                                              | Regression evidence                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#18584](https://github.com/payloadcms/payload/issues/18584) | Reject duplicate global slugs and collection/global slug collisions before database initialization, including internal collections. | Actual config sanitization; duplicate globals, user/internal collection collisions, and equal-label/distinct-slug controls.                                                                                                            |
| [#19184](https://github.com/payloadcms/payload/issues/19184) | Prefix MongoDB draft default sorts with version paths and map document IDs to parent IDs; preserve explicitly supplied sorts.       | Actual draft query builder through the paginate boundary, scalar/multiple/missing defaults and explicit-sort control. A live MongoDB draft-read case is committed for CI.                                                              |
| [#19056](https://github.com/payloadcms/payload/issues/19056) | Mark named GraphQL tabs with required subfields NonNull on create.                                                                  | Actual GraphQL input construction and coercion; direct/nested required fields, optional/hidden-only tabs, nullable updates.                                                                                                            |
| [#18325](https://github.com/payloadcms/payload/issues/18325) | Escape literal %, _ and backslashes in SQL like/not_like/contains patterns, with an explicit common escape character.               | Real SQLite queries against matching and decoy records; PostgreSQL bound SQL and polymorphic-join query construction; Local API integration for all three operators. Custom operator-handler boundary tests remain unchanged and pass. |
| [#19251](https://github.com/payloadcms/payload/issues/19251) | Resolve virtual references before populating relationship/upload values; respect denied field access.                               | Actual Local API reads at depths 0–3, uploads, hasMany, maxDepth, scalar aliases, denied aliases and explicit selection.                                                                                                               |
| [#18494](https://github.com/payloadcms/payload/issues/18494) | Skip the outer bulk-update transaction when each document must use its own transaction.                                             | Real transaction-enabled SQLite: middle hook failure preserves earlier/later successful writes and returned results; bulk delete control and empty session registry. The already-correct v4 delete implementation is unchanged.        |

The initial four-file unit baseline had **9 failures and 14 passing controls**. The integration baseline with real SQLite transactions had **5 failures and 1 passing delete control**: unpopulated relationships, denied virtual data reappearing, and earlier bulk updates being rolled back despite being returned as successes. Tests now cover the fixes plus additional controls.

Validation on this revision:

- **2,055 unit tests passed across 206 files**, with two pre-existing skips, including core, GraphQL, Drizzle, MongoDB, PostgreSQL, SQLite and the previously covered plugins/storage packages.
- **9 SQLite integration tests passed**, with one MongoDB-only draft-read case skipped. SQLite transactions are explicitly enabled for this fixture. The SQL searches use decoys so overmatching cannot pass unnoticed.
- TypeScript builds for PostgreSQL, MongoDB, SQLite and GraphQL pass; package/tool lint, repository formatting and all 24 CI helper tests pass.
- The integration test TypeScript project still includes existing cross-adapter/workspace diagnostics; no diagnostics reference the new fixture files.

A live MongoDB/Cosmos DB or PostgreSQL result is not established by these local checks. The full required Actions matrix must validate the final PR commit before merge. The new shared-fixture suite is discovered by that matrix; no required checks have been removed or relaxed. The separate PostgreSQL max=1 regression was already green on the preceding commit and runs again on the updated PR.

## Sixth batch

Six further reproduced reports are covered in [batch-6.md](batch-6.md), on top of the merged PR #1 baseline.

## Seventh batch: six more issues on PR #3

PR #3 now adds twelve scoped fixes to the thirty already merged on main. The latest six are #16367, #16368, #16502, #17929, #17938 and #18217. See [batch-7.md](batch-7.md) for implementation, reproduction evidence and validation limits. Locale-resolved traversal uses the new explicit `flattenLocales: true` option; the default continues to traverse all-locale database shapes.

## Eighth batch: six further issues on PR #3

PR #3 now adds eighteen scoped fixes to the thirty already merged on main. The latest six are #17201, #17904, #17906, #18623, #18874 and #19021. See [batch-8.md](batch-8.md) for scope, reproduction, validation and remaining runtime/browser/install checks. Header scoping is opt-in through `withPayload(nextConfig, { clientHintHeaders: '/admin/:path*' })`; omitting it preserves the existing all-route behavior.

## Ninth batch: six additional data and lifecycle regressions

PR #3 now adds twenty-four scoped fixes to the thirty already merged on main. The latest six are #16485, #17760, #17762, #18251, #18285 and #18844. See [batch-9.md](batch-9.md) for reproduction, regression coverage and validation limits. This includes both defects reported in #18251; it is counted as one issue.

## PR #3: six additional plugin reports

PR #3 now adds thirty scoped fixes to the thirty already merged on main. The latest six are #16517, #17658, #14328, #19253, #9226 and #18311. See [batch-10.md](batch-10.md) for reproduction and validation. The SEO change covers manual global fields; manual collection fields already work in this base. Internal numeric link IDs no longer abort email delivery, but mapping IDs to site URLs remains application-specific. The fork remains public.

## PR #3: six additional validation and synchronization reports

PR #3 now adds thirty-six scoped fixes to the thirty already merged on main. The latest six are #15334, #16283, #16980, #17699, #17882 and #19231. See [batch-11.md](batch-11.md) for reproduction, coverage and limits. These cover rollback order, optional timezone normalization, rejected invalid blocks/select queries, surfaced search synchronization failures and export labels. The fork remains public.

## PR #3: six additional ecommerce and schema reports

PR #3 now adds forty-two scoped fixes to the thirty already merged on main. The latest six are #14904, #16377, #16453, #16797, #18498 and #19018. See [batch-12.md](batch-12.md) for reproduction, coverage and limitations. These address invalid search configuration, explicit generated-type required overrides, customer identity, repeated payment initiation, complete variant reads and derived variant titles. The fork remains public.

## PR #3: six additional query, update and file regressions

PR #3 now adds forty-eight scoped fixes to the thirty already merged on main. The latest six are #16401, #18415, #17461, #19233, #19008 and #16754. See [batch-13.md](batch-13.md) for reproduction, coverage and limits. These cover Unicode JSON queries, isolated nested-field fallbacks, point-update projections, D1 bulk-lock parameter budgets, static cloud access with private document metadata and HEAD responses. The fork remains public.

## PR #3: six additional query, CSV, Lexical and documentation reports

PR #3 now adds fifty-four scoped fixes to the thirty already merged on main. The latest six are #16483, #17118, #17589, #16262, #19139 and #19222. See [batch-14.md](batch-14.md) for reproduction, coverage and limits. This batch includes four runtime fixes, a missing public Lexical command export and corrected cron documentation. The fork remains public.
