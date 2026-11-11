# PR 9 CI review — 2026-11-10

Reviewed head `276f4df471a11339043b3595f123dcb1ba5415a3` against fork `main`.

## Findings and corrections

- Hierarchy previews with `locale: 'all'` fetched the ordinary parent document, losing a draft-only parent's move and translated paths. Forward `draft` to this ancestor query and use the same draft/published cache suffix when recording computed descendants. The existing hierarchy regression fails before the fix and passes afterward; the complete hierarchy suite also passes.
- Restoring a snapshot with no hasMany relationship left the newer relationship in MongoDB because undefined update values are ignored. Emit an explicit empty array for absent, writable hasMany relationship/upload fields during restore. Denied fields retain their current value; ordinary updates retain their existing fallback behavior. Two new unit cases cover relationship/upload restore and access controls. The existing batch 35 integration assertion is retained.
- The batch 34 low-level version fixture supplied a scalar `_status` despite localized statuses. Supply the actual storage shape (`en`/`fr`) so Mongoose can validate the version before testing timestamp ordering. All latest-version assertions remain.
- The batch 36 rollback test assumed every adapter supports transactions. Probe the adapter's transaction API and assert rollback when supported, or the persisted nested write when disabled (Cosmos DB/Firestore compatibility settings). Every adapter still executes the test; no timeout, retry, workflow or existing assertion for transactional adapters is weakened.
- SonarCloud passed its gate but annotated three redundant optional types: two JSON-schema declarations and the Stripe amount callback. Apply `NonNullable` to the indexed optional types while keeping the public properties optional.

## Validation after correction

- Full unit project: **4,777 passed, 4 skipped**, 542 passing files and one skipped file.
- PostgreSQL adapter via PGlite/custom schema: **59 passed**, covering all 36 hierarchy tests and batches 34–37 (23 cases). The final capability-aware batch 36 test was also rerun: four passed.
- Numeric SQLite: all batches 34–37, **23 passed**. Together these are 82 integration executions, plus the four-case final PostgreSQL rerun.
- Core and ecommerce declaration builds; changed-file lint, formatting and whitespace checks pass. The type-aware local SonarJS optional-type rule reports no issue on the three corrected declarations; pre-existing declarations elsewhere are outside this patch. Targeted ecommerce lint retains an existing unused-variable warning. A further 76 focused Stripe/JSON-schema unit cases pass after the optional-type cleanup.
- SonarCloud's original-head gate passed with three warnings; the corrected head still needs a fresh hosted analysis. Its annotations, rather than an assumed clean gate, drove the three type fixes.

GitHub's original-head lint, build, unit/type/type-generation jobs, template builds, visual-regression job and PostgreSQL lock-pool regression passed. The broader integration matrix exposed the findings above; E2E and remaining jobs were still running during review. Do not interpret the original-head successes as validation of a later commit.

PGlite is not a native PostgreSQL server. A local MongoDB 7 binary could not start in this environment (`open: Operation not permitted`); MongoDB integration confirmation is delegated to the unchanged hosted matrix. Native MongoDB/compatibility-service execution and the corrected head's hosted CI remain pending. No new official issue is counted by these review fixes.
