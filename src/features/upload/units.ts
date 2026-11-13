/**
 * The unit the uploads are counted in, written once: a megabyte is a million
 * bytes, and a kilobyte a thousand. It is the unit of the storage quota (the
 * limits of the plans are written in it), so the limit of a file, the size the
 * list shows and the figure of a refusal all follow it: a file of 10.4 million
 * bytes is not "10 MB" for one and refused by another. Nothing else is in this
 * module, and it imports nothing: the queries, the validation and the list can
 * all import it.
 */
export const BYTES_PER_KILOBYTE = 1_000;
export const BYTES_PER_MEGABYTE = 1_000_000;
