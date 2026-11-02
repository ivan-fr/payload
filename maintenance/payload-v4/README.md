# Payload v4 maintenance: first server regression batch

This branch fixes six reported server regressions against Payload **4.0.0-beta.6**, based on upstream commit `ec351643011603cf75dc91db5d03f80ff120f1e9`. The npm `beta` tag was checked on 2026-11-02; `latest` still points to 3.92.1. This is a beta fork, not a stable Payload 4 release.

The [inventory](issues.json) records **565 open issues**, excluding pull requests. Six have scoped fixes here; **559 remain unassessed**. The machine-readable snapshot is [issues.json](issues.json). Inventorying a report does not establish that it still reproduces on v4, and no upstream issue has been closed.

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

## Remaining mission

The requested resolution of every open issue is unfinished. Continue from the 559 unassessed inventory entries: establish v4 applicability, inspect related fixes/PRs, reproduce the problem, add a meaningful regression test, then implement and validate. Feature requests and reports requiring a design decision or missing reproduction need separate treatment.

High-impact candidates for subsequent investigation include scheduled-publish document access (#19192), bulk-operation base filters (#19189), and tenant isolation during bulk deletes (#16325). These are priorities to investigate, not claims of confirmed vulnerabilities on this branch.
