export type Product = {
  item_id: string;
  description: string;
  packaging: string;
  price: number;
  duty?: number;
  tax?: number;
  rate?: number;
};

export type PurchaseMaster = {
  po_no: string;
  order_date: string;
  container_no: string;
  invoice_no: string;
  invoice_date: string;
  total_amount: number;
};

export type PurchaseRecord = {
  id?: number;
  po_no: string;
  item_no: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  duty: number;
  tax: number;
  rate?: number;
};

export type PurchaseLineItem = {
  id: string;
  item_no: string;
  quantity: number;
  unit_price: number;
  duty: number;
  tax: number;
};

export type TabId = "products" | "purchase" | "history" | "users";
