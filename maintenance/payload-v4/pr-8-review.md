# PR #8: CI and Sonar follow-up

Review of branch `fix/payload-six-issues-20261108` against fork `main`, starting at
`9e67df320ad125acb8819dce7b81ad7da7e15298`. This follow-up repairs the existing
30-report batch; it does not add six more reports or change the issue inventory.

## Findings and corrections

- PostgreSQL rejected generated polymorphic join predicates with `42P18`: the
  synthetic collection discriminator appeared as an untyped parameter in `IS NULL`.
  Cast that bound value to text, retaining parameterization and collection-specific
  access constraints. Existing SQLite and PostgreSQL join suites cover this path.
- Scheduled-publish cleanup matched only string IDs, leaving jobs whose JSON input
  held a number. Match the original ID and its string representation, retain task,
  collection and pending-state restrictions, and make an empty selection a no-op.
  The regression fixture now queues both representations for a deleted document.
- The old Stripe test double invented `cartItemsSnapshot: null` when that metadata
  key was absent. Return the actual submitted metadata, including the new digest,
  so the repeated-initiation regression exercises the current settlement flow.
- Enable transactions in the nested-docs fixture for all three SQLite ID variants,
  preserving their configured ID type. UUID/UUIDv7 must verify rollback under the
  same transaction policy as the numeric-ID fixture.
- Two join tests expected an access constraint from one collection to hide records
  from another collection granting unconditional read access. Assert that both
  collections remain visible, then separately request the nested or flattened path
  as a global user filter and retain the original collision-exclusion assertions.
- Align four autosave network assertions with the intentional `fallback-locale=false`
  URL. Preserve their exact request-count, depth and virtual-field assertions.
- Assert automatic drawer closure after partially successful bulk editing. Extend
  the component test to verify URL preservation for both partial and full success.
- When all individual bulk errors are private, display the translated generic error
  alongside the operation summary. Preserve public-message deduplication and private
  detail filtering. The browser test checks both generic feedback and no disclosure.
- Correct all four SonarCloud annotations: remove two nested SelectInput ternaries,
  split the nested SQL template construction, and extract reorder fallback-message
  selection to keep its drag handler within cognitive complexity 15.

## Validation

- Complete unit project: **4,712 passed, 4 skipped**, 529 passing files.
- Targeted browser component contracts: **11 passed** across SelectInput, keyboard
  selection/focus, reorder rollback, bulk-form errors, and full/partial list refresh.
- SQLite join/hierarchy/access and scheduled cleanup suites: **123 passed, 8 skipped**.
- Existing numeric-ID scheduled cleanup tests in `test/versions/int.spec.ts`:
  **2 passed**, with 151 unrelated tests filtered out.
- Final repeated-initiation, nested rollback and scheduled-cleanup fixtures:
  **9 passed on each of SQLite numeric IDs, UUID and UUIDv7 (27 passed)**.
- PostgreSQL parser check using temporary PGlite: reproduced `42P18` with the old
  untyped predicate, then executed the actual compiled corrected discriminator
  constraints and verified denied/allowed branches. **1 passed**. This supplements
  the CI PostgreSQL suites; it is not a live PostgreSQL service test.
- Package TypeScript checks for `payload`, `ui`, `drizzle`, and `plugin-ecommerce`:
  passed. Targeted Oxlint: no errors; existing warnings remain. Formatting and
  whitespace checks passed.
- Official local SonarJS rules for cognitive complexity, nested conditionals and
  nested template literals pass on the affected helpers/components. The earlier
  cloud gate passed with four annotations; the next cloud analysis must verify
  their removal on the follow-up commit.

Full-Admin browser checks (Next.js dev server, Chromium 153):

- Private delete-hook failure: **1 passed**, including visible generic feedback and
  an assertion that the private hook message is absent.
- Autosave depth and virtual-field scenarios: **4 passed**, including exact request
  counts and post-save values.
- Partial bulk-edit drawer closure: **1 passed**, preserving the locked document
  and confirming persisted edits on the remaining rows after list refresh.

## Accessibility and verification boundaries

The feedback change affects WCAG 2.2 **3.3.1 A** (errors described in text) and
**4.1.3 AA** (status feedback). It reuses the existing Sonner notification semantics;
private details remain excluded. SelectInput refactoring is behavior-preserving;
the existing keyboard/focus regression exercises **2.1.1 A**, **2.4.3 A**, and
**4.1.2 A** in Chromium 153. No styles or semantic roles change in this follow-up.

Local full-Admin checks use temporary default avatars and system font fallbacks,
serve Monaco assets from the installed package to avoid unavailable external assets,
and use the installed Chromium executable. Those settings and generated
types/configuration are restored before publication. They
are not CI exclusions or production changes. No contrast, screen-reader speech,
assistive-technology, or whole-product conformance claim is made.

Early local attempts were blocked by external assets; an interrupted dev-server
run also left its disposable SQLite file unusable. Final database checks use fresh
temporary files. These setup failures are not counted as product regressions.
Complete CI, including PostgreSQL/MongoDB variants and both framework E2E matrices,
remains necessary on the published revision.

## Follow-up after the complete CI run

The full run on `b86dea3` completed with 313 successful checks, including the entire
browser matrix and SonarCloud (zero new/accepted issues and zero security hotspots).
Three integration jobs remained red, plus their aggregate required-check result:

- CosmosDB and Firestore compatibility profiles explicitly disable transactions.
  The nested-docs test incorrectly required rollback from those profiles. It now
  probes transaction support, closes the probe transaction immediately, and still
  requires the descendant error to propagate on every adapter. Transactional
  adapters retain parent-title, timestamp and child-breadcrumb rollback assertions.
  Nontransactional adapters must expose the earlier parent write while leaving the
  rejected descendant unchanged; no test is skipped for these profiles.
- The custom-schema PostgreSQL job executed the documentation's default table
  names without schema qualification. The regression now qualifies both current
  and version relationship tables using the configured schema, escaping identifier
  quotes, and the documentation explains the `search_path` requirement.

Validation for this follow-up:

- SQLite, transactions enabled: **5 passed** across the nested-docs and migration /
  upload fixtures.
- SQLite, transactions disabled in a temporary fixture configuration: **3 passed**,
  exercising the same no-op transaction contract used by the compatibility profiles.
  The fixture configuration was restored before publication.
- PostgreSQL custom-schema fixture through the normal `pg` client and a temporary
  PGlite socket server: **2 passed**, including both migration directions and full /
  byte-range upload responses. This uses a PostgreSQL engine, not a native server.
- Targeted formatting, Oxlint and whitespace checks passed; existing cleanup-style
  warnings in the upload fixture remain.

Native MongoDB could not start in the local runtime (`open: Operation not permitted`),
so provider-profile confirmation remains a fresh-CI check. The complete CI matrix
and production behavior are unchanged by this follow-up; only tests and migration
documentation change.
