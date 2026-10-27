import fs from "node:fs";
const t = JSON.parse(fs.readFileSync("tokens/tokens.json", "utf8"));
const unit = (group, key, v) =>
  typeof v === "number"
    ? group === "motion"
      ? `${v}ms`
      : ["layer"].includes(group) ||
          (/Columns|Min$/.test(key) && group === "layout") ||
          ["regular", "medium"].includes(key)
        ? String(v)
        : `${v}px`
    : v;
const name = (g, k) =>
  `--ac-${g}-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
const lines = [];
for (const [g, vs] of Object.entries(t))
  if (g !== "dark")
    for (const [k, v] of Object.entries(vs))
      lines.push(`  ${name(g, k)}: ${unit(g, k, v)};`);
fs.writeFileSync(
  "src/styles/tokens.css",
  `/* Generated from tokens/tokens.json. Do not edit. */\n:root {\n${lines.join("\n")}\n}\n:root[data-ac-theme="dark"] {\n${Object.entries(
    t.dark,
  )
    .map(([k, v]) => `  ${name("color", k)}: ${v};`)
    .join("\n")}\n  color-scheme: dark;\n}\n`,
);
fs.writeFileSync(
  "src/tokens.ts",
  `// Generated. Do not edit.\nexport const tokens = ${ 
    JSON.stringify(t, null, 2) 
    } as const;\n`,
);
