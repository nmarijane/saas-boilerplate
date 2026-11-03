/**
 * Color helpers for the theme tests: read the token blocks of a stylesheet,
 * resolve a token to sRGB (var() chains, color-mix in Oklab) and measure the
 * WCAG 2.x contrast between two colors.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

type Vars = Record<string, string>;
type Oklab = [l: number, a: number, b: number];

export interface Rule {
  /** The items of the selector list, trimmed: `:root, [data-x]` gives two. */
  selectors: string[];
  /** Its custom-property declarations. */
  declarations: Vars;
}

/** The `--name: value` declarations of a rule body; the last may omit its semicolon. */
function parseDeclarations(body: string): Vars {
  const declarations: Vars = {};
  for (const [, name, value] of body.matchAll(
    /(--[\w-]+)\s*:([^;]+)(?:;|$)/g,
  )) {
    declarations[name] = value.trim();
  }
  return declarations;
}

/**
 * The rules of a stylesheet that hold no nested block, in source order and
 * with comments removed. The `@layer` or `@media` around a rule is skipped.
 */
export function parseRules(css: string): Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...source.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(
    ([, prelude, body]) => ({
      // A statement such as `@import "x";` can precede the selector in the same chunk.
      selectors: prelude
        .slice(prelude.lastIndexOf(";") + 1)
        .split(",")
        .map((selector) => selector.trim()),
      declarations: parseDeclarations(body),
    }),
  );
}

/** The declarations of every rule whose selector list includes `selector`, merged. */
export function parseBlock(css: string, selector: string): Vars {
  const declarations: Vars = {};
  for (const rule of parseRules(css)) {
    if (rule.selectors.includes(selector)) {
      Object.assign(declarations, rule.declarations);
    }
  }
  return declarations;
}

/** The `:root` declarations (light) and the `.dark` overrides (dark). */
export function parseThemeBlocks(css: string): { light: Vars; dark: Vars } {
  return { light: parseBlock(css, ":root"), dark: parseBlock(css, ".dark") };
}

function toLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
  const s =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, 255 * s));
}

function toOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]: Oklab): Rgb {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** Splits `a, f(b, c), d` on the commas that sit outside parentheses. */
function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "(") {
      depth++;
    } else if (args[i] === ")") {
      depth--;
    } else if (args[i] === "," && depth === 0) {
      parts.push(args.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(args.slice(start).trim());
  return parts;
}

/** `color-mix(in oklab, <color> <p>%, <color>)`: the only form the themes use. */
function mixInOklab(args: string, vars: Vars, seen: readonly string[]): Rgb {
  const [space = "", weighted = "", other = "", ...extra] = splitTopLevel(args);
  const cut = weighted.lastIndexOf(" ");
  const percent = weighted.slice(cut + 1);
  if (
    space !== "in oklab" ||
    other === "" ||
    extra.length > 0 ||
    !/^\d+(?:\.\d+)?%$/.test(percent)
  ) {
    throw new Error(`Unsupported color-mix(): ${args}`);
  }
  const share = Number.parseFloat(percent) / 100;
  const first = toOklab(resolve(weighted.slice(0, cut), vars, seen));
  const second = toOklab(resolve(other, vars, seen));
  return fromOklab([
    first[0] * share + second[0] * (1 - share),
    first[1] * share + second[1] * (1 - share),
    first[2] * share + second[2] * (1 - share),
  ]);
}

function resolve(value: string, vars: Vars, seen: readonly string[]): Rgb {
  const input = value.trim();

  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(input);
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    const n = Number.parseInt(digits, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const reference = /^var\((--[\w-]+)\)$/.exec(input);
  if (reference) {
    const name = reference[1];
    if (seen.includes(name)) {
      throw new Error(`Circular reference: ${[...seen, name].join(" -> ")}`);
    }
    const target = vars[name];
    if (target === undefined) {
      throw new Error(`Unknown variable ${name}`);
    }
    return resolve(target, vars, [...seen, name]);
  }

  if (input.startsWith("color-mix(") && input.endsWith(")")) {
    return mixInOklab(input.slice("color-mix(".length, -1), vars, seen);
  }

  throw new Error(`Unsupported color: ${input}`);
}

/** A color value (#rgb, #rrggbb, var(--x), color-mix) as 8-bit sRGB channels. */
export function resolveColor(value: string, vars: Vars): Rgb {
  const { r, g, b } = resolve(value, vars, []);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string, vars: Vars): number {
  const first = luminance(resolveColor(a, vars));
  const second = luminance(resolveColor(b, vars));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
