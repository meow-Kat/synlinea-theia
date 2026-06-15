# Conventions
> Stable tier, autoloaded. Forward-binding rules / gotchas the AI must follow on every task.
> Each rule: imperative do/don't + one-line why (+ optional → ADR-NNNN).
> Promote here only recurring / generalizable lessons; one-offs stay in decisions.md.

## Rules
TBD — filled as recurring rules emerge (promoted from decisions.md or user feedback)

<!-- example shape:
### Security — XSS / DOM-XSS
Fix at the source (server-side escape / server-render), NOT client-side sanitizers or
JS DOM-building. Snyk taint analysis flags `.html()`/`.append()`/`innerHTML` as sinks
regardless of `.text()` safety, so dynamic fixes only relocate the finding. → ADR-NNNN
-->
