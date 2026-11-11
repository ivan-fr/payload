# Batch 29: six additional official reports

Base: `23cca29c17`, Payload `4.0.0-beta.6`, branch `codex/six-more-payload-fixes-20261111`. The six reports below were checked open in `payloadcms/payload` on 2026-11-11. This report records local validation before the later request to commit and push the branch. No PR is opened and no official issue is closed.

| Official report                                              | Change                                                                                                                                                | Evidence                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#19490](https://github.com/payloadcms/payload/issues/19490) | Page configuration keeps the same context provider mounted while the layout synchronizes. Collection/global lookups share one helper.                 | Chromium tests retain the original DOM node, focus and client state during login configuration synchronization and an authenticated-to-unauthenticated transition. The original login case mounted twice; the corrected case mounts once.                           |
| [#19481](https://github.com/payloadcms/payload/issues/19481) | The Armenian `hy-AM` translation key imports date-fns' `hy` locale.                                                                                   | The real locale loader resolves `hy` and formats November as `նոյեմբեր`. The original loader returns undefined.                                                                                                                                                     |
| [#19479](https://github.com/payloadcms/payload/issues/19479) | Live Preview explicitly marks supplied data as already flattened. REST and Local API reads carry that optional marker through nested field traversal. | The actual `mergeData` client runs against the fixture REST collection/global endpoints, populating relationships within localized groups, named tabs, arrays and blocks. Local API coverage also exercises the marker without a separate `flattenLocales` setting. |
| [#19448](https://github.com/payloadcms/payload/issues/19448) | Scheduled-publish cleanup matches both numeric IDs and the string IDs stored by the admin, preserving existing numeric job inputs.                    | Real SQLite single and bulk deletions remove matching numeric and string-ID pending jobs, retaining another document's job and completed jobs. Both deletions leave pending jobs behind with the original implementation.                                           |
| [#19459](https://github.com/payloadcms/payload/issues/19459) | Block field queries reuse existing parent and nested joins through `addJoinTable`.                                                                    | Real PostgreSQL query-builder compilation and SQLite Local API queries cover both OR and AND predicates on sibling block fields. Original code throws the duplicate alias error in both dialects. No live PostgreSQL execution is claimed.                          |
| [#19397](https://github.com/payloadcms/payload/issues/19397) | The dashed button variant has sufficient specificity to retain its border on icon-only buttons.                                                       | Chromium checks the real Button's computed 1px dashed border in enabled and disabled states, retaining its accessible name and native disabled state. Original code computes a 0px border.                                                                          |

## Compatibility and access

`flattenLocales: false` retains its existing meaning for raw document data. The new optional `isLocalizedDataFlattened` marker distinguishes Live Preview input, including children whose names resemble locale codes. Supplied raw locale maps and ordinary locale reads remain covered. The read operations only honor the marker when `data` is supplied: a REST query cannot apply flattened-input traversal to persisted documents. Collection and global controls verify that hidden persisted values remain omitted.

Production access checks and their defaults are preserved. Trusted fixture setup explicitly uses Local API access overrides; the preview REST reads use the normal handlers. The shared integration fixture owns database initialization, reset and teardown. Only disposable SQLite databases under `/tmp` are used.

## Validation

Validation runtime: Node `24.22.1`, pnpm `11.28.6`, macOS arm64.

- Affected unit suites: **385 passed across 24 files**. Scope: Drizzle queries/find, translations, version helpers, locale traversal, request parameter parsing and Live Preview.
- Shared-fixture SQLite integration: **8 passed**.
- Chromium component checks: **17 passed across 3 files**, including the existing controllable-state hook suite.
- Package TypeScript checks: `payload`, `ui`, `drizzle`, `translations` and `live-preview` passed.
- Targeted oxlint: zero errors; existing warnings remain. Button CSS stylelint, changed-file formatting and diff whitespace checks passed.
- Fixture types were generated with `pnpm dev:generate-types server-regressions-batch29`.

Representative commands:

```sh
pnpm exec vitest run --project unit packages/drizzle/src/queries packages/drizzle/src/find packages/translations/src packages/payload/src/versions packages/payload/src/utilities/traverseFields.flattened.spec.ts packages/payload/src/utilities/parseParams/index.spec.ts packages/live-preview/src
PAYLOAD_DATABASE=sqlite SQLITE_URL=file:/tmp/payload-batch29-final.db pnpm exec vitest run --project int test/server-regressions-batch29
pnpm exec vitest run --project components packages/ui/src/providers/Config/index.spec.tsx packages/ui/src/elements/Button/dashed.spec.tsx packages/ui/src/hooks/useControllableState.spec.tsx
pnpm exec stylelint packages/ui/src/elements/Button/index.css
```

Baseline checks use the original behavior modules from `HEAD` through a temporary Vite loader, without modifying the working tree. The unit baseline has three expected failures; the final integration baseline has six expected failures and two passing compatibility controls. The original UI source separately reproduced all three initial focus/border regression failures. The final implementations pass the corresponding assertions.

Initial runs encountered dependency load failures before test collection. Reimporting the locked dependencies with `pnpm install --force --frozen-lockfile --ignore-scripts --offline` restored those imports. The lockfile has no changes. A first browser rerun was interrupted by Vite optimizing the new Armenian locale; the subsequent full focused browser run passed.

The standalone fixture typecheck fails on the shared test-harness and adapter dependency graph. After correcting the fixture's generated-data types, no diagnostics reference its new source files. This is not evidence of a clean test-wide typecheck. Full monorepo tests, production application builds, live MongoDB/PostgreSQL and a complete Admin login/preview journey remain unverified.

## Accessibility assessment

Comparison: local changes against `23cca29c17`. The `payload-accessibility` workflow was applied to provider identity/focus, Armenian date content and dashed Button styling. Chromium evidence uses real production components in small component fixtures; it does not evaluate an entire Admin page, application theme or responsive layout.

WCAG 2.2 A/AA criteria assessed:

- **2.1.1 Keyboard (A), 2.4.3 Focus Order (A), 4.1.2 Name, Role, Value (A):** component tests verify retained focus/DOM/state and the Button's name/disabled state. Complete keyboard login/navigation and assistive-technology behavior require application-level verification.
- **1.3.1 Info and Relationships (A), 3.1.1 Language of Page (A), 3.1.2 Language of Parts (AA):** the locale test verifies Armenian date text. Date-to-field relationships, page language markup and spoken dates were not exercised in a rendered Admin view. Status-message/announcement behavior under **4.1.3 (AA)** also needs application and assistive-technology verification.
- **1.4.11 Non-text Contrast (AA):** computed border width/style is verified. The semantic border/color tokens are retained; contrast in enhanced light/dark and ordinary themes is unverified.
- **2.4.7 Focus Visible (AA), 2.4.11 Focus Not Obscured (AA), 1.4.10 Reflow (AA), 1.4.12 Text Spacing (AA), 2.5.8 Target Size (AA):** visual focus quality, obscuring, layout and target geometry need full-page browser/manual checks. No viewport-specific conformance is claimed by these component fixtures.

No axe, screen-reader speech, visual contrast or WCAG conformance claim is made. Human keyboard/visual review and configured assistive-technology checks remain necessary.

## Inventory

The historical snapshot contains **152 fixed reports and 413 unassessed reports**, plus **22 later fixed reports**: **174 reported issues with fixes in this fork**. The inventory counts fork changes, not upstream issue closures. Existing untracked app files are preserved.
