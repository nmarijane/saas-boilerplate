# AI Chambers UI instructions

Read README.md, DESIGN.md, UX-CONTRACT.md and relevant component contracts before changing UI. PatternFly React6.7 is the sole foundation. Do not add shadcn, Ant Design, MUI or screen-local replacement owners. tokens/tokens.json is canonical; regenerate CSS and TypeScript.

Use 18/14/13/12px text,24-column desktop grid, compact28px buttons,44px mobile targets, slate operational controls and purple identity only. No wrapped record rows, hidden scrollbars, huge headings or hover-only essential actions.

All object lists reuse RecordTable or an approved server adapter with identical contracts. No unbounded production datasets. Sensitive queries stay out of URLs/localStorage by default. UI checks are not security. Tool1 fields, price and terms come from the supplied schema. Do not charge, send, delete or deploy without task authorisation.

Run npm run verify and npm run test:browser, record actual results and limitations. Contract-only is not implemented. The full app must pass docs/09-ACCEPTANCE.md; mockups and static checks alone are insufficient.
