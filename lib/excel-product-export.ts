import * as XLSX from "xlsx";
import type { Product } from "./types";

export type ProductExportRow = Product & {
  latest_po?: string;
};

export function exportProductsToExcel(
  products: ProductExportRow[],
  filename: string,
): void {
  const headers = [
    "item_id",
    "description",
    "packaging",
    "price",
    "duty",
    "tax",
    "rate",
    "latest_po",
  ];

  const rows = products.map((product) => [
    product.item_id,
    product.description,
    product.packaging,
    product.price,
    product.duty ?? 0,
    product.tax ?? 0,
    product.rate ?? 0,
    product.latest_po ?? "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  XLSX.writeFile(workbook, filename);
}
