# Adoption and migration

1. Keep the selected nmarijane backend architecture where appropriate. Replace its UI ownership systematically: shadcn/Radix must not remain a second canonical system alongside PatternFly.
2. Install pinned dependencies with `npm ci`. Import PatternFly base CSS, then generated AI Chambers tokens, the bridge and layout styles. Audit any Tailwind preflight before retaining it; competing resets must not silently override PatternFly.
3. Add DESIGN.md, UX-CONTRACT.md and AGENTS.md to application instructions. Consult the component registry before adding a capability.
4. Migrate shell, header, button and fields first; then RecordTable and inspectors; then complete route workflows. Keep before/after screenshots. Remove obsolete route styles and controls after each migration.
5. Resolve the theme before first paint. Apply both `data-ac-theme="dark"` and `pf-v6-theme-dark` to the root. The example resolves theme after mount and does not claim a production no-flash implementation.
6. Replace local fixture adapters with authorised server queries, paging, exports, files and saved-view storage. Never pass arbitrary browser-supplied workflow identifiers or credentials to n8n.
7. Execute the host release gates in 09-ACCEPTANCE.md. Kit verification is not approval to deploy the SaaS.

## Integration boundary

The reference RecordTable loads a bounded fixture array. Production must keep the same UX but query and page on the server. Do not fetch every tenant record into the browser. Counts also require authorisation. Query-wide selection requires a server snapshot/revision and exclusions; the reference's explicit ID export is not a production export service.

## Dependency evidence

GitHub main reported 6.7.1-prerelease.0 during inspection. This kit targets published stable 6.7.0 packages and typechecks against their installed declarations. The static verifier checks every declared PatternFly bridge property against installed CSS. Upgrade dependencies deliberately and rerun browser checks. See SOURCES.md.
