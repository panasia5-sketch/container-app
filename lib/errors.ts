export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint]
      .filter((part) => typeof part === "string" && part.length > 0)
      .map(String);

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  if (typeof err === "string" && err.length > 0) {
    return err;
  }

  return fallback;
}

export function isMissingColumnError(err: unknown, column: string): boolean {
  const message = getErrorMessage(err, "").toLowerCase();
  const columnName = column.toLowerCase();

  return (
    message.includes(columnName) &&
    (message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}
