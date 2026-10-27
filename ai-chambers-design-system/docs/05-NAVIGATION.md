# Navigation and overlays

Workspace context governs every route. Switching workspace invalidates queries, selection, inspectors, view caches and permissions. Admin routes are visibly distinct. Keep normal module navigation to two levels. Expanded navigation shows labels; collapsed icons retain accessible names/tooltips. Current route uses aria-current. Breadcrumbs describe hierarchy and every route has a meaningful document title, including loading/error/403/404.

Settings uses grouped Workspace and Personal secondary navigation. Workspace: General, Members & roles, Tool access, Connections, Billing. Personal: Profile, Preferences, Notifications, Security. Only expose real authorised capabilities. Personal preferences never change workspace policy or permissions.

## Inspectors and mobile sheets

Desktop edge inspector is 320–560px when content fits. A modal inspector makes the background inert, places focus meaningfully and returns it to the trigger. Escape closes unless dirty-work confirmation is required. Do not lose edits on outside click. A non-modal persistent inspector is a separate documented host variant; it must not claim aria-modal or focus isolation.

Mobile sheets have a visible close action, optional drag handle, at least 44px targets, safe areas, internally scrollable body and reachable footer. Complex editors use full screen. Virtual keyboard must not cover active controls. Tooltip is noninteractive help; interactive content belongs in a popover. Check nested popovers inside drawers and focus restoration after confirmations.

## Command palette

Ctrl/Cmd+K opens permitted commands. Search tools, views and records without leaking another workspace. Recents are tenant-scoped. Keep sensitive queries out of telemetry. The reference uses native Tab/Enter/Escape; arrow-key listbox behaviour requires a maintained composite implementation and tests before advertising it. Shortcuts must ignore composition and single-key navigation must not fire in text inputs/contenteditable. Every shortcut has a pointer/touch equivalent.

## Layers and scroll

Base0, sticky10, popover100, drawer200, modal300, toast400 are conceptual layer tokens. Preserve PF's modal/portal owner; do not override everything with z-index999999. Portals inherit root theme. Opening/closing an overlay must not jump page scroll. Closing details restores list state only when the query/workspace still matches.
