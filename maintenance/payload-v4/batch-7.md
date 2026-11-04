# Six more fixes on PR #3

Starting point: PR #3 head `06bd2f0d8e3fe513f0254422bb0d4f19cbaf4aa8`, Payload **4.0.0-beta.6**. These six official reports were checked open on 2026-11-03. This addition brings PR #3 to twelve new scoped fixes over main's thirty, and the branch to forty-two total. No upstream issue is closed by this fork.

| Official report                                              | Result                                                                                                                                                                       | Regression evidence                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#16367](https://github.com/payloadcms/payload/issues/16367) | Variant duplicate validation no longer queries the optional deletedAt field. Normal join queries retain Payload's default trash filtering.                                   | The real validator creates variants on a collection with trash disabled, allows a different combination and rejects duplicates. Unit coverage retains the current-document exclusion.                                                                |
| [#16368](https://github.com/payloadcms/payload/issues/16368) | Ignore sibling options that are not arrays instead of crashing every later variant save.                                                                                     | Missing, null and string-valued legacy rows; a malformed sibling preceding a valid duplicate still rejects the duplicate. SQLite integration persists a legacy null JSON value directly through the adapter and then creates/validates new variants. |
| [#16502](https://github.com/payloadcms/payload/issues/16502) | Deep-merge user ecommerce translations over plugin defaults for enabled languages.                                                                                           | Execute the actual plugin with French overrides, unchanged unrelated translations, fallback plugin messages and English default-language configuration.                                                                                              |
| [#17929](https://github.com/payloadcms/payload/issues/17929) | Preserve whole-request false / string false as the global join opt-out rather than iterating the string or converting false into an empty object.                            | Sanitizer and parseParams tests, existing per-field/numeric controls, and real REST single-document/list reads that omit joins while ordinary reads still return related rows.                                                                       |
| [#17938](https://github.com/payloadcms/payload/issues/17938) | Populate using the incoming document ID when initialData has none. Reject missing IDs and non-success HTTP responses before delivering/caching error envelopes as documents. | Real subscribe/handleMessage/mergeData flow with numeric/string/zero IDs and a stubbed fetch boundary; existing-ID/global controls; a 403 never invokes the callback or poisons the cache, and the next valid message recovers.                      |
| [#18217](https://github.com/payloadcms/payload/issues/18217) | Add explicit flattenLocales mode to traverseFields for locale-resolved API documents, including groups, named tabs, arrays and reusable blocks.                              | Persist/read localized groups/tabs in SQLite; exercise nested array/block references, missing-container filling and fields named like locale codes. The default all-locale database traversal is preserved.                                          |

## Using locale-resolved traversal

The shape must be explicit because a child field can legally have the same name as a locale code. There is no heuristic shape guessing. For a normal locale-resolved find/findByID/findGlobal result:

```ts
traverseFields({
  fields: collection.fields,
  ref: document,
  fillEmpty: false,
  flattenLocales: true,
  callback: ({ field, parentPath, ref }) => {
    // Read or transform each field using its resolved parent object.
  },
})
```

Omit flattenLocales (or use false) for database-shaped values and locale: 'all' results. Existing callers keep their current behavior; callers traversing resolved documents must select the new mode.

## Reproduction

Before changing production code, five focused unit files produced **13 failing tests and 6 passing controls**. They demonstrated all six defects. The final focused set includes additional missing-ID, locale-name collision and reusable-block controls.

A separate SQLite reproduction restored the original join sanitizer and traversal implementation and the original validator's missing array guard, while retaining the separately tested disabled-trash correction so later tests could reach their own failure paths. It produced **three failures and one passing control**: null options threw at combo.length, REST joins=false still returned related rows, and resolved localized children were absent. A finally block restored all fixed source files before final validation.

## Final local validation

- **2,298 unit tests passed across 230 files**, with two pre-existing skips. This includes core, GraphQL, Drizzle, MongoDB/PostgreSQL/SQLite adapters, ecommerce, MCP, import/export, storage packages and Live Preview.
- **Nine SQLite integration tests passed** across batches 6 and 7: all five previous PR tests plus four new tests. The batch-7 fixture uses the shared Payload test lifecycle; it does not manually initialize Payload or reset a shared database.
- TypeScript project builds for Payload, ecommerce and Live Preview, including project references, passed.
- The fixture TypeScript project still reports pre-existing cross-adapter/shared-test diagnostics; none refer to the new batch-7 fixture.
- All 24 CI helper tests passed. Package/tool lint, repository formatting and git whitespace checks are checked before publication.

Live Preview tests stub the HTTP boundary; they do not claim a rendered browser/preview interaction test. The ecommerce integration fixture isolates the real validator with minimal product/variant collections and a JSON options field so corrupt legacy values can be persisted. The actual plugin configuration path is exercised separately for translations. Remote MongoDB/PostgreSQL and the complete GitHub Actions matrix remain required before merge. No workflow, quality threshold or access-control default is changed.

## Accessibility scope

Compared with the starting PR head, changes affect backend validation, query parsing, translation configuration merging, traversal and Live Preview population data. No rendered control, markup, CSS, ARIA attribute, keyboard interaction or focus behavior is modified. The translation merge restores caller-provided text; it adds no new labels or error messages. Source assessment considered language (WCAG 3.1.1 A / 3.1.2 AA), error text (3.3.1 A / 3.3.3 AA) and accessible names/status messages (4.1.2 A / 4.1.3 AA); these rendering contracts are unchanged by this diff. Automated evidence verifies translation values and validation outcomes only. No browser, contrast, axe, screen-reader or product conformance claim is made; rendered custom translations and spoken output remain unverified.

The inventory stays a historical 565-issue snapshot: **41 scoped fixes and 524 unassessed reports**, plus post-snapshot #19292, for **42 total**. Reports #19146, #18163, #17673, #17844 and #18081 were inspected and excluded from this batch because the old import/validation/MCP/auth paths are already addressed or replaced in this v4 baseline. Their snapshot status remains unassessed rather than claiming new fixes.
