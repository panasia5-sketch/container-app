import type { ParsedPurchaseExcelRow } from "./excel-purchase";
import { getErrorMessage, isGeneratedColumnError, isMissingColumnError } from "./errors";
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

export type ProductSyncResult = {
  newCount: number;
  updatedCount: number;
  dutyTaxStoredOnProduct: boolean;
  rateStoredOnProduct: boolean;
};

type ProductPayload = {
  item_id: string;
  description: string;
  packaging: string;
  price: number;
  duty?: number;
  tax?: number;
  rate?: number;
};

async function upsertProductsWithFallback(
  upserts: Product[],
): Promise<{ dutyTaxStoredOnProduct: boolean; rateStoredOnProduct: boolean }> {
  const attempts: Array<{
    payload: ProductPayload[];
    includesDutyTax: boolean;
    includesRate: boolean;
  }> = [
    {
      payload: upserts.map((p) => ({
        item_id: p.item_id,
        description: p.description,
        packaging: p.packaging,
        price: p.price,
        duty: p.duty ?? 0,
        tax: p.tax ?? 0,
        rate: p.rate ?? 0,
      })),
      includesDutyTax: true,
      includesRate: true,
    },
    {
      payload: upserts.map((p) => ({
        item_id: p.item_id,
        description: p.description,
        packaging: p.packaging,
        price: p.price,
        duty: p.duty ?? 0,
        tax: p.tax ?? 0,
      })),
      includesDutyTax: true,
      includesRate: false,
    },
    {
      payload: upserts.map((p) => ({
        item_id: p.item_id,
        description: p.description,
        packaging: p.packaging,
        price: p.price,
      })),
      includesDutyTax: false,
      includesRate: false,
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const { error } = await supabase
      .from("products")
      .upsert(attempt.payload, { onConflict: "item_id" });

    if (!error) {
      return {
        dutyTaxStoredOnProduct: attempt.includesDutyTax,
        rateStoredOnProduct: attempt.includesRate,
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

export async function syncProductsFromExcel(
  parsedRows: ParsedPurchaseExcelRow[],
  existingIds: Set<string>,
): Promise<ProductSyncResult> {
  const upserts = buildProductUpserts(parsedRows);
  const newCount = upserts.filter((p) => !existingIds.has(p.item_id)).length;
  const updatedCount = upserts.length - newCount;

  const { dutyTaxStoredOnProduct, rateStoredOnProduct } =
    await upsertProductsWithFallback(upserts);

  return {
    newCount,
    updatedCount,
    dutyTaxStoredOnProduct,
    rateStoredOnProduct,
  };
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

export type PurchaseRecordSyncResult = {
  dutyTaxStoredOnRecord: boolean;
  rateStoredOnRecord: boolean;
};

type RecordLinePayload = {
  quantity: number;
  unit_price: number;
  subtotal?: number;
  duty?: number;
  tax?: number;
  rate?: number;
};

type RecordWriteAttempt = {
  payload: RecordLinePayload;
  includesDutyTax: boolean;
  includesRate: boolean;
};

function buildRecordLineAttempts(
  record: PurchaseRecordInsert,
  mode: "insert" | "update",
): RecordWriteAttempt[] {
  const qtyPrice = {
    quantity: record.quantity,
    unit_price: record.unit_price,
  };

  const withOptionalSubtotal =
    mode === "insert"
      ? { ...qtyPrice, subtotal: record.subtotal }
      : qtyPrice;

  const attempts: RecordWriteAttempt[] = [
    {
      payload: {
        ...withOptionalSubtotal,
        duty: record.duty,
        tax: record.tax,
        rate: record.rate,
      },
      includesDutyTax: true,
      includesRate: true,
    },
    {
      payload: {
        ...qtyPrice,
        duty: record.duty,
        tax: record.tax,
        rate: record.rate,
      },
      includesDutyTax: true,
      includesRate: true,
    },
    {
      payload: {
        ...withOptionalSubtotal,
        duty: record.duty,
        tax: record.tax,
      },
      includesDutyTax: true,
      includesRate: false,
    },
    {
      payload: {
        ...qtyPrice,
        duty: record.duty,
        tax: record.tax,
      },
      includesDutyTax: true,
      includesRate: false,
    },
    {
      payload: qtyPrice,
      includesDutyTax: false,
      includesRate: false,
    },
  ];

  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = JSON.stringify(attempt.payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function writePurchaseRecordLine(
  mode: "insert" | "update",
  target: { id?: number; record: PurchaseRecordInsert },
): Promise<{ includesDutyTax: boolean; includesRate: boolean }> {
  const attempts = buildRecordLineAttempts(target.record, mode);

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const { error } =
      mode === "insert"
        ? await supabase.from("purchase_record").insert({
            po_no: target.record.po_no,
            item_no: target.record.item_no,
            ...attempt.payload,
          })
        : await supabase
            .from("purchase_record")
            .update(attempt.payload)
            .eq("id", target.id!);

    if (!error) {
      return {
        includesDutyTax: attempt.includesDutyTax,
        includesRate: attempt.includesRate,
      };
    }

    const isLast = i === attempts.length - 1;
    const retriableError =
      isMissingColumnError(error, "rate") ||
      isMissingColumnError(error, "duty") ||
      isMissingColumnError(error, "tax") ||
      isMissingColumnError(error, "subtotal") ||
      isGeneratedColumnError(error, "subtotal");

    if (isLast || !retriableError) {
      throw new Error(
        `Purchase record ${mode} failed: ${getErrorMessage(error, "Unknown error")}`,
      );
    }
  }

  throw new Error(`Purchase record ${mode} failed: Unknown error`);
}

/** Sync PO line items from Excel — update existing rows' duty/tax/rate, insert new, remove missing. */
export async function syncPurchaseRecordsForPo(
  poNo: string,
  records: PurchaseRecordInsert[],
): Promise<PurchaseRecordSyncResult> {
  const { data: existing, error: fetchError } = await supabase
    .from("purchase_record")
    .select("id, item_no")
    .eq("po_no", poNo);

  if (fetchError) {
    throw new Error(
      `Failed to load existing purchase records: ${getErrorMessage(fetchError, "Unknown error")}`,
    );
  }

  const existingByItem = new Map(
    (existing ?? []).map((row) => [row.item_no, row.id as number]),
  );
  const excelItems = new Set(records.map((row) => row.item_no));

  const toInsert: PurchaseRecordInsert[] = [];
  const toUpdate: Array<{ id: number; record: PurchaseRecordInsert }> = [];

  for (const record of records) {
    const existingId = existingByItem.get(record.item_no);
    if (existingId != null) {
      toUpdate.push({ id: existingId, record });
    } else {
      toInsert.push(record);
    }
  }

  const deleteIds = (existing ?? [])
    .filter((row) => !excelItems.has(row.item_no))
    .map((row) => row.id as number);

  if (deleteIds.length > 0) {
    const { error } = await supabase
      .from("purchase_record")
      .delete()
      .in("id", deleteIds);

    if (error) {
      throw new Error(
        `Failed to remove purchase records: ${getErrorMessage(error, "Unknown error")}`,
      );
    }
  }

  let dutyTaxStoredOnRecord = true;
  let rateStoredOnRecord = true;

  for (const row of toUpdate) {
    const result = await writePurchaseRecordLine("update", row);
    if (!result.includesDutyTax) dutyTaxStoredOnRecord = false;
    if (!result.includesRate) rateStoredOnRecord = false;
  }

  for (const record of toInsert) {
    const result = await writePurchaseRecordLine("insert", { record });
    if (!result.includesDutyTax) dutyTaxStoredOnRecord = false;
    if (!result.includesRate) rateStoredOnRecord = false;
  }

  return { dutyTaxStoredOnRecord, rateStoredOnRecord };
}

/** @deprecated Use syncPurchaseRecordsForPo */
export async function replacePurchaseRecordsForPo(
  poNo: string,
  records: PurchaseRecordInsert[],
): Promise<PurchaseRecordSyncResult> {
  return syncPurchaseRecordsForPo(poNo, records);
}
