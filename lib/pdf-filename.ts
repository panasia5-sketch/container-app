/**
 * Shared filename helpers for PDF classify (safe to import from client components).
 *
 * With a non-empty suffix:
 *   `{customerCode}` + ten ASCII spaces + `{suffix}` + `.pdf`
 *   e.g. `cpat          invoice.pdf`
 * Empty suffix:
 *   `{customerCode}.pdf` (no trailing spaces)
 */

const UNKNOWN_BUCKET = "unknown";

/** Exactly ten ASCII spaces between customer code and suffix. */
export const FILENAME_CODE_SUFFIX_GAP = "          ";

export function sanitizeFilenameId(id: string): string {
  const cleaned = id
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^\.+/, "");
  return cleaned.slice(0, 120) || UNKNOWN_BUCKET;
}

/**
 * Sanitize user-provided text appended after the customer code.
 * Allows Unicode letters/digits plus `.` `_` `-`; strips path separators
 * and control chars. Empty/whitespace-only input → empty suffix.
 */
export function sanitizeFilenameSuffix(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\0-\x1f]+/g, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
}

/** Build output basename (no extension) with optional ten-space gap + suffix. */
export function buildOutputBasename(
  customerCode: string,
  suffix: string,
): string {
  const code = sanitizeFilenameId(customerCode);
  const safeSuffix = sanitizeFilenameSuffix(suffix);
  if (!safeSuffix) return code;
  const combined = `${code}${FILENAME_CODE_SUFFIX_GAP}${safeSuffix}`;
  return combined.slice(0, 180) || code;
}

/** Recover customer code from an output basename (with or without suffix gap). */
export function customerCodeFromOutputBasename(basename: string): string {
  const name = basename.replace(/\.pdf$/i, "");
  const gapIdx = name.indexOf(FILENAME_CODE_SUFFIX_GAP);
  if (gapIdx === -1) return name;
  return name.slice(0, gapIdx);
}
