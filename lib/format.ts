export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Duty is not currency — 1 decimal place. */
export function formatDuty(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Tax is not currency — no decimal places. */
export function formatTax(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** Rate — 2 decimal places, not currency. */
export function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string, locale: "ko" | "en" = "ko"): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US");
}

export function calcSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calcLineTotal(
  quantity: number,
  unitPrice: number,
  duty = 0,
  tax = 0,
): number {
  return Math.round((calcSubtotal(quantity, unitPrice) + duty + tax) * 100) / 100;
}

export function calcRecordTotal(subtotal: number, duty = 0, tax = 0): number {
  return Math.round((subtotal + duty + tax) * 100) / 100;
}
