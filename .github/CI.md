# Required Payload 4 CI on this fork

Every pull request targeting `main` runs the public Payload 4 CI, even for documentation-only changes. Pushes to `main`, manual dispatch and merge queues also run the workflow. It uses read-only contents permission by default, the pinned Node/pnpm versions in `.tool-versions`, and frozen dependency installs.

The required check is **`Payload 4 required tests`**. Configure branch protection on `main` to require this GitHub Actions check, require an up-to-date PR, and apply the rule to administrators. Direct pushes, force pushes and branch deletion must not bypass this rule. Approval count is zero so a sole repository owner can merge their own PR after CI passes.

The final check runs with `always()` and rejects any failed, cancelled, skipped, missing or invalid required-job result. All Next.js and TanStack E2E jobs are blocking. It also requires the build-approval check that the upstream aggregate omitted. No test suite is skipped because a Next.js canary publish is incomplete; an unavailable dependency causes a failed run.

## Coverage

- Full package build, formatting, TypeScript/JavaScript lint and CSS lint.
- All ordinary unit tests and React Server Component tests, browser component tests and type tests.
- Type generation and GraphQL schema generation.
- Full integration suite across the upstream 14 database configurations, with three shards each (42 jobs). Databases, storage and Redis are started using the repository's Docker services; compatibility adapters use the upstream harness.
- Production browser suites on Next.js and TanStack, plus the additional run without Next.js cache components. Missing E2E directories are discovered automatically. Existing custom-config variants remain included. The `base-path` and `trailing-slash` suites exercise Next.js configuration and run on Next only; the TanStack fixture does not configure those Next.js options. The current matrix has 249 jobs, below GitHub's 256-job matrix limit; configured suite sharding is capped at two to leave room for discovered suites.
- Dedicated accessibility and visual regression jobs on every PR. Visual tests retain the pinned Playwright Docker image and committed baselines.
- The upstream template build, integration and browser test matrix, including the template dependency-build approval check.

Integration and E2E parallelism are capped at four and eight jobs respectively. This is a large workflow: runs can take hours depending on the account's hosted-runner limits. No paid runner type or deployment is configured.

## Explicit limits

The private Figma Content API job remains upstream-only: its private container image and AWS role are not available to this fork. LLM evaluation projects require provider credentials and are not included in the ordinary public CI. Interactive screen-reader audits, benchmarks, and a Cloudflare D1 integration harness are not added by this configuration. These are not reported as successful tests. This CI is the complete public automated suite configured here, not a claim to exercise every optional service or manual test in Payload.

The fork does not publish npm canaries or run the upstream bundle-commenting job. Existing release workflows and secrets are not modified by this change.

## Maintenance

Run `node --test .github/scripts/ci/*.test.mjs` to check the gate and suite discovery. Run `actionlint .github/workflows/main.yml` to validate workflow syntax. Inspect `node .github/workflows/int.config.ts` and `node .github/workflows/e2e.config.ts` for generated matrices. If more suites push the E2E matrix above 256 jobs, split it by framework rather than excluding tests.

GitHub repository settings, rather than a YAML file alone, enforce the required check. A missing check must leave the PR blocked. A green local test run does not satisfy GitHub's required check; the workflow must complete successfully on the current PR commit.

## Targeted diagnosis after a failure

Manual runs default to `mode: targeted`; `suites` is a JSON array of failed Next.js suite names or `{ "suite": "v4", "framework": "tanstack-start" }` objects to select another framework. All shards of those suites run, with a fresh build and E2E preparation, while unrelated test jobs are omitted. The default selection contains only the conditional-provider multi-tenant suite on TanStack, the remaining failure from full run 41599240289. Select `mode: full` to run the merge validation manually. PR, push-to-main and merge-group events always use full coverage.

Targeted runs report **`Payload 4 targeted tests`**, never the required `Payload 4 required tests` context (even as a skipped check). They cannot satisfy branch protection or reuse another commit's green results. A retry via GitHub's **Re-run failed jobs** is appropriate for the same code revision; it does not load newly pushed fixes. A corrective commit may intentionally use `[skip ci]` during diagnosis to avoid starting the complete PR matrix, but merge stays blocked until the new revision passes a full run.

Before this workflow is installed on the default branch, GitHub does not expose its manual dispatch button. Pushes to the dedicated `ci/targeted-pr2` diagnostic branch run the same targeted selection. A normal PR event always retains full coverage, even if its source branch has that name.

## PR #2 corrective validation

The corrective revision updates stale E2E helper imports and dialog/tab selectors, the e-commerce fixture's source exports, explicit localized-slug regeneration, native Lexical file-drop acceptance, group leaf-column fixtures, lazy-field scrolling, Monaco popup geometry, and production fixture routing flags. Direct API-key requests disable development auto-login so they test the supplied key. No test is disabled by these corrections.

