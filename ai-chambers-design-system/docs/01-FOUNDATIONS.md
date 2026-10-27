# Foundations and shells

## Authority and assets

The JSON token file is canonical. Generated CSS/TypeScript are regenerated together. Screens must not define their own colours, typography, radii or density. Palette checks are necessary but do not prove application accessibility.

Purple belongs to the supplied identity; slate belongs to operational controls. The unchanged user logo is `assets/logo-dark-original.png`, aspect ratio 523/150. Reserve its geometry; display about 140–160px wide on suitable dark surfaces with alt text “AI Chambers.” The PNG contains raster artefacts and is not a clean vector master. The described light variant has dark text/divider with the purple mark unchanged, but approved light artwork has not been supplied. Obtain that export before a brand-final launch. Use accessible “AI Chambers” text on light surfaces meanwhile. Do not recolour the entire PNG. The reference shell uses the supplied dark logo on graphite; the collapsed rail uses an accessible text abbreviation.

No font binaries are supplied. Prefer locally provided Inter with Segoe UI/Arial fallbacks; avoid a remote-font dependency. Use one icon family: PatternFly React Icons. Do not mix it with Lucide or use generated logos from mockups as assets.

## Shell recipes

- WorkspaceShell: global navigation, masthead, compact PageHeader and module content.
- AdminShell: an explicit Platform admin badge and route namespace, with deliberate tenant context.
- SettingsShell: global sidebar plus 176px secondary navigation grouped Workspace/Personal.
- RecordShell: table plus inspector, normally a 16/8 content split.
- ChatShell: optional history 4 columns, conversation 14 and sources 6. Collapse side panels before squeezing reading width.
- FormShell: 16-column form and 8-column summary. Long forms keep natural document scrolling.

A header is not a hero. Use 18px/24px/500 with 8px vertical padding. Counts and actions share its row. Avoid obligatory subtitles. On narrow widths move secondary actions into an accessible overflow menu.

## Responsive contract

Desktop >=1200px: 24 columns, 12px gaps, 16px outer padding. Tablet 768–1199px: 12 columns, 12px gaps; stack when minimum content widths fail. Mobile <768px: 4 columns, 8px gaps, 12px padding and actual 44px minimum touch targets. Mobile editable text is 16px. Check widths 360, 390, 768, 1024, 1440 and 1920, short viewports and 200% zoom. Use min-width:0 on truncating flex/grid children. No horizontal page overflow; a deliberate tablet table scroller may overflow internally with visible scrollbars.

PatternFly's built-in grid is not a 24-column system. The namespaced AI Chambers CSS grid provides the required geometry. Forms must never inherit a table's viewport-height clipping.
