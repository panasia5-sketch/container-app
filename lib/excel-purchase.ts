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

type ColumnMap = {
  itemNo: number;
  description: number;
  packaging: number;
  quantity: number;
  unitPrice: number;
  duty: number;
  tax: number;
  rate: number;
};

const DEFAULT_COLUMNS: ColumnMap = {
  itemNo: 0,
  description: 1,
  packaging: 2,
  quantity: 3,
  unitPrice: 4,
  duty: 5,
  tax: 6,
  rate: 7,
};

const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
  itemNo: ["item_no", "item_id", "itemid", "item", "품목id", "품목_id", "품목"],
  description: ["description", "desc", "설명"],
  packaging: ["packaging", "pack", "포장"],
  quantity: ["quantity", "qty", "수량"],
  unitPrice: ["unit_price", "unitprice", "price", "단가"],
  duty: ["duty", "관세"],
  tax: ["tax", "세금"],
  rate: ["rate"],
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isHeaderRow(row: unknown[]): boolean {
  const first = normalizeHeader(row[0]);
  return HEADER_ALIASES.itemNo.includes(first);
}

function buildColumnMap(headerRow: unknown[]): ColumnMap {
  const map = { ...DEFAULT_COLUMNS };

  for (let i = 0; i < headerRow.length; i++) {
    const header = normalizeHeader(headerRow[i]);
    if (!header) continue;

    for (const key of Object.keys(HEADER_ALIASES) as (keyof ColumnMap)[]) {
      if (HEADER_ALIASES[key].includes(header)) {
        map[key] = i;
      }
    }
  }

  return map;
}

function cellValue(row: unknown[], index: number): unknown {
  return row[index];
}

function parseDataRow(row: unknown[], columns: ColumnMap): ParsedPurchaseExcelRow | null {
  const itemNo = String(cellValue(row, columns.itemNo) ?? "").trim();
  const quantity = toNumber(cellValue(row, columns.quantity));

  if (!itemNo || quantity <= 0) return null;

  const unitPrice = toNumber(cellValue(row, columns.unitPrice));

  return {
    itemNo,
    description: String(cellValue(row, columns.description) ?? "").trim(),
    packaging: String(cellValue(row, columns.packaging) ?? "").trim(),
    quantity,
    unitPrice,
    duty: toNumber(cellValue(row, columns.duty)),
    tax: toNumber(cellValue(row, columns.tax)),
    rate: toNumber(cellValue(row, columns.rate)),
    subtotal: calcSubtotal(quantity, unitPrice),
  };
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
    raw: true,
  });

  const parsed: ParsedPurchaseExcelRow[] = [];
  let columns = DEFAULT_COLUMNS;
  let headerProcessed = false;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    if (!headerProcessed && isHeaderRow(row)) {
      columns = buildColumnMap(row);
      headerProcessed = true;
      continue;
    }

    if (i === 0 && !headerProcessed) {
      columns = DEFAULT_COLUMNS;
    }

    const dataRow = parseDataRow(row, columns);
    if (dataRow) {
      parsed.push(dataRow);
    }
  }

  return parsed;
}
