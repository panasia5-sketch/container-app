"use client";

import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { buildOutputBasename } from "@/lib/pdf-filename";

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

export default function PdfClassifyPanel() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [suffix, setSuffix] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassifySummary | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("classified-by-customer.zip");

  const previewName = useMemo(
    () => `${buildOutputBasename("CUST-1001", suffix)}.pdf`,
    [suffix],
  );

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
        const aUnknown = a.startsWith("unknown");
        const bUnknown = b.startsWith("unknown");
        if (aUnknown && !bUnknown) return 1;
        if (!aUnknown && bUnknown) return -1;
        return a.localeCompare(b);
      })
    : [];

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
    </section>
  );
}
