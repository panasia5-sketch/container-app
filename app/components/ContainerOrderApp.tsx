"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcRecordTotal,
  formatCurrency,
  formatDate,
  formatDuty,
  formatRate,
  formatTax,
} from "@/lib/format";
import { exportProductsToExcel } from "@/lib/excel-product-export";
import { fetchLatestPoByItemIds, fetchPurchaseHistoryByItemId, type ProductPurchaseHistoryRow } from "@/lib/product-lookup";
import { getErrorMessage } from "@/lib/errors";
import { parsePurchaseExcel } from "@/lib/excel-purchase";
import { syncPurchaseRecordsForPo, syncProductsFromExcel, type PurchaseRecordInsert } from "@/lib/product-sync";
import { deletePurchaseMaster, recalculatePoTotal } from "@/lib/purchase";
import { useAuth, usePermissions } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import type {
  Product,
  PurchaseMaster,
  PurchaseRecord,
  TabId,
} from "@/lib/types";

function NoAccessPanel({ message }: { message: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm text-slate-500">{message}</p>
    </section>
  );
}

const emptyMaster = (): Omit<PurchaseMaster, "total_amount"> & {
  total_amount: number;
} => ({
  po_no: "",
  order_date: new Date().toISOString().slice(0, 10),
  container_no: "",
  invoice_no: "",
  invoice_date: new Date().toISOString().slice(0, 10),
  total_amount: 0,
});

function AlertBanner({
  type,
  message,
  onClose,
  closeLabel,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
  closeLabel: string;
}) {
  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label={closeLabel}
      >
        ✕
      </button>
    </div>
  );
}

const emptyProductForm = () => ({
  item_id: "",
  description: "",
  packaging: "",
  price: "",
  duty: "",
  tax: "",
  rate: "",
});

function productToForm(product: Product) {
  return {
    item_id: product.item_id,
    description: product.description,
    packaging: product.packaging,
    price: String(product.price),
    duty: String(product.duty ?? 0),
    tax: String(product.tax ?? 0),
    rate: String(product.rate ?? 0),
  };
}

