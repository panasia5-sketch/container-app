"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type GroupSummary = {
  pageCount: number;
  pages: number[];
};

type ClassifySummary = {
  pageCount: number;
  groupCount: number;
  unknownPageCount: number;
  groups: Record<string, GroupSummary>;
  classifications: Array<{
    page: number;
    customerId: string | null;
    method: "text" | "ocr" | "none";
  }>;
};

export default function PdfClassifyTab() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassifySummary | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("classified-by-customer.zip");

  const resetResult = () => {
    setError(null);
    setSummary(null);
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
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pdf.processFailed"));
    } finally {
      setProcessing(false);
    }
  };

  const groupEntries = summary
    ? Object.entries(summary.groups).sort(([a], [b]) => {
        if (a === "unknown") return 1;
        if (b === "unknown") return -1;
        return a.localeCompare(b);
      })
    : [];

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t("pdf.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("pdf.hint")}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="pdf-classify-file"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("pdf.fileLabel")}
            </label>
            <input
              id="pdf-classify-file"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="mt-2 text-xs text-slate-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || processing}
              onClick={handleProcess}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
      </div>

      {summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            {t("pdf.resultTitle")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("pdf.resultSummary", {
              pages: summary.pageCount,
              groups: summary.groupCount,
            })}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    {t("pdf.colCustomerId")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    {t("pdf.colPageCount")}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    {t("pdf.colPages")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupEntries.map(([id, group]) => (
                  <tr key={id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {id === "unknown" ? (
                        <span className="text-amber-700">
                          unknown.pdf ({t("pdf.unknownLabel")})
                        </span>
                      ) : (
                        `${id}.pdf`
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {group.pageCount}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {group.pages.join(", ")}
                    </td>
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
