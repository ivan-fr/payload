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
