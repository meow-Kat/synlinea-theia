# Conventions
> Stable tier, autoloaded. Forward-binding rules / gotchas the AI must follow on every task.
> Each rule: imperative do/don't + one-line why (+ optional → ADR-NNNN).
> Promote here only recurring / generalizable lessons; one-offs stay in decisions.md.

## Rules
- **Custom Theia extension packages must compile to `lib/` before the app build.** The app resolves `theiaExtensions` from each package's `lib/...`; if a package isn't `tsc`-built first, `theia build` fails with "Could not resolve @synlinea/...". Keep root `build:browser` running `build:packages` (compile all `packages/*`) first. → ADR-0002
- **Capability discovery + relationship model is fixed in ADR-0002** — reuse those locations / data-model / Level-B rules in later cuts (subagents, toggle, Codex); don't re-invent per feature.
- **AI runs via CLIs in the built-in terminal, not Theia's native AI.** Do not add `@theia/ai-*` (or `plugin-ext`) without an explicit plan; both are intentionally excluded. → ADR-0001

<!-- example shape:
### Security — XSS / DOM-XSS
Fix at the source (server-side escape / server-render), NOT client-side sanitizers or
JS DOM-building. Snyk taint analysis flags `.html()`/`.append()`/`innerHTML` as sinks
regardless of `.text()` safety, so dynamic fixes only relocate the finding. → ADR-NNNN
-->
