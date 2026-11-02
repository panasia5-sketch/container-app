"use client";

import { useMemo, useRef, useState } from "react";
import { usePermissions } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  customerCodeFromOutputBasename,
  buildOutputBasename,
} from "@/lib/pdf-filename";
import { supabase } from "@/lib/supabase";

type GroupSummary = {
  pageCount: number;
  pages: number[];
  filename?: string;
};

type ClassifySummary = {
  pageCount: number;
  groupCount: number;
  unknownPageCount: number;
  filenameSuffix?: string;
  groups: Record<string, GroupSummary>;
  classifications: Array<{
    page: number;
    customerId: string | null;
    method: "text" | "ocr" | "none";
  }>;
};

type SendResultRow = {
  customerCode: string;
  filename: string;
  to: string | null;
  status: "sent" | "skipped" | "failed";
  message: string;
};

type SendSummary = {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  results: SendResultRow[];
};

export default function PdfClassifyPanel({
  emailMap,
}: {
  emailMap: Record<string, string>;
}) {
  const { t } = useLanguage();
  const { canPerformAction } = usePermissions();
  const canSend = canPerformAction("pdf.emails.send");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [suffix, setSuffix] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassifySummary | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState("classified-by-customer.zip");
  const [sendSummary, setSendSummary] = useState<SendSummary | null>(null);

  const previewName = useMemo(
    () => `${buildOutputBasename("CUST-1001", suffix)}.pdf`,
    [suffix],
  );

  const resetResult = () => {
    setError(null);
    setSummary(null);
    setSendSummary(null);
    setDownloadBlob(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  };

  const onFileChange = (next: File | null) => {
    resetResult();
    setFile(next);
  };

  const handleProcess = async () => {
    if (!file) {
      setError(t("pdf.noFile"));
      return;
    }

    resetResult();
    setProcessing(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("suffix", suffix);

      const res = await fetch("/api/pdf-classify", {
        method: "POST",
        body,
      });

      if (!res.ok) {
        let message = t("pdf.processFailed");
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* ignore */
        }
        setError(message);
        return;
      }

      const header = res.headers.get("X-Pdf-Classify-Summary");
      if (header) {
        try {
          setSummary(JSON.parse(decodeURIComponent(header)) as ClassifySummary);
        } catch {
          /* ignore malformed summary */
        }
      }

      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) {
        setDownloadName(decodeURIComponent(match[1]));
      }

      const blob = await res.blob();
      setDownloadBlob(blob);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pdf.processFailed"));
    } finally {
      setProcessing(false);
    }
  };

  const handleSendEmails = async () => {
    if (!downloadBlob || !summary) return;
    setSending(true);
    setError(null);
    setSendSummary(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(t("pdf.sendNeedLogin"));
        return;
      }

      const body = new FormData();
      body.append("zip", downloadBlob, downloadName || "classified.zip");

      const res = await fetch("/api/pdf-send", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });

      const data = (await res.json()) as SendSummary & { error?: string };
      if (!res.ok) {
        setError(data.error || t("pdf.sendFailed"));
        return;
      }
      setSendSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pdf.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const groupEntries = summary
    ? Object.entries(summary.groups).sort(([a], [b]) => {
        const aUnknown = a.startsWith("unknown");
        const bUnknown = b.startsWith("unknown");
        if (aUnknown && !bUnknown) return 1;
        if (!aUnknown && bUnknown) return -1;
        return a.localeCompare(b);
      })
    : [];

  const missingEmailCount = groupEntries.filter(([id]) => {
    if (id.startsWith("unknown")) return false;
    const code = customerCodeFromOutputBasename(id);
    return !emailMap[code];
  }).length;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">{t("pdf.title")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("pdf.hint")}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="pdf-classify-file"
              className="mb-1.5 block text-sm font-medium text-stone-700"
            >
              {t("pdf.fileLabel")}
            </label>
            <input
              id="pdf-classify-file"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-800 hover:file:bg-teal-100"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="mt-2 text-xs text-stone-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="pdf-classify-suffix"
              className="mb-1.5 block text-sm font-medium text-stone-700"
            >
              {t("pdf.suffixLabel")}
            </label>
            <input
              id="pdf-classify-suffix"
              type="text"
              value={suffix}
              maxLength={80}
              placeholder={t("pdf.suffixPlaceholder")}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              onChange={(e) => {
                resetResult();
                setSuffix(e.target.value);
              }}
            />
            <p className="mt-1.5 text-xs text-stone-500">{t("pdf.suffixHint")}</p>
            <p className="mt-1 font-mono text-xs text-teal-800">
              {t("pdf.suffixPreview", { example: previewName })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || processing}
              onClick={handleProcess}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {processing ? t("pdf.processing") : t("pdf.process")}
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
              >
                {t("pdf.downloadZip")}
              </a>
            )}
            {canSend && downloadBlob && (
              <button
                type="button"
                disabled={sending}
                onClick={handleSendEmails}
                className="rounded-lg border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? t("pdf.sending") : t("pdf.sendEmails")}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {summary && summary.unknownPageCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("pdf.unknownWarning", { count: summary.unknownPageCount })}
          </div>
        )}

        {summary && missingEmailCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("pdf.missingEmailsWarning", { count: missingEmailCount })}
          </div>
        )}
      </div>

      {summary && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">
            {t("pdf.resultTitle")}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {t("pdf.resultSummary", {
              pages: summary.pageCount,
              groups: summary.groupCount,
            })}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.colCustomerId")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.colEmail")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-stone-600">
                    {t("pdf.colPageCount")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.colPages")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {groupEntries.map(([id, group]) => {
                  const filename = group.filename ?? `${id}.pdf`;
                  const isUnknown = id.startsWith("unknown");
                  const code = customerCodeFromOutputBasename(id);
                  const email = isUnknown ? null : emailMap[code] || null;
                  return (
                    <tr key={id}>
                      <td className="px-4 py-2.5 font-medium text-stone-900">
                        {isUnknown ? (
                          <span className="text-amber-700">
                            {filename} ({t("pdf.unknownLabel")})
                          </span>
                        ) : (
                          filename
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {isUnknown ? (
                          "—"
                        ) : email ? (
                          email
                        ) : (
                          <span className="text-amber-700">
                            {t("pdf.noEmail")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-700">
                        {group.pageCount}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {group.pages.join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sendSummary && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">
            {t("pdf.sendResultTitle")}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {t("pdf.sendResultSummary", {
              sent: sendSummary.sent,
              skipped: sendSummary.skipped,
              failed: sendSummary.failed,
            })}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.emailsCode")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.colEmail")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.sendStatus")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-600">
                    {t("pdf.sendMessage")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sendSummary.results.map((row) => (
                  <tr key={`${row.customerCode}-${row.filename}`}>
                    <td className="px-4 py-2.5 font-medium text-stone-900">
                      {row.customerCode}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {row.to || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: SendResultRow["status"] }) {
  const { t } = useLanguage();
  const styles =
    status === "sent"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "skipped"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-red-50 text-red-800 border-red-200";
  const label =
    status === "sent"
      ? t("pdf.statusSent")
      : status === "skipped"
        ? t("pdf.statusSkipped")
        : t("pdf.statusFailed");
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
