/**
 * Shared filename helpers for PDF classify (safe to import from client components).
 * Pattern: `{customerCode}{userSuffix}.pdf`
 */

const UNKNOWN_BUCKET = "unknown";

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
 * and control chars. Empty input → empty suffix (`{customerCode}.pdf`).
 */
export function sanitizeFilenameSuffix(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\0-\x1f]+/g, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
}

/** Build `{customerCode}{suffix}` basename (no extension). */
export function buildOutputBasename(
  customerCode: string,
  suffix: string,
): string {
  const code = sanitizeFilenameId(customerCode);
  const safeSuffix = sanitizeFilenameSuffix(suffix);
  const combined = `${code}${safeSuffix}`;
  return combined.slice(0, 180) || code;
}
