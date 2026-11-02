# Required Payload 4 CI on this fork

Every pull request targeting `main` runs the public Payload 4 CI, even for documentation-only changes. Pushes to `main`, manual dispatch and merge queues also run the workflow. It uses read-only contents permission by default, the pinned Node/pnpm versions in `.tool-versions`, and frozen dependency installs.

The required check is **`Payload 4 required tests`**. Configure branch protection on `main` to require this GitHub Actions check, require an up-to-date PR, and apply the rule to administrators. Direct pushes, force pushes and branch deletion must not bypass this rule. Approval count is zero so a sole repository owner can merge their own PR after CI passes.

The final check runs with `always()` and rejects any failed, cancelled, skipped, missing or invalid required-job result. All Next.js and TanStack E2E jobs are blocking. It also requires the build-approval check that the upstream aggregate omitted. No test suite is skipped because a Next.js canary publish is incomplete; an unavailable dependency causes a failed run.

## Coverage

- Full package build, formatting, TypeScript/JavaScript lint and CSS lint.
- All ordinary unit tests and React Server Component tests, browser component tests and type tests.
- Type generation and GraphQL schema generation.
- Full integration suite across the upstream 14 database configurations, with three shards each (42 jobs). Databases, storage and Redis are started using the repository's Docker services; compatibility adapters use the upstream harness.
- Production browser suites on Next.js and TanStack, plus the additional run without Next.js cache components. Missing E2E directories are discovered automatically. Existing custom-config variants remain included. The current matrix has 251 jobs, below GitHub's 256-job matrix limit; configured suite sharding is capped at two to leave room for discovered suites.
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

Manual runs default to `mode: targeted`; `suites` is a JSON array of failed Next.js suite names. All shards of those suites run, with a fresh build and E2E preparation, while unrelated test jobs are omitted. The default selection records the 12 failed suites from PR #2 run 41455083629. Select `mode: full` to run the merge validation manually. PR, push-to-main and merge-group events always use full coverage.

Targeted runs report **`Payload 4 targeted tests`**, never the required `Payload 4 required tests` context (even as a skipped check). They cannot satisfy branch protection or reuse another commit's green results. A retry via GitHub's **Re-run failed jobs** is appropriate for the same code revision; it does not load newly pushed fixes. A corrective commit may intentionally use `[skip ci]` during diagnosis to avoid starting the complete PR matrix, but merge stays blocked until the new revision passes a full run.

Before this workflow is installed on the default branch, GitHub does not expose its manual dispatch button. Pushes to the dedicated `ci/targeted-pr2` diagnostic branch run the same targeted selection. A normal PR event always retains full coverage, even if its source branch has that name.

## PR #2 corrective validation

The corrective revision updates stale E2E helper imports and dialog/tab selectors, the e-commerce fixture's source exports, explicit localized-slug regeneration, native Lexical file-drop acceptance, group leaf-column fixtures, lazy-field scrolling, Monaco popup geometry, and production fixture routing flags. Direct API-key requests disable development auto-login so they test the supplied key. No test is disabled by these corrections.

Local evidence: 20 CI helper tests pass, actionlint passes, and Playwright discovers 71 tests in the 12 selected files. A local UI server could not start in this executor (`listen EPERM`); rendered behavior must be validated by the targeted GitHub run. For the Lexical change, WCAG 2.2 A/AA criteria 2.1.1 and 2.5.7 (existing keyboard/non-drag upload alternatives), 2.4.3 (drawer focus), and 4.1.2 (drawer semantics) were considered. Only the native file-drag acceptance handler changes; browser and assistive-technology verification of those outcomes is pending. No accessibility conformance claim is made.
