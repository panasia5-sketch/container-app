import * as XLSX from "xlsx";
import { calcSubtotal } from "./format";

export type ParsedPurchaseExcelRow = {
  itemNo: string;
  description: string;
  packaging: string;
  quantity: number;
  unitPrice: number;
  duty: number;
  tax: number;
  rate: number;
  subtotal: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isHeaderRow(row: unknown[]): boolean {
  const first = String(row[0] ?? "").trim().toLowerCase();
  return first === "item_no" || first === "item id" || first === "품목id";
}

/** Columns: item_no, description, packaging, quantity, unit_price, duty, tax, rate (row 1 = header) */
export function parsePurchaseExcel(buffer: ArrayBuffer): ParsedPurchaseExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Excel file has no worksheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const parsed: ParsedPurchaseExcelRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    if (i === 0 || isHeaderRow(row)) continue;

    const itemNo = String(row[0] ?? "").trim();
    const description = String(row[1] ?? "").trim();
    const packaging = String(row[2] ?? "").trim();
    const quantity = toNumber(row[3]);
    const unitPrice = toNumber(row[4]);
    const duty = toNumber(row[5]);
    const tax = toNumber(row[6]);
    const rate = toNumber(row[7]);

    if (!itemNo || quantity <= 0) continue;

    parsed.push({
      itemNo,
      description,
      packaging,
      quantity,
      unitPrice,
      duty,
      tax,
      rate,
      subtotal: calcSubtotal(quantity, unitPrice),
    });
  }

  return parsed;
}
