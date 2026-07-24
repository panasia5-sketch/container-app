import type { ParsedPurchaseExcelRow } from "./excel-purchase";
import { getErrorMessage, isMissingColumnError } from "./errors";
import { supabase } from "./supabase";
import type { Product } from "./types";

/** Last row per item_no wins when the same item appears multiple times in one file. */
export function buildProductUpserts(
  parsedRows: ParsedPurchaseExcelRow[],
): Product[] {
  const byItem = new Map<string, ParsedPurchaseExcelRow>();

  for (const row of parsedRows) {
    byItem.set(row.itemNo, row);
  }

  return [...byItem.values()].map((row) => ({
    item_id: row.itemNo,
    description: row.description || row.itemNo,
    packaging: row.packaging || "-",
    price: row.unitPrice,
    duty: row.duty,
    tax: row.tax,
    rate: row.rate,
  }));
}

type ProductSyncResult = {
  newCount: number;
  updatedCount: number;
  dutyTaxStoredOnProduct: boolean;
};

export async function syncProductsFromExcel(
  parsedRows: ParsedPurchaseExcelRow[],
  existingIds: Set<string>,
): Promise<ProductSyncResult> {
  const upserts = buildProductUpserts(parsedRows);
  const newCount = upserts.filter((p) => !existingIds.has(p.item_id)).length;
  const updatedCount = upserts.length - newCount;

  const fullPayload = upserts.map((p) => ({
    item_id: p.item_id,
    description: p.description,
    packaging: p.packaging,
    price: p.price,
    duty: p.duty ?? 0,
    tax: p.tax ?? 0,
    rate: p.rate ?? 0,
  }));

  const dutyTaxPayload = upserts.map((p) => ({
    item_id: p.item_id,
    description: p.description,
    packaging: p.packaging,
    price: p.price,
    duty: p.duty ?? 0,
    tax: p.tax ?? 0,
  }));

  const basicPayload = upserts.map((p) => ({
    item_id: p.item_id,
    description: p.description,
    packaging: p.packaging,
    price: p.price,
  }));

  const attempts = [fullPayload, dutyTaxPayload, basicPayload];

  for (let i = 0; i < attempts.length; i++) {
    const { error } = await supabase
      .from("products")
      .upsert(attempts[i], { onConflict: "item_id" });

    if (!error) {
      return {
        newCount,
        updatedCount,
        dutyTaxStoredOnProduct: i < 2,
      };
    }

    const isLast = i === attempts.length - 1;
    const missingOptionalColumn =
      isMissingColumnError(error, "rate") ||
      isMissingColumnError(error, "duty") ||
      isMissingColumnError(error, "tax");

    if (isLast || !missingOptionalColumn) {
      throw new Error(
        `Product sync failed: ${getErrorMessage(error, "Unknown error")}`,
      );
    }
  }

  throw new Error("Product sync failed: Unknown error");
}

export async function clearPurchaseRecordsForPo(poNo: string): Promise<void> {
  const { error } = await supabase
    .from("purchase_record")
    .delete()
    .eq("po_no", poNo);

  if (error) {
    throw new Error(
      `Failed to clear existing purchase records: ${getErrorMessage(error, "Unknown error")}`,
    );
  }
}

export type PurchaseRecordInsert = {
  po_no: string;
  item_no: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  duty: number;
  tax: number;
  rate: number;
};

export async function replacePurchaseRecordsForPo(
  poNo: string,
  records: PurchaseRecordInsert[],
): Promise<void> {
  await clearPurchaseRecordsForPo(poNo);
  await insertPurchaseRecords(records);
}

export async function insertPurchaseRecords(
  records: PurchaseRecordInsert[],
): Promise<void> {
  const chunkSize = 200;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);

    const attempts = [
      chunk,
      chunk.map(
        ({ po_no, item_no, quantity, unit_price, subtotal, duty, tax }) => ({
          po_no,
          item_no,
          quantity,
          unit_price,
          subtotal,
          duty,
          tax,
        }),
      ),
      chunk.map(({ po_no, item_no, quantity, unit_price, subtotal }) => ({
        po_no,
        item_no,
        quantity,
        unit_price,
        subtotal,
      })),
      chunk.map(({ po_no, item_no, quantity, unit_price }) => ({
        po_no,
        item_no,
        quantity,
        unit_price,
      })),
    ];

    let inserted = false;
    let lastError: unknown = null;

    for (const payload of attempts) {
      const { error } = await supabase.from("purchase_record").insert(payload);
      if (!error) {
        inserted = true;
        break;
      }
      lastError = error;
    }

    if (!inserted) {
      throw new Error(
        `Purchase record insert failed: ${getErrorMessage(lastError, "Unknown error")}`,
      );
    }
  }
}
