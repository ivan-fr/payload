# Batch 32: six payment, queue, auth, tooling and admin fixes

Revision: `3bc7c91183`, Payload `4.0.0-beta.6`, branch `codex/six-more-payload-fixes-20261111`. No PR or upstream issue closure was made.

Upstream state: #19017 and #19055 were read as open on 2026-11-11. The issue pages for #16318, #17249, #17119 and #17778 were readable but did not expose their state in this session, and the GitHub API for the upstream repository was not available. They are recorded as open in the 2026-11-02 snapshot and marked `not_verified` in the inventory.

| Official report                                              | Change                                                                                                                                                                                                     | Evidence                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#19017](https://github.com/payloadcms/payload/issues/19017) | The Stripe adapter no longer writes the cart into PaymentIntent metadata. It writes a 64-character SHA-256 `cartItemsHash`; the order items come from the transaction.                                     | A mocked Stripe client that enforces the 500-character limit accepts a 12-item cart. The same test fails on the previous code with Stripe's length error.                                                                    |
| [#19055](https://github.com/payloadcms/payload/issues/19055) | `validateSettlement` compares the metadata hash with the hash of the normalized transaction items. The shipping address is stored in a new `shippingAddress` group on the transaction instead of metadata. | Hash normalization (relationship objects vs IDs, key order, row IDs, null variants, custom properties), mismatch and empty-hash rejection, a realistic 675-character address, legacy metadata precedence.                    |
| [#16318](https://github.com/payloadcms/payload/issues/16318) | New opt-in `retries.backoff.jitter`. Exponential delays are spread between 50% and 100% of the computed delay. The default stays deterministic.                                                            | Unit tests with a controlled `Math.random`: bounds, variation, unchanged default and unchanged `fixed` strategy.                                                                                                             |
| [#17249](https://github.com/payloadcms/payload/issues/17249) | Refreshing the token of the `admin.autoLogin` user starts a session when the request carries none, instead of returning 403.                                                                               | SQLite REST test: refresh returns 200, one session is stored and the refreshed token refreshes again. Fails with 403 on the previous code. Controls: no autoLogin and another user without a session still get 403.          |
| [#17119](https://github.com/payloadcms/payload/issues/17119) | `withPayload` warns once per process when the installed Next.js release is outside the `next` peer range declared by `@payloadcms/next`.                                                                   | Unit tests for supported, unsupported, canary, alternative-range and uninterpretable inputs; the installed Next.js is accepted against the real package range. The range lookup was also run from a CommonJS esbuild bundle. |
| [#17778](https://github.com/payloadcms/payload/issues/17778) | The admin panel omits `fallback-locale` from document requests when localization is not configured. With localization the parameter is unchanged.                                                          | Unit test of the shared helper and its query-string output. The seven call sites were typechecked; they were not exercised in a browser.                                                                                     |

## Behavior and compatibility

**Stripe.** PaymentIntents created by earlier versions still confirm: when `cartItemsHash` is absent the previous `cartItemsSnapshot` comparison runs, and a `shippingAddress` found in metadata takes precedence over the transaction. A PaymentIntent with neither a hash nor a snapshot is rejected, which is stricter than the upstream proposal of skipping the comparison. An empty hash is rejected and never falls back to the snapshot path. The hash uses Web Crypto, so the adapter keeps working on runtimes without `node:crypto`.

The `shippingAddress` group is added to the transactions collection whenever address fields are configured. **SQL databases need a migration for the new columns.** A transactions collection without that field (custom overrides) keeps the previous metadata storage, including its 500-character limit.

**Jitter** is opt-in and one-sided: a jittered delay is never longer than the deterministic one. The upstream request asks for jitter by default; that would change retry timing for every existing project, so it is left as a configuration choice.

**autoLogin.** The session is only started for the account that `admin.autoLogin` already authenticates without credentials, on the admin user collection, and never in `prefillOnly` mode. It grants nothing that an unauthenticated request did not already have under that configuration.

**Next.js warning.** Prerelease tags are ignored, so a canary of a supported release does not warn. Ranges using operators other than plain comparators (`^`, `~`, `workspace:`) are not interpreted and produce no warning.

**fallback-locale.** `Status` now builds its query string with `qs-esm`; parameter order in that request changed, values did not.

## Investigated and excluded

Most older reports no longer apply to this source: #15740, #15825, #17189, #16186, #16341, #17673, #17844, #18163, #18246, #18480, #19002 and #19198 are already handled in 4.0.0-beta.6 or concern code that no longer exists. #13853, #11711 and #12072 did not reproduce on SQLite. #14682, #17928 and #18989 need a design decision; #18927 needs a live MongoDB; #18432 depends on an unsupported `graphql@17` install; #16381 has no identified cause. None of these are counted as fixes, and their inventory status is unchanged.

## Validation

Runtime: Node `22.23.4` (the repository asks for `>=24.22.1`), pnpm `11.28.6`, Linux x64. Dependencies were installed with `--frozen-lockfile --ignore-scripts`.

- Unit: **560 passed across 59 files**. Command: `pnpm exec vitest run --project unit packages/plugin-ecommerce packages/next packages/payload/src/queues packages/payload/src/auth packages/ui/src/utilities`.
- SQLite integration: `test/server-regressions-batch32` **3 passed**; `test/plugin-ecommerce` and `test/server-regressions-batch12` **43 passed across 5 files**.
- Baselines: the five original Stripe hash tests and the autoLogin refresh test fail against the previous implementation.
- Types: `pnpm exec tsc -b packages/payload packages/plugin-ecommerce packages/ui packages/next --pretty false` passed.
- Formatting and oxlint pass on the changed package files. `test/server-regressions-batch12/int.spec.ts` keeps its existing test-lint findings.

Not verified: live Stripe, PostgreSQL, MongoDB and D1; a real migration for the new transaction columns; browser, e2e and accessibility checks for the admin request change; a complete monorepo test run or build. The ecommerce integration suites do not drive the Stripe adapter end to end; that path is covered by unit tests with a mocked Stripe client.

## Inventory

The historical snapshot now contains **165 scoped fixes and 400 unassessed reports**, plus **27 later fixed reports**: **192 scoped fixes in this fork**. The inventory counts fork changes, not upstream issue closures.
