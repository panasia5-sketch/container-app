import { supabase } from "./supabase";

/** Most recent PO (by purchase_master.order_date) per item_no. */
export async function fetchLatestPoByItemIds(
  itemIds: string[],
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();

  const { data: records, error } = await supabase
    .from("purchase_record")
    .select("item_no, po_no")
    .in("item_no", itemIds);

  if (error || !records?.length) return new Map();

  const poNos = [...new Set(records.map((r) => r.po_no))];
  const { data: masters, error: masterError } = await supabase
    .from("purchase_master")
    .select("po_no, order_date")
    .in("po_no", poNos);

  if (masterError || !masters?.length) return new Map();

  const orderDateByPo = new Map(masters.map((m) => [m.po_no, m.order_date]));

  const latestByItem = new Map<string, { poNo: string; orderDate: string }>();

  for (const record of records) {
    const orderDate = orderDateByPo.get(record.po_no);
    if (!orderDate) continue;

    const current = latestByItem.get(record.item_no);
    if (!current || orderDate > current.orderDate) {
      latestByItem.set(record.item_no, {
        poNo: record.po_no,
        orderDate,
      });
    }
  }

  return new Map(
    [...latestByItem.entries()].map(([itemNo, { poNo }]) => [itemNo, poNo]),
  );
}

export type ProductPurchaseHistoryRow = {
  recordId: number;
  po_no: string;
  order_date: string;
  container_no: string;
  invoice_no: string;
  invoice_date: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  duty: number;
  tax: number;
  rate: number;
};

/** Purchase lines for one product, newest PO first (by order_date). */
export async function fetchPurchaseHistoryByItemId(
  itemId: string,
): Promise<ProductPurchaseHistoryRow[]> {
  const { data: records, error } = await supabase
    .from("purchase_record")
    .select("*")
    .eq("item_no", itemId);

  if (error || !records?.length) return [];

  const poNos = [...new Set(records.map((record) => record.po_no))];
  const { data: masters, error: masterError } = await supabase
    .from("purchase_master")
    .select("po_no, order_date, container_no, invoice_no, invoice_date")
    .in("po_no", poNos);

  if (masterError || !masters?.length) return [];

  const masterByPo = new Map(masters.map((master) => [master.po_no, master]));

  return records
    .map((record) => {
      const master = masterByPo.get(record.po_no);
      if (!master) return null;

      return {
        recordId: record.id as number,
        po_no: record.po_no,
        order_date: master.order_date,
        container_no: master.container_no,
        invoice_no: master.invoice_no,
        invoice_date: master.invoice_date,
        quantity: record.quantity,
        unit_price: record.unit_price,
        subtotal: record.subtotal,
        duty: record.duty ?? 0,
        tax: record.tax ?? 0,
        rate: record.rate ?? 0,
      };
    })
    .filter((row): row is ProductPurchaseHistoryRow => row !== null)
    .sort((a, b) => b.order_date.localeCompare(a.order_date));
}