function ProductManagementTab({
  products,
  loading,
  onRefresh,
}: {
  products: Product[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t, locale } = useLanguage();
  const { canPerformAction } = usePermissions();
  const canCreateProduct = canPerformAction("products.create");
  const canUpdateProduct = canPerformAction("products.update");
  const canExportProducts = canPerformAction("products.export");
  const showProductForm = canCreateProduct || canUpdateProduct;
  const [itemIdSearch, setItemIdSearch] = useState("");
  const [rateSearch, setRateSearch] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expandedHistoryItemId, setExpandedHistoryItemId] = useState<string | null>(null);
  const [historyByItem, setHistoryByItem] = useState<
    Map<string, ProductPurchaseHistoryRow[]>
  >(new Map());
  const [loadingHistoryItemId, setLoadingHistoryItemId] = useState<string | null>(
    null,
  );
  const [latestPoMap, setLatestPoMap] = useState<Map<string, string>>(new Map());
  const [loadingLatestPo, setLoadingLatestPo] = useState(false);
  const [form, setForm] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const itemIdSearching = itemIdSearch.trim().length > 0;
  const rateSearching = rateSearch.trim().length > 0;
  const isFiltering = itemIdSearching || rateSearching;

  const filteredProducts = useMemo(() => {
    let result = products;
    const itemQuery = itemIdSearch.trim().toLowerCase();

    if (itemQuery) {
      result = result.filter((product) =>
        product.item_id.toLowerCase().includes(itemQuery),
      );
    }

    const rateQuery = rateSearch.trim();
    if (rateQuery) {
      const targetRate = Number(rateQuery);
      result = result.filter((product) => {
        const rate = product.rate ?? 0;
        if (Number.isFinite(targetRate) && /^-?\d*\.?\d+$/.test(rateQuery)) {
          return Math.abs(rate - targetRate) < 0.005;
        }
        return formatRate(rate).includes(rateQuery);
      });
    }

    return result;
  }, [products, itemIdSearch, rateSearch]);

  useEffect(() => {
    if (!isFiltering) {
      setLatestPoMap(new Map());
      setLoadingLatestPo(false);
      return;
    }

    let cancelled = false;
    const itemIds = filteredProducts.map((product) => product.item_id);

    if (itemIds.length === 0) {
      setLatestPoMap(new Map());
      setLoadingLatestPo(false);
      return;
    }

    setLoadingLatestPo(true);
    fetchLatestPoByItemIds(itemIds).then((map) => {
      if (!cancelled) {
        setLatestPoMap(map);
        setLoadingLatestPo(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isFiltering, filteredProducts]);

  const tableColSpan = isFiltering ? 9 : 8;

  const togglePurchaseHistory = async (itemId: string) => {
    if (expandedHistoryItemId === itemId) {
      setExpandedHistoryItemId(null);
      return;
    }

    setExpandedHistoryItemId(itemId);

    if (historyByItem.has(itemId)) return;

    setLoadingHistoryItemId(itemId);
    const rows = await fetchPurchaseHistoryByItemId(itemId);
    setHistoryByItem((prev) => new Map(prev).set(itemId, rows));
    setLoadingHistoryItemId(null);
  };

  const handleExportExcel = async () => {
    if (!isFiltering || filteredProducts.length === 0) return;

    let poMap = latestPoMap;
    if (loadingLatestPo || poMap.size === 0) {
      const itemIds = filteredProducts.map((product) => product.item_id);
      poMap = await fetchLatestPoByItemIds(itemIds);
      setLatestPoMap(poMap);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    exportProductsToExcel(
      filteredProducts.map((product) => ({
        ...product,
        latest_po: poMap.get(product.item_id),
      })),
      `${t("products.exportFilename")}-${stamp}.xlsx`,
    );
  };

  const startEdit = (product: Product) => {
    setEditingItemId(product.item_id);
    setForm(productToForm(product));
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setForm(emptyProductForm());
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItemId ? !canUpdateProduct : !canCreateProduct) return;

    setSaving(true);
    setMessage(null);

    const payload = {
      description: form.description.trim(),
      packaging: form.packaging.trim(),
      price: Number(form.price) || 0,
      duty: Number(form.duty) || 0,
      tax: Number(form.tax) || 0,
      rate: Number(form.rate) || 0,
    };

    if (editingItemId) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("item_id", editingItemId);

      setSaving(false);

      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }

      setMessage({ type: "success", text: t("products.updated") });
      setEditingItemId(null);
      setForm(emptyProductForm());
      onRefresh();
      return;
    }

    const { error } = await supabase.from("products").insert({
      item_id: form.item_id.trim(),
      ...payload,
    });

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({ type: "success", text: t("products.registered") });
    setForm(emptyProductForm());
    onRefresh();
  };

  return (
    <div className={`grid gap-6 ${showProductForm ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t("products.listTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isFiltering
                  ? t("products.filteredCount", { count: filteredProducts.length })
                  : t("products.listCount", { count: products.length })}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:max-w-md">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {t("products.itemId")}
                </span>
                <input
                  type="search"
                  value={itemIdSearch}
                  onChange={(e) => setItemIdSearch(e.target.value)}
                  placeholder={t("products.searchPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {t("common.rate")}
                </span>
                <input
                  type="search"
                  value={rateSearch}
                  onChange={(e) => setRateSearch(e.target.value)}
                  placeholder={t("products.rateSearchPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>
          {isFiltering && canExportProducts && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-blue-700">{t("products.searchHint")}</p>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredProducts.length === 0 || loadingLatestPo}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("products.exportExcel")}
              </button>
            </div>
          )}
          {isFiltering && !canExportProducts && (
            <p className="mt-3 text-sm text-blue-700">{t("products.searchHint")}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">{t("products.itemId")}</th>
                <th className="px-5 py-3 font-medium">{t("products.description")}</th>
                <th className="px-5 py-3 font-medium">{t("products.packaging")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("products.price")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("common.duty")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("common.tax")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("common.rate")}</th>
                {isFiltering && (
                  <th className="px-5 py-3 font-medium">{t("products.latestPo")}</th>
                )}
                <th className="px-5 py-3 font-medium text-right">{t("products.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-5 py-10 text-center text-slate-400">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-5 py-10 text-center text-slate-400">
                    {isFiltering ? t("products.filteredCount", { count: 0 }) : t("products.empty")}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isHistoryExpanded = expandedHistoryItemId === product.item_id;
                  const purchaseHistory = historyByItem.get(product.item_id) ?? [];
                  const isHistoryLoading = loadingHistoryItemId === product.item_id;

                  return (
                    <Fragment key={product.item_id}>
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {product.item_id}
                        </td>
                        <td className="px-5 py-3 text-slate-700">
                          {product.description}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {product.packaging}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-900">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {formatDuty(product.duty ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {formatTax(product.tax ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {formatRate(product.rate ?? 0)}
                        </td>
                        {isFiltering && (
                          <td className="px-5 py-3 font-medium text-blue-700">
                            {loadingLatestPo ? (
                              <span className="text-slate-400">{t("common.loading")}</span>
                            ) : latestPoMap.get(product.item_id) ? (
                              latestPoMap.get(product.item_id)
                            ) : (
                              <span className="font-normal text-slate-400">
                                {t("products.noLatestPo")}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePurchaseHistory(product.item_id)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                                isHistoryExpanded
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {t("products.purchaseHistory")}
                            </button>
                            {canUpdateProduct && (
                              <button
                                type="button"
                                onClick={() => startEdit(product)}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                {t("products.editBtn")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isHistoryExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={tableColSpan} className="px-5 py-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {t("products.purchaseHistoryTitle", {
                                  itemId: product.item_id,
                                })}
                              </h3>
                              {isHistoryLoading ? (
                                <p className="mt-3 text-sm text-slate-400">
                                  {t("common.loading")}
                                </p>
                              ) : purchaseHistory.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-400">
                                  {t("products.noPurchaseHistory")}
                                </p>
                              ) : (
                                <div className="mt-3 overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">
                                          {t("history.poNo")}
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          {t("history.orderDate")}
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          {t("history.container")}
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          {t("history.invoice")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.quantity")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.unitPrice")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.duty")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.tax")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.rate")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.subtotal")}
                                        </th>
                                        <th className="px-3 py-2 font-medium text-right">
                                          {t("common.total")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {purchaseHistory.map((row) => {
                                        const lineTotal = calcRecordTotal(
                                          row.subtotal,
                                          row.duty,
                                          row.tax,
                                        );
                                        return (
                                          <tr key={row.recordId}>
                                            <td className="px-3 py-2 font-medium text-blue-700">
                                              {row.po_no}
                                            </td>
                                            <td className="px-3 py-2 text-slate-700">
                                              {formatDate(row.order_date, locale)}
                                            </td>
                                            <td className="px-3 py-2 text-slate-700">
                                              {row.container_no}
                                            </td>
                                            <td className="px-3 py-2 text-slate-700">
                                              {row.invoice_no} (
                                              {formatDate(row.invoice_date, locale)})
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {row.quantity.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {formatCurrency(row.unit_price)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {formatDuty(row.duty)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {formatTax(row.tax)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {formatRate(row.rate)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">
                                              {formatCurrency(row.subtotal)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-900">
                                              {formatCurrency(lineTotal)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showProductForm && (
      <section className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingItemId ? t("products.editTitle") : t("products.newTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {editingItemId ? t("products.editHint") : t("products.newHint")}
        </p>

        {message && (
          <div className="mt-4">
            <AlertBanner
              type={message.type}
              message={message.text}
              onClose={() => setMessage(null)}
              closeLabel={t("common.close")}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("products.itemId")}
            </span>
            <input
              required
              readOnly={Boolean(editingItemId)}
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                editingItemId ? "cursor-not-allowed bg-slate-50 text-slate-600" : ""
              }`}
              placeholder={t("products.itemIdPlaceholder")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("products.description")}
            </span>
            <input
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder={t("products.descriptionPlaceholder")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("products.packaging")}
            </span>
            <input
              required
              value={form.packaging}
              onChange={(e) => setForm({ ...form, packaging: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder={t("products.packagingPlaceholder")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("products.price")}
            </span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("common.duty")}
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.duty}
              onChange={(e) => setForm({ ...form, duty: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("common.tax")}
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.tax}
              onChange={(e) => setForm({ ...form, tax: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("common.rate")}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="0.00"
            />
          </label>
          <div className="flex gap-2">
            {editingItemId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t("products.cancelEdit")}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? editingItemId
                  ? t("products.saving")
                  : t("products.registering")
                : editingItemId
                  ? t("products.saveBtn")
                  : t("products.registerBtn")}
            </button>
          </div>
        </form>
      </section>
      )}
    </div>
  );
}

function PurchaseOrderTab({
  purchaseOrders,
  onRefresh,
}: {
  purchaseOrders: PurchaseMaster[];
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [master, setMaster] = useState(emptyMaster);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [savedPoNo, setSavedPoNo] = useState<string | null>(null);
  const [excelPoNo, setExcelPoNo] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const masterPayload = {
      ...master,
      po_no: master.po_no.trim(),
      container_no: master.container_no.trim(),
      invoice_no: master.invoice_no.trim(),
      total_amount: 0,
    };

    const { error: masterError } = await supabase
      .from("purchase_master")
      .insert(masterPayload);

    setSaving(false);

    if (masterError) {
      setMessage({ type: "error", text: masterError.message });
      return;
    }

    setMessage({
      type: "success",
      text: t("purchase.masterSaved", { poNo: masterPayload.po_no }),
    });
    setSavedPoNo(masterPayload.po_no);
    setExcelPoNo(masterPayload.po_no);
    setMaster(emptyMaster());
    onRefresh();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excelPoNo) return;

    setUploading(true);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsedRows = parsePurchaseExcel(buffer);

      if (parsedRows.length === 0) {
        setMessage({
          type: "error",
          text: t("purchase.excelNoData"),
        });
        setUploading(false);
        e.target.value = "";
        return;
      }

      const uniqueItemNos = [...new Set(parsedRows.map((r) => r.itemNo))];
      const { data: existingProducts, error: fetchError } = await supabase
        .from("products")
        .select("item_id")
        .in("item_id", uniqueItemNos);

      if (fetchError) {
        throw new Error(
          `Product lookup failed: ${getErrorMessage(fetchError, "Unknown error")}`,
        );
      }

      const existingIds = new Set(
        existingProducts?.map((p) => p.item_id) ?? [],
      );

      const productSync = await syncProductsFromExcel(parsedRows, existingIds);

      const records: PurchaseRecordInsert[] = parsedRows.map((row) => ({
        po_no: excelPoNo,
        item_no: row.itemNo,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        subtotal: row.subtotal,
        duty: row.duty,
        tax: row.tax,
        rate: row.rate,
      }));

      const recordSync = await syncPurchaseRecordsForPo(excelPoNo, records);

      const updatedTotal = await recalculatePoTotal(excelPoNo);

      const rateStored =
        productSync.rateStoredOnProduct && recordSync.rateStoredOnRecord;
      const dutyTaxStored =
        productSync.dutyTaxStoredOnProduct && recordSync.dutyTaxStoredOnRecord;

      const productMsg = [
        productSync.newCount > 0
          ? t("purchase.excelAutoProducts", { count: productSync.newCount })
          : "",
        productSync.updatedCount > 0
          ? t("purchase.excelUpdatedProducts", {
              count: productSync.updatedCount,
            })
          : "",
        !productSync.dutyTaxStoredOnProduct || !dutyTaxStored
          ? t("purchase.excelDutyTaxOnRecordOnly")
          : "",
        !rateStored ? t("purchase.excelRateNotStored") : "",
      ]
        .filter(Boolean)
        .join("");

      setMessage({
        type: "success",
        text: `${t("purchase.excelSuccess", {
          count: records.length,
          poNo: excelPoNo,
          total: formatCurrency(updatedTotal),
        })}${productMsg}`,
      });
      onRefresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: getErrorMessage(err, t("purchase.excelUploadFailed")),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onClose={() => setMessage(null)}
          closeLabel={t("common.close")}
        />
      )}

      <form onSubmit={handleSaveMaster} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("purchase.orderInfo")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("purchase.masterDesc")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.poNo")}
              </span>
              <input
                required
                value={master.po_no}
                onChange={(e) => setMaster({ ...master, po_no: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="PO-2026-001"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.orderDate")}
              </span>
              <input
                required
                type="date"
                value={master.order_date}
                onChange={(e) =>
                  setMaster({ ...master, order_date: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.containerNo")}
              </span>
              <input
                required
                value={master.container_no}
                onChange={(e) =>
                  setMaster({ ...master, container_no: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="CONT-12345"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.invoiceNo")}
              </span>
              <input
                required
                value={master.invoice_no}
                onChange={(e) =>
                  setMaster({ ...master, invoice_no: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="INV-001"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.invoiceDate")}
              </span>
              <input
                required
                type="date"
                value={master.invoice_date}
                onChange={(e) =>
                  setMaster({ ...master, invoice_date: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("purchase.totalAmountAuto")}
              </span>
              <input
                readOnly
                value={t("purchase.totalAmountPending")}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </label>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? t("purchase.savingMaster") : t("purchase.saveMaster")}
            </button>
          </div>
        </section>
      </form>

      <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("purchase.excelTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t("purchase.excelUploadHint")}</p>
        <p className="mt-2 rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-600">
          {t("purchase.excelColumns")}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block min-w-[200px]">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("purchase.targetPo")}
            </span>
            <select
              value={excelPoNo}
              onChange={(e) => setExcelPoNo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t("purchase.selectPo")}</option>
              {purchaseOrders.map((po) => (
                <option key={po.po_no} value={po.po_no}>
                  {po.po_no}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("purchase.excelFile")}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={!excelPoNo || uploading}
              onChange={handleExcelUpload}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
          </label>
        </div>

        {savedPoNo && (
          <p className="mt-3 text-sm text-emerald-700">
            {t("purchase.recentPoSaved", { poNo: savedPoNo })}
          </p>
        )}
      </section>
    </div>
  );
}

function PurchaseHistoryTab({
  purchaseOrders,
  loading,
  onRefresh,
}: {
  purchaseOrders: PurchaseMaster[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t, locale } = useLanguage();
  const { canPerformAction } = usePermissions();
  const canDeletePo = canPerformAction("history.delete");
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, PurchaseRecord[]>>({});
  const [loadingPo, setLoadingPo] = useState<string | null>(null);
  const [deletingPo, setDeletingPo] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .then(({ data }) => {
        if (data) setProductMap(new Map(data.map((p) => [p.item_id, p])));
      });
  }, []);

  useEffect(() => {
    setRecords({});
  }, [purchaseOrders]);

  const togglePo = async (poNo: string) => {
    if (expandedPo === poNo) {
      setExpandedPo(null);
      return;
    }

    setExpandedPo(poNo);

    if (records[poNo]) return;

    setLoadingPo(poNo);
    const { data, error } = await supabase
      .from("purchase_record")
      .select("*")
      .eq("po_no", poNo)
      .order("id");

    setLoadingPo(null);

    if (!error && data) {
      setRecords((prev) => ({ ...prev, [poNo]: data }));
    }
  };

  const handleDeletePo = async (poNo: string) => {
    if (!canDeletePo) return;

    if (!window.confirm(t("history.deleteConfirm", { poNo }))) return;

    setDeletingPo(poNo);
    setMessage(null);

    try {
      await deletePurchaseMaster(poNo);

      if (expandedPo === poNo) setExpandedPo(null);
      setRecords((prev) => {
        const next = { ...prev };
        delete next[poNo];
        return next;
      });

      setMessage({
        type: "success",
        text: t("history.deleteSuccess", { poNo }),
      });
      onRefresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: getErrorMessage(err, t("history.deleteFailed")),
      });
    } finally {
      setDeletingPo(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("history.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("history.hint")}</p>
      </div>

      {message && (
        <div className="border-b border-slate-100 px-5 py-3">
          <AlertBanner
            type={message.type}
            message={message.text}
            onClose={() => setMessage(null)}
            closeLabel={t("common.close")}
          />
        </div>
      )}

      {loading ? (
        <div className="px-5 py-10 text-center text-slate-400">{t("common.loading")}</div>
      ) : purchaseOrders.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-400">
          {t("history.empty")}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {purchaseOrders.map((po) => {
            const isExpanded = expandedPo === po.po_no;
            const poRecords = records[po.po_no] ?? [];

            return (
              <div key={po.po_no}>
                <div className="flex items-center gap-2 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => togglePo(po.po_no)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left transition hover:opacity-80"
                  >
                    <span
                      className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">{t("history.poNo")}</p>
                        <p className="font-semibold text-slate-900">{po.po_no}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("history.orderDate")}</p>
                        <p className="text-slate-700">
                          {formatDate(po.order_date, locale)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("history.container")}</p>
                        <p className="text-slate-700">{po.container_no}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("history.invoice")}</p>
                        <p className="text-slate-700">
                          {po.invoice_no} ({formatDate(po.invoice_date, locale)})
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("history.totalAmount")}</p>
                        <p className="font-semibold text-blue-700">
                          {formatCurrency(po.total_amount)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {canDeletePo && (
                  <button
                    type="button"
                    onClick={() => handleDeletePo(po.po_no)}
                    disabled={deletingPo === po.po_no}
                    className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingPo === po.po_no
                      ? t("history.deleting")
                      : t("history.deletePo")}
                  </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                    {loadingPo === po.po_no ? (
                      <p className="text-sm text-slate-400">{t("history.loadingItems")}</p>
                    ) : poRecords.length === 0 ? (
                      <p className="text-sm text-slate-400">{t("history.noItems")}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-slate-600">
                            <tr>
                              <th className="px-4 py-2.5 font-medium">{t("history.itemId")}</th>
                              <th className="px-4 py-2.5 font-medium">{t("history.description")}</th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.quantity")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.unitPrice")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.duty")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.tax")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.rate")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.subtotal")}
                              </th>
                              <th className="px-4 py-2.5 font-medium text-right">
                                {t("common.total")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {poRecords.map((record) => {
                              const product = productMap.get(record.item_no);
                              const lineTotal = calcRecordTotal(
                                record.subtotal,
                                record.duty ?? 0,
                                record.tax ?? 0,
                              );
                              return (
                                <tr key={record.id}>
                                  <td className="px-4 py-2.5 font-medium text-slate-900">
                                    {record.item_no}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600">
                                    {product?.description ?? "-"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {record.quantity.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {formatCurrency(record.unit_price)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {formatDuty(record.duty ?? 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {formatTax(record.tax ?? 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {formatRate(record.rate ?? 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-700">
                                    {formatCurrency(record.subtotal)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                    {formatCurrency(lineTotal)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ContainerOrderApp() {
  const { t } = useLanguage();
  const { user, signOut, role, accessibleTabs, canAccessTab } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseMaster[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (accessibleTabs.length === 0) return;
    if (!canAccessTab(activeTab)) {
      setActiveTab(accessibleTabs[0]);
    }
  }, [accessibleTabs, activeTab, canAccessTab]);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("item_id");
    setProducts(data ?? []);
    setLoadingProducts(false);
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from("purchase_master")
      .select("*")
      .order("order_date", { ascending: false });
    setPurchaseOrders(data ?? []);
    setLoadingOrders(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchPurchaseOrders();
  }, [fetchProducts, fetchPurchaseOrders]);

  const refreshAll = () => {
    fetchProducts();
    fetchPurchaseOrders();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("app.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t("app.subtitle")}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">{user?.email}</p>
              <p className="text-xs font-medium text-blue-700">{t(`roles.${role}`)}</p>
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                {t("auth.signOut")}
              </button>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {accessibleTabs.map((tabId) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tabId
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {t(`tabs.${tabId}`)}
            </button>
          ))}
        </nav>

        {accessibleTabs.length === 0 ? (
          <NoAccessPanel message={t("auth.noMenuAccess")} />
        ) : (
          <>
        {activeTab === "products" && canAccessTab("products") && (
          <ProductManagementTab
            products={products}
            loading={loadingProducts}
            onRefresh={fetchProducts}
          />
        )}
        {activeTab === "purchase" && canAccessTab("purchase") && (
          <PurchaseOrderTab
            purchaseOrders={purchaseOrders}
            onRefresh={refreshAll}
          />
        )}
        {activeTab === "history" && canAccessTab("history") && (
          <PurchaseHistoryTab
            purchaseOrders={purchaseOrders}
            loading={loadingOrders}
            onRefresh={fetchPurchaseOrders}
          />
        )}
          </>
        )}
      </div>
    </div>
  );
}
