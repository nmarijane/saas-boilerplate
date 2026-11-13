import type { Page, TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const OUTPUT = resolve(import.meta.dirname, "../../docs/screenshots");

/**
 * Takes the picture of the page as it stands and saves it as
 * `docs/screenshots/<name>-<project>.png` (`home-desktop-light.png`). An
 * interface has few colors: a palette of 256 keeps it sharp, for a file that is
 * a fraction of the size. The animations are finished, so that a bar that is
 * filling or a menu that is opening is not caught half way.
 */
export async function savePng(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const picture = await page.screenshot({ animations: "disabled" });

  await mkdir(OUTPUT, { recursive: true });
  await sharp(picture)
    .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
    .toFile(resolve(OUTPUT, `${name}-${testInfo.project.name}.png`));
}
