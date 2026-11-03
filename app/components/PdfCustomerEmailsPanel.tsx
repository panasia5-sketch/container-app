"use client";

import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  deleteCustomerEmail,
  listCustomerEmails,
  upsertCustomerEmail,
  type CustomerEmail,
} from "@/lib/customer-emails";

export default function PdfCustomerEmailsPanel({
  onEmailsChange,
}: {
  onEmailsChange?: (rows: CustomerEmail[]) => void;
}) {
  const { t } = useLanguage();
  const { canPerformAction } = usePermissions();
  const canManage = canPerformAction("pdf.emails.manage");

  const [rows, setRows] = useState<CustomerEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCustomerEmails();
      setRows(data);
      onEmailsChange?.(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pdf.emailsLoadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [onEmailsChange, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertCustomerEmail(code, email);
      setCode("");
      setEmail("");
      setSuccess(t("pdf.emailsSaved"));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pdf.emailsSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: CustomerEmail) => {
    setCode(row.customer_code);
    setEmail(row.email);
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (customerCode: string) => {
    if (!canManage) return;
    if (!window.confirm(t("pdf.emailsDeleteConfirm", { code: customerCode }))) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await deleteCustomerEmail(customerCode);
      setSuccess(t("pdf.emailsDeleted"));
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pdf.emailsDeleteFailed"),
      );
    }
  };

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">
        {t("pdf.emailsTitle")}
      </h2>
      <p className="mt-1 text-sm text-stone-500">{t("pdf.emailsHint")}</p>

      {canManage && (
        <form onSubmit={handleSave} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">
              {t("pdf.emailsCode")}
            </span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="CUST-1001"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">
              {t("pdf.emailsEmail")}
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="customer@example.com"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:bg-stone-300"
            >
              {saving ? t("pdf.emailsSaving") : t("pdf.emailsSave")}
            </button>
          </div>
        </form>
      )}

      {!canManage && (
        <p className="mt-3 text-xs text-stone-500">{t("pdf.emailsReadOnly")}</p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-stone-500">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-stone-500">{t("pdf.emailsEmpty")}</p>
        ) : (
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-600">
                  {t("pdf.emailsCode")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">
                  {t("pdf.emailsEmail")}
                </th>
                {canManage && (
                  <th className="px-3 py-2 text-right font-medium text-stone-600">
                    {t("pdf.emailsActions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.customer_code}>
                  <td className="px-3 py-2 font-medium text-stone-900">
                    {row.customer_code}
                  </td>
                  <td className="px-3 py-2 text-stone-700">{row.email}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(row)}
                        className="mr-2 text-teal-700 hover:underline"
                      >
                        {t("pdf.emailsEdit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.customer_code)}
                        className="text-red-600 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
