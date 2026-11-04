# Six further fixes on PR #3

Starting point: `a9ac3f1e83f9d7cdc0be262340e02825fe1f1b01`, Payload **4.0.0-beta.6**. These official reports were checked open on 2026-11-03. This batch brings PR #3 to eighteen new scoped fixes over main's thirty, for forty-eight total on this fork. No upstream issue is closed by this fork.

| Official report                                              | Change                                                                                                                                                     | Evidence                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#17201](https://github.com/payloadcms/payload/issues/17201) | Select Stripe.createFetchHttpClient() in initiation, confirmation and the SDK supplied to webhook callbacks.                                               | Adapter-level SDK-boundary assertions cover all three construction sites. Two additional tests use the real installed Stripe SDK with a stubbed global fetch: initiation performs GET/POST and confirmation retrieves/validates settlement before calling the core finalizer. No real charge or provider request is made.                        |
| [#17904](https://github.com/payloadcms/payload/issues/17904) | Place the global false opt-out outside JoinQuery's generated-joins conditional.                                                                            | Real Local API find/findByID calls typecheck with joins: false on a collection without joins. Generated join objects still work; object queries on the joinless collection and unknown join keys remain rejected.                                                                                                                                |
| [#17906](https://github.com/payloadcms/payload/issues/17906) | Add opt-in clientHintHeaders route scoping or false to withPayload. Preserve existing global defaults, custom headers and independent Powered-By behavior. | Five tests cover custom scope, disabled hints, disabled Powered-By, unchanged defaults and the real Next.js custom-route loader applying basePath once.                                                                                                                                                                                          |
| [#18623](https://github.com/payloadcms/payload/issues/18623) | Remove unused find-node-modules and its type dependency from cloud-storage. Remove their two importer edges and five exclusively unused lock nodes.        | No runtime source references the dependency. Parsed YAML graph checks compare every retained snapshot/package record and all unrelated importers against the starting revision. Package builds and storage unit regressions remain green. This removes the reported dependency path; it does not claim the whole monorepo has no audit findings. |
| [#18874](https://github.com/payloadcms/payload/issues/18874) | Emit manual-review notes for recognized Payload calls skipped because of spread or non-literal options. Include file, original line, callee and reason.    | Fixture input/output remain unchanged, notes identify all three ambiguous examples, repeated analysis is stable, and unrelated/explicit access decisions are not flagged. Mixed modified/skipped files retain original source-line reporting and exact filesChanged behavior.                                                                    |
| [#19021](https://github.com/payloadcms/payload/issues/19021) | Use the registered plugin-ecommerce namespace for all four variant validation messages.                                                                    | Execute the actual plugin registration and translation lookup for missing options, missing product, incomplete combinations and duplicates. A real SQLite-backed REST request returns a 400 with the readable duplicate explanation and correction suggestion at the options field path.                                                         |

## Options and compatibility

Header scoping is explicit because withPayload does not load the project's Payload config or know its custom Admin route:

```js
export default withPayload(nextConfig, {
  clientHintHeaders: '/admin/:path*',
})
```

Use the configured Admin path. Next.js adds basePath automatically. Setting the option to false disables theme hints; omitting it keeps the original all-route behavior. The new option is documented in the installation guide. The codemod README and migration guide also explain how skipped calls are reported and why a successful typecheck alone cannot reveal an omitted optional access decision.

The codemod does not guess a value for ambiguous calls. Existing explicit false decisions and runtime access-control defaults remain enforced. The Stripe transport change preserves existing settlement/finalization checks; it does not bypass them. The webhook test proves the supplied SDK's transport configuration, not Workers webhook signature verification.

## Reproduction

Before production changes, four focused unit files produced **13 failures and one passing control**. They reproduced missing codemod notes, ignored header options, missing fetch transport and untranslated messages. The separate JoinQuery type fixture failed on real find/findByID calls because false was not assignable to the generated joinless options; its generated-join control passed.

A further integration reproduction restored only the original validator from the starting revision. The new REST assertion failed on the actual options error message: ecommerce:variantOptionsAlreadyExists instead of the readable explanation. That targeted run had one failed test and four filtered skips. A finally block restored the fixed validator before final validation.

## Validation and limits

- **2,933 unit tests passed across 289 files**, with two pre-existing skips. The expanded scope includes all previously covered packages, withPayload and the full codemod package.
- **164 type tests / 302 assertions passed** across the main types suite and new join-opt-out fixture. The existing suite reports 226 ignored diagnostics/suppressions; these are not newly added or claimed as passing assertions.
- TypeScript project builds passed for Payload, Next, ecommerce, cloud-storage and codemod, including project references.
- **Ten shared-fixture SQLite integration tests passed** across the two PR regression suites, including the new structured REST validation-error assertion. Package/tool lint, repository formatting, git whitespace checks and all 24 CI helper tests passed.

The offline lockfile-only install attempt could not complete pnpm's supply-chain metadata check because cached metadata for the existing @acemir/cssom dependency was unavailable (ERR_PNPM_NO_OFFLINE_META). No policy or threshold was disabled. Instead, the lockfile received the minimal dependency removal, followed by parsed graph verification: remove @types/find-node-modules@2.1.2, find-node-modules@2.1.3, findup-sync@4.0.0, detect-file@1.0.0 and merge@2.1.1 only. Every retained package/snapshot record and unrelated importer is unchanged. A fresh install and the full remote adapter matrix remain required GitHub Actions checks; no successful fresh local install is claimed.

The Stripe tests verify the SDK configuration and real SDK HTTP path against a stubbed fetch boundary. They are not a deployed workerd checkout test. Header tests exercise Next.js route loading, not a measured Chromium cold navigation. The translated error is verified through real REST serialization, not through a rendered Admin browser session.

## Accessibility assessment

The text change follows the variant options validator through REST field errors to the existing FieldError/Tooltip rendering path, which retains its alert role and field-error ID. Source/response evidence assesses WCAG 3.3.1 A (readable error identification) and 3.3.3 AA (duplicate-combination correction suggestion): the returned field message now contains the existing translated explanation rather than an internal lookup key. Language selection (3.1.1 A / 3.1.2 AA) uses the existing translation mechanism. Roles/associations (1.3.1 A / 4.1.2 A) and announcements (4.1.3 AA) are not structurally changed, but rendered relationships and spoken output remain unverified.

There are no component, CSS, focus or keyboard changes. Longer readable messages still require rendered review for clipping/reflow (1.4.4 AA, 1.4.10 AA, 1.4.12 AA) and contrast (1.4.3 AA), including enhanced contrast and ordinary-mode integration. Browser, axe, visual and screen-reader checks were not run in this batch; no browser-level accessibility or conformance pass is claimed. The optional header scope preserves Admin theme hints only when configured to include the actual Admin route; server theme rendering and cold-navigation behavior require deployed browser confirmation.

The historical inventory remains 565 reports: **47 scoped fixes and 518 unassessed snapshot issues**, plus separately tracked #19292, giving **48 fixes total**. Broader candidates #15784, #16180, #18331 and #18383 were inspected but are not part of this six-issue batch.