Local evidence: 20 CI helper tests pass, actionlint passes, and Playwright discovers 71 tests in the 12 selected files. A local UI server could not start in this executor (`listen EPERM`); rendered behavior must be validated by the targeted GitHub run. For the Lexical change, WCAG 2.2 A/AA criteria 2.1.1 and 2.5.7 (existing keyboard/non-drag upload alternatives), 2.4.3 (drawer focus), and 4.1.2 (drawer semantics) were considered. Only the native file-drag acceptance handler changes; browser and assistive-technology verification of those outcomes is pending. No accessibility conformance claim is made.

## Five-suite follow-up

After seven of the twelve E2E suites passed, diagnosis is narrowed to `auth-api-key`, `authorship`, `base-path`, `lexical__collections__LexicalSlugFieldNameCollision`, and `trailing-slash`. The seven successful suites are not repeated by this diagnostic run.

- The API-key fixture explicitly permits admin reads and API-key users to read only themselves. A REST regeneration regression verifies the new key, revokes the old key, and rejects cross-user and anonymous reads. The core default access policy is unchanged. All 12 API-key integration tests pass locally on SQLite.
- Authorship fixture SDK requests authenticate with the seeded user's JWT; secondary browser pages use the current initialization helper.
- The base-path fixture resets/seeds through its actual prefixed endpoint before opening the browser.
- The trailing-slash config uses the current config/seed/suite wrapper, explicitly logs in for authenticated cases, and avoids double slashes in URLs.
- Lexical assertions target the current upload action container and one visible dialog, preserving the one-dialog regression.

Validation: actionlint and 20 CI helper tests pass; Playwright discovers 27 tests in the five selected files. Remote E2E results are pending.

## Last-suite follow-up

Run 41479599196 passed `auth-api-key`, `authorship`, `base-path`, and the Lexical collision suite. Only `trailing-slash` failed: its initial reset returned HTTP 500 before Playwright started because the trusted seed used Local API creates without `overrideAccess: true`. Both seed writes now explicitly bypass access control for test initialization, consistent with other fixtures. Production access rules are unchanged.

A shared-fixture integration regression reproduced the exact Forbidden error before the change and passed afterward on SQLite. It verifies that the login user and sample post exist without any signed-in request and restores the fixture's routing environment afterward. The diagnostic matrix now contains only `trailing-slash` (six E2E tests); the eleven successful suites are not repeated.

## Full validation follow-up (run 41580885019)

The full run passed build, lint, unit/component tests, types, type/schema generation, templates, integration, accessibility and visual jobs. Four E2E jobs failed (plus the required aggregate):

- Conditional-provider multi-tenant on Next: the folder title matched both a column button and a selected chip. Assertions now identify the exact folder button and retain the checks excluding other tenants.
- `v4` on TanStack: the bundled module resolved the source image relative to `dist/`. It now uses the existing `getTestSuiteDir` helper for the suite directory, including its import map and generated types paths.
- `base-path` and `trailing-slash` on TanStack: discovery incorrectly duplicated Next-config-only suites onto TanStack, whose fixture does not configure either option. Both suites remain mandatory on Next; every shared suite remains mandatory on both frameworks. A coverage regression checks this distinction and ensures no optional jobs are introduced.

Diagnosis selects only the two applicable failed suite/framework pairs. The corrected PR revision still requires a fresh full validation before merge; neither the old successful jobs nor the diagnostic gate satisfies that requirement.

Targeted run 41596871640 passed the conditional-provider multi-tenant suite. The v4 source asset fix succeeded, exposing an initialization mismatch: the fixture uses `prefillOnly: true`, so its browser must wait for the login page before explicitly logging in. Its initialization now sets `noAutoLogin: true`, and cleanup closes the context even if page initialization fails. Diagnosis is narrowed to v4 on TanStack only.

## Multi-tenant dialog follow-up (run 41599240289)

All required job families passed except conditional-provider multi-tenant on TanStack. The Lexical BlocksFeature test raced the automatic tenant dialog: its early visibility check was false, then the dialog opened before the sidebar close click. The helper now resolves whether a global tenant is selected first, waits for the automatic dialog when none is selected, and closes the sidebar after confirming or cancelling the dialog. Explicit assignment with an existing selected tenant still closes the sidebar before using the document menu. No forced clicks or increased timeouts are used.

The hierarchy move test also closes the sidebar after selecting its tenant, before interacting with the table, to prevent the sidebar from covering the folder link (the flaky case in the same run). All tenant isolation assertions remain in place. The targeted selection is narrowed to this failed suite on TanStack.
