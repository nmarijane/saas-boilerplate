import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE } from "./units";

/** A size as a figure and the unit it is counted in (the names of `Intl`: the page writes them in its language). */
interface FileSize {
  value: number;
  unit: "byte" | "kilobyte" | "megabyte";
}

/**
 * The size of a file as the list tells it, in the unit of the quota (see
 * `units.ts`): bytes up to a thousand, then kilobytes in whole numbers, then
 * megabytes on one decimal. A size goes up a unit once it would be written as a
 * thousand of the one before, so that nothing reads "1000 kilobytes".
 */
export function fileSizeOf(bytes: number): FileSize {
  if (bytes < BYTES_PER_KILOBYTE) {
    return { value: bytes, unit: "byte" };
  }

  const kilobytes = Math.round(bytes / BYTES_PER_KILOBYTE);
  if (kilobytes < BYTES_PER_KILOBYTE) {
    return { value: kilobytes, unit: "kilobyte" };
  }

  return { value: Math.round((bytes / BYTES_PER_MEGABYTE) * 10) / 10, unit: "megabyte" };
}
