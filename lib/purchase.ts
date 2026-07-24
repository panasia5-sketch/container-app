import { calcRecordTotal } from "./format";
import { getErrorMessage } from "./errors";
import { supabase } from "./supabase";

export async function recalculatePoTotal(poNo: string): Promise<number> {
  const { data, error } = await supabase
    .from("purchase_record")
    .select("subtotal, duty, tax, quantity, unit_price")
    .eq("po_no", poNo);

  if (error) {
    throw new Error(
      `Total recalculation failed: ${getErrorMessage(error, "Unknown error")}`,
    );
  }

  const total = (data ?? []).reduce((sum, record) => {
    if (record.subtotal != null) {
      return (
        sum +
        calcRecordTotal(record.subtotal, record.duty ?? 0, record.tax ?? 0)
      );
    }

    const qty = Number(record.quantity ?? 0);
    const price = Number(record.unit_price ?? 0);
    return sum + calcRecordTotal(qty * price, record.duty ?? 0, record.tax ?? 0);
  }, 0);

  const { error: updateError } = await supabase
    .from("purchase_master")
    .update({ total_amount: total })
    .eq("po_no", poNo);

  if (updateError) {
    throw new Error(
      `Total update failed: ${getErrorMessage(updateError, "Unknown error")}`,
    );
  }

  return total;
}

export async function deletePurchaseMaster(poNo: string): Promise<void> {
  const { error } = await supabase
    .from("purchase_master")
    .delete()
    .eq("po_no", poNo);

  if (error) {
    throw new Error(
      `Failed to delete purchase order: ${getErrorMessage(error, "Unknown error")}`,
    );
  }
}
