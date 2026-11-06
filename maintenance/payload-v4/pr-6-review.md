# PR #6 review follow-up

Reviewed published head `b4090895d7a60ecfc7a902f3ddb46734334cf440`. The unit/component CI job passed. The only completed failing check observed was SonarCloud: **5.8% duplication on new code**, above the **3%** limit. Other jobs were still queued or running; this is not a claim that the entire run had completed.

## Corrections

Sonar also annotated three consecutive `defaultWidgets.push` calls in config sanitization. The four unconditional registrations now form one array literal, followed by the existing conditional upload widget and configured-slug filtering. Evaluation order, override handling and widget metadata are preserved.

A local token comparison locates repeated new-code dictionary entries across the 44 locale modules. Each locale intentionally uses the same translation keys and interpolation schema, with different message text. Those are declarative resources, rather than duplicated application algorithms.

The analysis configuration now explicitly sets `sonar.cpd.exclusions=packages/translations/src/languages/*.ts`. This changes the **duplication-analysis scope** from the earlier PR revisions. The locale files remain in normal Sonar analysis, and the existing 3% duplication threshold remains unchanged for application code. No source exclusions, coverage exclusions, workflow gates, retries or timeouts are added or relaxed. Sonar documents this separate setting in its [duplication-exclusion reference](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/setting-analysis-scope/exclude-from-coverage-duplication).

The new resource test checks every matching TypeScript locale module. It permits only type imports and constant dictionary data referencing previously declared local dictionaries. Calls, classes, functions, global writes and runtime imports cannot enter this excluded resource scope without failing the test. Negative fixtures verify rejection of executable expressions and imports. Existing all-language interpolation and actual translated LoadMoreRow checks remain intact.

## Verification

- Config sanitization, configured widget override/default controls, all 44 language resource modules, executable-content rejection controls, count placeholders/client-key availability and Polish regression coverage: **105 tests passed across five files**.
- `pnpm exec tsc -b packages/payload packages/translations --pretty false`: passed.
- Package/tool lint, formatting and whitespace are checked before publication.

There is no user-facing markup, styling, label, keyboard or focus change in this follow-up. Widget registration behavior is covered by the real config sanitizer tests; the previous UI/accessibility evidence limits still apply. No browser/assistive-technology result is inferred from these unit tests.

The report count stays at twelve for PR #6 and 138 scoped fork fixes overall. No merge or upstream issue closure is performed. A new Sonar analysis and the remaining CI checks must validate the corrected head before merge.
