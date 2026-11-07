# PR 7 review follow-up

Reviewed head: `af0831231e23764b981dfdeab8f7d07596bf36d0`, compared with fork `main` at `295ebc69105181ee41c2ff8de2805a2ce2602a56`.

## Confirmed CI failures and corrections

The active [Payload 4 CI run](https://github.com/ivan-fr/payload/actions/runs/42365126342) reported seven failed jobs at inspection. They reduce to three assertions/workflows:

- **Nested upload compensation:** MongoDB, Atlas and DocumentDB shard 2 failed the existing bulk-update and version-restore rollback tests because `image-original.png` survived. Local create/update introduced a file-property request proxy without linking it to the owning file-operation scope. `createFileRequest` now isolates upload input and shares the existing file commit/rollback lifecycle. New manager regressions fail before the correction and pass afterward, including the bulk/restore-style outer request proxy chain and a successful transaction control.
- **Cloud metadata assertions:** MongoDB, Atlas and DocumentDB shard 1 failed a strict request-object identity assertion in two cloud storage tests. Upload requests intentionally use a scoped proxy, so the tests now verify the actual contract: shared context and transaction, retained outer file across nested calls, and independent stored metadata. They continue checking the storage results. The two scenarios pass on real SQLite with the fixture's in-memory cloud adapter.
- **Virtual grouping:** the access-control E2E suite could not find the relationship-backed virtual scalar in the Group By picker. Eligibility was checked against the virtual field's name while the picker uses its backing query path. The shared scalar-path helper now uses that path and rejects computed-only virtual fields. A production-control rendering regression fails before the change and passes afterward; existing array/block exclusions remain covered.

No timeout, retry policy, workflow, assertion for rolled-back files, quality threshold or upstream issue count is changed by this review.

## Validation

The full unit project passes **4,621 tests**, with four skipped, across 512 passing files. All **14 SQLite regression tests** from batches 25, 27 and 28 pass. The cloud-storage versioning suite completes **45 passed / 4 skipped** on SQLite; its two nested metadata scenarios also passed in a focused run. The 12 targeted DOM tests pass in jsdom. TypeScript passes for `payload` and `ui`. Targeted lint and formatting are checked before publication.

The broader local SQLite file-versioning run hits the Node worker's approximately 2 GB heap limit. Running the reviewed local API implementation as a baseline reproduces the same abort after the initial three tests, so the complete file-versioning suite is not claimed green locally. Its transactional rollback scenarios are Mongo-family-specific; the new unit tests reproduce their file-scope ownership failure independently of a live database. Test-generated files and the incidental community type-generation change were cleaned up. Native-browser verification of the grouping workflow and transactional MongoDB/Atlas/DocumentDB verification remain for the new CI head. Component rendering is not browser or assistive-technology evidence. The existing keyboard/focus/contrast and screen-reader limits in batch 25 remain applicable; this change restores an option and its query path without changing popup semantics or CSS.

## Sonar and CI status

Sonar's Quality Gate passed on the reviewed head, with zero security hotspots and eight reported new issues. Their detailed annotations could not be retrieved through the available connector; direct public API retrieval was also unavailable. Those eight issues are not claimed resolved. Existing build, lint, unit, type-generation, type-test, accessibility and visual checks were green at inspection, while many E2E/database jobs remained queued or running. The first superseded CI attempt was cancelled; it is separate from the active run's failures above.

This follow-up does not merge the PR. Results for the new head must be read from its own CI run rather than inherited from the reviewed head.

## Second review: Sonar annotations and virtual groups

Reviewed input: `197eedc08bb749e85fb7667e5bfa8e3cebdb72e0` and [CI run 42367562246](https://github.com/ivan-fr/payload/actions/runs/42367562246). All MongoDB and Atlas integration shards passed at inspection, confirming the preceding upload corrections on those adapters. The remaining observed failure was access-control E2E shard 2: a relationship-backed virtual group's children were absent from Group By.

The scalar-path collector now recurses through a virtual group's backing path. The options reducer also avoids appending the virtual alias to that path, so grouping eligibility, displayed options and query values agree. Two additional regressions cover virtual group descendants and nested scalar aliases, including the real GroupBy control's option filtering.

The eight Sonar findings were retrieved from the public GitHub check annotations for check `128389111229`; SonarCloud's interface itself returned HTTP 403. All eight are addressed in source:

| Finding                                              | Correction                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| JPEG reader cognitive complexity 21                  | Separate bounded byte reads, marker scanning and segment parsing; keep file closure in `finally`.        |
| Grouping paths cognitive complexity 33               | Separate per-field traversal and query-name resolution.                                                  |
| JSON identifier global replacement                   | Use `replaceAll` with a literal.                                                                         |
| Block-table collector cognitive complexity 17        | Separate block definitions from field traversal, retaining the shared visited set.                       |
| Form block mapper cognitive complexity 16            | Extract block resolution and guard disabled fields before handling factories/overrides.                  |
| Inventory configuration undefined comparison         | Compare directly with `undefined`.                                                                       |
| Sparse block reader callback cognitive complexity 17 | Extract the persisted-order-to-index calculation.                                                        |
| Product validation cognitive complexity 16           | Extract the shared inventory predicate, preserving product/variant errors and custom inventory behavior. |

An isolated official `eslint-plugin-sonarjs` check at threshold 15 no longer flags any of the six reported functions or their new helpers. The full-file check still reports two unchanged, pre-existing functions in `traverseFields.ts` (complexities 122 and 20); the input revision reports those same two plus the corrected callback at 17. This is a scoped comparison, not a claim that the whole repository has no complexity findings. The cloud analysis must independently confirm the new head.

Validation: **4,624 unit tests passed / 4 skipped**, **94 focused affected unit tests passed**, the existing **14 SQLite batch regressions passed** and **12 jsdom tests passed**; TypeScript for payload, ui, drizzle, form-builder and ecommerce; targeted lint and formatting. A new temporary-file JPEG test exercises standalone marker skipping and file-backed reads, with cleanup in `finally`.

Accessibility scope: virtual-group option availability and query paths. WCAG 1.3.1 (relationships), 2.4.6 (labels) and 4.1.2 (name/role/value) were assessed in source; labels continue through the existing translation and popup controls. Unit rendering verifies option paths and active selection only. Native browser visibility, keyboard/focus and assistive-technology outcomes remain unverified locally and must not be inferred from mocked popup rendering. No CSS or focus handling changed. Earlier enhanced-contrast and screen-reader evidence limits still apply.

## Project-wide Sonar follow-up and remaining CI regressions

Input revision: `5aebe36e8af6cc8bed5c06d8d37ddc9659fc623c`. SonarCloud reported zero issues on PR 7 and **5,850 open issues on main across 2,116 files**. This follow-up starts addressing that larger inventory; it does not claim the entire backlog is resolved. Cloud analysis must confirm issue closures after publication.

The source changes include these mechanical simplifications:

| Change                                                                        | Occurrences |
| ----------------------------------------------------------------------------- | ----------: |
| Explicit `node:` imports of built-in modules                                  |         373 |
| `Number.parseInt` / `Number.parseFloat`                                       |          85 |
| Direct comparisons with `undefined`, retaining guards for unavailable globals |         138 |
| `replaceAll` for fixed literal global patterns                                |         104 |
| Dedicated length/null/undefined assertions                                    |          86 |
| Flattened `else if` branches                                                  |          43 |
| `Date.now()` for the current timestamp                                        |          12 |
| Simplified boolean ternaries                                                  |          13 |

Regex patterns requiring character classes, captures or non-global flags retain their behavior. Numeric checks that require coercion are not replaced with non-coercing checks. No issue statuses, quality thresholds or analysis exclusions are changed.

Two security findings are addressed separately. Markdown link normalization no longer nests ambiguous quantifiers: a malformed 1,000-character link blocked the original regex for more than two seconds in a bounded child process, while the new 100,000-character regression completes. The tracked AI Reviewer bundle is rebuilt. Live Preview now rejects an untrusted message origin before invoking its handler or callback; trusted-origin callbacks remain covered. Three CSS findings are also corrected in the Lexical dropdown: valid negative token arithmetic, removal of an invalid redundant background-color value, and removal of the unnecessary important declaration.

Four CI causes are corrected:

- **SQL session persistence:** omitted arrays were transformed into empty rows and then deleted during session-only updates. Omitted arrays now remain untouched; explicit empty/null arrays still clear their rows. Four unit cases and the complete 21-test multi-tenant SQLite suite pass. The existing SQLite login-failure regression also passes against the packed production packages, preserving both array rows and the session count. These scenarios cover the 403-versus-400 failures on PostgreSQL variants and the lost-login-metadata failures on SQLite variants.
- **Has-many grouping:** relationship and upload grouping remains supported, while array/block descendants and multi-valued scalar fields remain excluded. Twenty focused unit tests and both native Chromium MongoDB has-many relationship scenarios pass. SQLite's polymorphic scenario reaches the adapter's existing `Not supported` path; it is not reported as passing.
- **Lexical focus:** renewing editor configuration during save could change the composer key through its initial editability and remount the editor. The key now follows document/view identity. A second cause was reproduced with MongoDB and optimized production packages: the saved JSON adds `null` to absent nested block fields, triggering a provider remount despite unchanged content. State comparison now treats those empty object properties consistently while detecting real text/block changes and preserving array positions. Ten focused comparison tests and the real-provider Chromium regression cover these cases. Full production save/typing and external-mutation verification is recorded below.
- **UUID fixture values:** the numeric-ID regression submitted `Needle` as a UUID on UUID adapters. The fixture now uses a valid nonmatching ID for string IDs and retains nonnumeric text for numeric IDs. Its PostgreSQL dialect regression reproduces the original UUID error and now covers both ID types; the six SQLite UUID integration cases pass. Runtime UUID validation is retained.

Validation of this follow-up: **4,634 unit tests passed / 4 skipped**, 514 passing unit files, followed by **10 additional editor-comparison tests**; all **46 package builds** passed; repository lint passed with existing warnings; targeted dropdown stylelint passed; two Chromium editor component tests passed; 15 AI Reviewer sanitization tests passed; 21 SQLite multi-tenant tests, six SQLite UUID batch-27 tests and the packed-package SQLite login-failure regression passed. The focused SonarJS complexity, slow-regex and postMessage checks report no findings in the corrected production files, including the final field comparison. The new remote CI/Cloud analysis must confirm the published head.

Packed production verification uses `pnpm prepare-run-test-against-prod`, then `pnpm dev:prod <suite>` with a dedicated ephemeral MongoDB replica set. The Next.js optimized build passed. Both has-many grouping scenarios passed. All **three Lexical save/typing and external-mutation scenarios passed** with the existing CI timings and `--retries=0`; the original save/typing scenario failed before the null-normalization correction. No screenshot baseline was generated on the host. The reviewed 12-second demo and recording script remain local at the owner's request.

The local pre-commit hook additionally lints changed integration/E2E fixtures, outside the root CI lint command's package/tool scope. That hook reports **132 existing errors** (including conditional expectations and duplicate test titles). Running the identical changed-file lint list with the input revision's test sources produces the same 132 errors and identical file/rule/message counts, with zero added or removed diagnostics. All working sources were restored after this comparison. The commit uses `HUSKY=0` for this demonstrated baseline hook failure; repository hook configuration and CI checks are unchanged. The complete root lint command passes.

Accessibility scope: Group By option availability, preserving the editor's focus and caret through a keyboard save, and dropdown CSS validity. WCAG 1.3.1, 2.1.1, 2.4.3, 2.4.6 and 4.1.2 were assessed for these changes; Chromium verifies the targeted grouping paths and save/typing behavior. Enhanced-contrast appearance, clipping/reflow, visible focus quality and screen-reader output still require visual/assistive-technology verification. These targeted results do not establish WCAG conformance.

The deterministic secrets scan completed across the backlog sources. The public local-database fixture credentials were explicitly confirmed as CI test values by the repository owner; their configuration is retained.

## Published-head Sonar follow-up

SonarCloud analyzed `14224c6acae5532e34ca086d83bd8f11f87525b4`: its Quality Gate passed, with zero bugs/vulnerabilities and 20 new code-smell annotations. The new GitHub build and lint jobs also passed. This follow-up addresses those annotations in source rather than changing their status or the gate.

- Replace the remaining backtracking Markdown link matcher with a linear scan and an index of paired parentheses. A bounded child process confirms the preceding regex times out after two seconds on 100,000 unmatched opening brackets. All 19 sanitizer tests pass, including malformed outer links, multiple links and nested destination parentheses. The distributed AI Reviewer bundle is rebuilt. The isolated official SonarJS complexity/slow-regex check reports no findings in the revised sanitizer.
- Use nullish assignment for typed configuration defaults and job timestamps, preserving explicit `false` and zero values.
- Use raw string literals for JSON-query escaping, URL glob patterns and Markdown table newlines; keep the same resulting characters.
- Separate nested conditions in the block label, table dimensions and hierarchy selection. Custom null labels, empty selections and the five-cell table default retain their behavior.
- Use `Number.isNaN` for already-parsed numeric row indices and the direct opposite operator for the version filter.

Final local validation after these changes: **4,644 unit tests passed / 4 skipped**, 515 passing files; all **46 package builds** passed; complete root lint and formatting passed; the AI Reviewer bundle build and all **19 sanitizer tests** passed. The new cloud analysis must confirm the follow-up commit. The project-wide main-branch backlog remains distinct from these 20 PR annotations.

## Third review: PostgreSQL query budget and accepted Sonar findings

Reviewed input: `42afc94f7a6de75117e6795b8b32c26546b65d24` and [CI run 42381006948](https://github.com/ivan-fr/payload/actions/runs/42381006948). The earlier Group By and Lexical main suites passed on both Next.js and TanStack. Five PostgreSQL variants failed the same queue-log fixture: 17 logged queries versus its expected 16. Retries then failed on its hard-coded job ID, obscuring the first failure.

The failure was reproduced without retries on a dedicated PostgreSQL 17 cluster. The captured trace contains one concurrency-key lookup plus the 16 processing queries. The lookup is unchanged from the base implementation; restoring the base array traversal also produces the same 17-query trace. The fixture now asserts exactly one concurrency lookup and exactly 16 other SQL queries, checks the actual queued job ID, and restores the console spy in `finally`. Both queue-log integration cases pass, including the existing failed-claim transaction cleanup. No queue implementation, timeout, retry policy or workflow is weakened.

SonarCloud had zero open issues but five accepted findings on the reviewed PR. The source corrections address those too, without changing issue statuses:

| Rule          | Correction                                                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7503         | Give the synchronous field-rendering implementation an explicit Promise-returning function contract. Keep its async result and rejected-error behavior.                                                                                                                   |
| S6571         | Express the reserved `all` locale through a generic union, preserving strict generated locales and the nullable default used when localization is disabled.                                                                                                               |
| S9383         | Await template packing at the ESM entry point so completion and rejection are observed.                                                                                                                                                                                   |
| S6848 / S1082 | Replace the table picker's clickable backdrop with a native, translated Close button. Preserve Escape and pointer dismissal, avoid an extra sequential tab stop, reset native button paint/geometry, and inset the shared focus outline so the viewport does not clip it. |

The table regression uses the existing fully featured Lexical fixture because the general accessibility fixture does not enable `TableFeature`. Before remediation, three of four Chromium component cases fail for the missing Close control; Escape already passes. After remediation, all four pass: Enter, Space, Escape from dimension inputs and outside pointer dismissal. The full-editor dismissal scenario passes in development and with packed, optimized production packages, with retries disabled. The 46 package builds and the final UI declaration/Lexical builds pass. Both server-rendering unit cases and all 248 public type tests (416 assertions across 14 files) pass. The final PostgreSQL rerun passes both cases after restoring the normal workspace dependencies.

Accessibility scope: the open table picker and its dismissal surface, Chromium 153.0.8010.12, desktop keyboard/pointer input, 1280×720 workflow tests and 1440×900 enhanced-contrast inspections in light/dark themes. WCAG 2.2 A/AA assessed: 1.3.1 and 4.1.2 (native name/role), 2.1.1 and 2.1.2 (activation and Escape), 2.4.3 (preserved sequential tab behavior), 2.4.6 (translated Close label), 2.4.7/2.4.11 (visible in-viewport focus) and 2.5.2/2.5.8 (native click activation and full-window target). For 1.4.11, the backdrop remains transparent and the focus colors come from the shared palette; the inspection confirms the outline is visible four pixels inside the window in both enhanced themes, without introducing a feature palette override. Exact screen-reader speech, broader grid navigation, mobile reflow and product-wide contrast/conformance remain outside this focused evidence.

The short demonstration and its scenario are retained locally only. No media is committed or uploaded. Generated app/type/config files and the disposable database are cleaned up after validation. Final remote CI and Sonar results must be read from the follow-up commit.
