/**
 * generate-claude-context.ts
 * Reads Drizzle models, API routes, and features to auto-generate CLAUDE-CONTEXT.md.
 * Run: npx tsx scripts/generate-claude-context.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const MODELS_DIR = join(ROOT, "src/models");
const FEATURES_DIR = join(ROOT, "src/features");
const API_DIR = join(ROOT, "src/app/api");
const OUTPUT = join(ROOT, "CLAUDE-CONTEXT.md");

const TABLE_RE = /pgTable\(\s*"([^"]+)"/g;
const COL_RE = /(\w+):\s*(text|boolean|integer|timestamp|jsonb?|uuid|serial|varchar|numeric)\(/g;
const TS_RE = /\.tsx?$/;
const MODEL_RE = /\.ts$/;

const readDir = (d: string) => { try { return readdirSync(d); } catch { return []; } };
const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };

function extractTables(content: string) {
  const tables: Array<{ name: string; columns: string[] }> = [];
  for (const m of content.matchAll(TABLE_RE)) {
    const name = m[1];
    let depth = 0;
    let start = -1;
    let end = -1;
    for (let i = m.index; i < content.length; i++) {
      if (content[i] === "(") { if (!depth) start = i; depth++; }
      else if (content[i] === ")") { depth--; if (!depth) { end = i; break; } }
    }
    const cols: string[] = [];
    if (start > -1 && end > -1) {
      const body = content.slice(start, end + 1);
      for (const cm of body.matchAll(COL_RE)) cols.push(`${cm[1]}|${cm[2]}`);
    }
    tables.push({ name, columns: cols });
  }
  return tables;
}

function collectRoutes(dir: string, prefix = "/api"): string[] {
  const routes: string[] = [];
  for (const e of readDir(dir)) {
    const full = join(dir, e);
    if (!isDir(full)) continue;
    try {
      const c = readFileSync(join(full, "route.ts"), "utf-8");
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter(
        (method) => c.includes(`export async function ${method}`) || c.includes(`export function ${method}`),
      );
      if (methods.length) routes.push(`${methods.join(", ")} ${prefix}/${e}`);
    } catch { /* no route.ts */ }
    routes.push(...collectRoutes(full, `${prefix}/${e}`));
  }
  return routes;
}

function generate(): string {
  const l: string[] = [];
  const now = new Date().toISOString().split("T")[0];
  l.push("# CLAUDE-CONTEXT.md", "",
    `> Auto-generated on ${now} by \`scripts/generate-claude-context.ts\``,
    "> Re-run after schema/feature changes: `npx tsx scripts/generate-claude-context.ts`", "",
    "## Database Schema (Drizzle ORM)", "");

  const files = readDir(MODELS_DIR).filter((f) => MODEL_RE.test(f) && f !== "index.ts");
  let total = 0;
  for (const f of files) {
    const content = readFileSync(join(MODELS_DIR, f), "utf-8");
    for (const t of extractTables(content)) {
      total++;
      l.push(`### \`${t.name}\` (${relative(ROOT, join(MODELS_DIR, f))})`, "");
      if (t.columns.length) {
        l.push("| Column | Type |", "|--------|------|");
        for (const c of t.columns) { const [n, tp] = c.split("|"); l.push(`| ${n} | ${tp} |`); }
      } else l.push("_Complex definition — inspect source._");
      l.push("");
    }
  }
  l.push(`**Total tables:** ${total}`, "",
    "## Feature Flags", "",
    "Flags use plan/org gating. Schema: `feature_flag` with `key`, `enabled`, `rules` (`{type:'plan'|'org', value}[]`).",
    "Query: `getAllFeatureFlags()` from `@/features/feature-flags/queries`.", "",
    "## API Routes", "");

  const routes = collectRoutes(API_DIR);
  if (routes.length) { l.push("```"); routes.sort().forEach((r) => l.push(r)); l.push("```"); }
  else l.push("_No routes detected._");
  l.push("", "## Feature Modules", "");

  for (const e of readDir(FEATURES_DIR)) {
    if (!isDir(join(FEATURES_DIR, e))) continue;
    const sub = readDir(join(FEATURES_DIR, e)).filter((f) => TS_RE.test(f)).map((f) => f.replace(TS_RE, ""));
    l.push(`- **${e}**: ${sub.join(", ") || "_empty_"}`);
  }
  l.push("", "## Usage", "",
    "1. Claude Code picks up `CLAUDE-CONTEXT.md` alongside `CLAUDE.md` automatically.",
    "2. Regenerate after changes: `npx tsx scripts/generate-claude-context.ts`",
    "3. Commit updated file to keep AI context fresh.", "");
  return l.join("\n");
}

const content = generate();
writeFileSync(OUTPUT, content, "utf-8");
console.log(`✅ Generated ${OUTPUT} (${content.split("\n").length} lines)`);
