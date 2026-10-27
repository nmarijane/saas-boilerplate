import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const t = JSON.parse(fs.readFileSync("tokens/tokens.json", "utf8"));
const l = (c) => {
  const v = c
    .replace("#", "")
    .match(/../g)
    .map((x) => Number.parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const x = l(a);
    const y = l(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const checks = [];
for (const [name, c] of Object.entries({
  light: t.color,
  dark: { ...t.color, ...t.dark },
})) {
  const pairs = [
    ["text", "surface"],
    ["muted", "surface"],
    ["text", "canvas"],
    ["success", "successSurface"],
    ["warning", "warningSurface"],
    ["danger", "dangerSurface"],
    ["info", "infoSurface"],
  ];
  for (const [a, b] of pairs) {
    const n = ratio(c[a], c[b]);
    assert(n >= 4.5, `${name} ${a}/${b}: ${n}`);
    checks.push({
      theme: name,
      foreground: a,
      background: b,
      ratio: Number(n.toFixed(2)),
      minimum: 4.5,
    });
  }
  const n = ratio(c.primary, name === "light" ? "#FFFFFF" : c.surface);
  assert(n >= 4.5);
  checks.push({
    theme: name,
    foreground: "primary",
    ratio: Number(n.toFixed(2)),
    minimum: 4.5,
  });
  assert(ratio(c.focus, c.surface) >= 3);
}
for (const p of [
  "README.md",
  "DESIGN.md",
  "UX-CONTRACT.md",
  "AGENTS.md",
  "tokens/disclosure.schema.json",
  "src/styles/tokens.css",
])
  assert(fs.existsSync(p), `Missing ${p}`);
const schema = JSON.parse(fs.readFileSync("tokens/disclosure.schema.json"));
assert.equal(schema.priceMinorUnits, 4999);
assert.equal(schema.pagePricingEnabled, false);
assert.equal(schema.fields.find((f) => f.type === "fileupload").maxFiles, "20");
const css = fs.readFileSync("src/styles/layout.css", "utf8");
assert(css.includes("repeat(24"));
assert(css.includes("prefers-reduced-motion"));
assert(/white-space\s*:\s*nowrap/.test(css));
assert(css.includes("scrollbar-color"));
const bridge = fs.readFileSync("src/styles/patternfly.css", "utf8");
let installed = "";
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".css")) installed += fs.readFileSync(p, "utf8");
  }
}
walk("node_modules/@patternfly/react-core/dist");
walk("node_modules/@patternfly/react-styles");
const vars = [...new Set(bridge.match(/--pf-[a-zA-Z0-9-]+(?=\s*:)/g))];
for (const v of vars)
  assert(
    installed.includes(`${v  }:`) || installed.includes(`${v  } :`),
    `Unverified PatternFly CSS property ${v}`,
  );
function sources(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? sources(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
for (const p of sources("src").filter(
  (x) => /\.tsx?$/.test(x) && !x.endsWith("tokens.ts"),
)) {
  const s = fs.readFileSync(p, "utf8");
  assert(!/\b(alert|confirm|prompt)\s*\(/.test(s), `Native dialog ${p}`);
  assert(!/localStorage/.test(s), `Unapproved sensitive persistence ${p}`);
}
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/static-checks.json",
  JSON.stringify(
    {
      status: "passed",
      checks: {
        contrast: checks,
        patternFlyBridgeVariables: vars.length,
        disclosureSchema: true,
        requiredContracts: true,
        staticAntiPatterns: true,
      },
      limits:
        "Palette/static checks do not prove full accessibility or production behaviour.",
    },
    null,
    2,
  ),
);
console.log(
  `Static checks passed: ${checks.length} contrast pairs, ${vars.length} verified PatternFly CSS variables, schema/contracts/anti-patterns.`,
);
