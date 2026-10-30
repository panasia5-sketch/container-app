/**
 * Split a multi-page PDF by the customer id printed at the bottom-left of each page.
 *
 * ID format assumptions:
 * - Prefer alphanumeric tokens: letters/digits with optional `.` `_` `-` (2–64 chars).
 * - Ignore short pure page numbers (1–3 digits), common labels (page/페이지/customer/고객),
 *   and date-like tokens.
 * - When several candidates sit in the bottom-left crop, pick the bottom-most then leftmost.
 * - Detection order: embedded text in that region first; OCR of a rendered crop if needed.
 * - Pages with no detectable id are grouped into `unknown.pdf`.
 */

import { tmpdir } from "os";
import { join } from "path";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { getDocument, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";
import Tesseract from "tesseract.js";

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/** Left fraction of the page width treated as the customer-id zone. */
const REGION_LEFT_FRACTION = 0.42;
/** Bottom fraction of the page height treated as the customer-id zone. */
const REGION_BOTTOM_FRACTION = 0.14;
/** Render scale used only for OCR crops. */
const OCR_SCALE = 2.5;

const UNKNOWN_BUCKET = "unknown";

const ID_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const NOISE_LABEL_RE =
  /^(page|페이지|pg|p|no|번호|customer|cust|고객|id|코드|code|date|날짜)$/i;
const DATE_LIKE_RE =
  /^\d{1,4}([./-]\d{1,2}){1,2}$|^\d{8}$|^\d{4}년\d{1,2}월\d{1,2}일$/;

export type PageClassification = {
  pageIndex: number;
  customerId: string | null;
  method: "text" | "ocr" | "none";
  rawText: string;
};

export type ClassifyResult = {
  classifications: PageClassification[];
  groups: Record<string, number[]>;
  unknownPageCount: number;
  zipBytes: Uint8Array;
  zipFilename: string;
};

function isTextItem(item: unknown): item is TextItem {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Partial<TextItem>;
  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

export function sanitizeFilenameId(id: string): string {
  const cleaned = id.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 120) || UNKNOWN_BUCKET;
}

export function pickCustomerIdFromText(raw: string): string | null {
  const tokens = raw
    .replace(/\s+/g, " ")
    .trim()
    .split(/[\s,;|/]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  for (const token of tokens) {
    const normalized = token.replace(/^[#:：]+|[#:：]+$/g, "");
    if (!ID_TOKEN_RE.test(normalized)) continue;
    if (NOISE_LABEL_RE.test(normalized)) continue;
    if (/^\d{1,3}$/.test(normalized)) continue;
    if (DATE_LIKE_RE.test(normalized)) continue;
    candidates.push(normalized);
  }

  if (candidates.length === 0) return null;
  // Prefer ids that look intentional (digit or separator), then longer tokens.
  const score = (token: string) =>
    (/\d/.test(token) ? 2 : 0) + (/[-_.]/.test(token) ? 1 : 0) + Math.min(token.length, 32) / 100;
  candidates.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  return candidates[0] ?? null;
}

type PositionedToken = {
  str: string;
  x: number;
  y: number;
};

function collectBottomLeftTokens(
  page: PDFPageProxy,
  items: TextItem[],
): { tokens: PositionedToken[]; raw: string } {
  const viewport = page.getViewport({ scale: 1 });
  const maxX = viewport.width * REGION_LEFT_FRACTION;
  // PDF user space origin is bottom-left, so the bottom strip is y ∈ [0, maxY].
  const maxY = viewport.height * REGION_BOTTOM_FRACTION;

  const tokens: PositionedToken[] = [];
  for (const item of items) {
    const str = item.str?.trim();
    if (!str) continue;
    // transform[4]=x, transform[5]=y (baseline).
    const x = item.transform[4];
    const y = item.transform[5];
    if (x > maxX || y > maxY) continue;
    tokens.push({ str, x, y });
  }

  tokens.sort((a, b) => b.y - a.y || a.x - b.x);
  const raw = tokens.map((t) => t.str).join(" ");
  return { tokens, raw };
}

async function extractTextId(
  page: PDFPageProxy,
): Promise<{ id: string | null; raw: string }> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const item of content.items) {
    if (isTextItem(item)) items.push(item);
  }
  const { tokens, raw } = collectBottomLeftTokens(page, items);
  if (tokens.length === 0) return { id: null, raw: "" };

  // Prefer bottom-most then leftmost token that looks like an id.
  const ordered = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const token of ordered) {
    const id = pickCustomerIdFromText(token.str);
    if (id) return { id, raw };
  }
  return { id: pickCustomerIdFromText(raw), raw };
}

async function renderBottomLeftCrop(
  page: PDFPageProxy,
): Promise<Buffer> {
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const cropW = Math.max(1, Math.floor(viewport.width * REGION_LEFT_FRACTION));
  const cropH = Math.max(1, Math.floor(viewport.height * REGION_BOTTOM_FRACTION));
  const cropX = 0;
  const cropY = Math.floor(viewport.height - cropH);

  const canvas = createCanvas(cropW, cropH);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, cropW, cropH);

  // Translate so the bottom-left crop aligns with the canvas origin.
  context.translate(-cropX, -cropY);

  const renderTask = page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  });
  await renderTask.promise;

  return canvas.toBuffer("image/png");
}

let ocrWorkerPromise: Promise<Tesseract.Worker> | null = null;

async function getOcrWorker(): Promise<Tesseract.Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await Tesseract.createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-",
      });
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function extractOcrId(
  page: PDFPageProxy,
): Promise<{ id: string | null; raw: string }> {
  const png = await renderBottomLeftCrop(page);
  const worker = await getOcrWorker();
  const result = await worker.recognize(png);
  const raw = result.data.text ?? "";
  return { id: pickCustomerIdFromText(raw), raw: raw.trim() };
}

async function classifyPages(
  data: Uint8Array,
): Promise<PageClassification[]> {
  const loadingTask = getDocument({
    data: data.slice(),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const classifications: PageClassification[] = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textResult = await extractTextId(page);
      if (textResult.id) {
        classifications.push({
          pageIndex: i - 1,
          customerId: textResult.id,
          method: "text",
          rawText: textResult.raw,
        });
        continue;
      }

      let ocrResult: { id: string | null; raw: string } = {
        id: null,
        raw: textResult.raw,
      };
      try {
        ocrResult = await extractOcrId(page);
      } catch (err) {
        console.warn(`OCR failed for page ${i}:`, err);
      }

      classifications.push({
        pageIndex: i - 1,
        customerId: ocrResult.id,
        method: ocrResult.id ? "ocr" : "none",
        rawText: ocrResult.raw || textResult.raw,
      });
    }
  } finally {
    try {
      pdf.cleanup();
    } catch {
      /* ignore */
    }
  }

  return classifications;
}

async function buildGroupedPdfs(
  sourceBytes: Uint8Array,
  groups: Record<string, number[]>,
): Promise<Record<string, Uint8Array>> {
  const source = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
  });
  const outputs: Record<string, Uint8Array> = {};

  for (const [customerId, pageIndexes] of Object.entries(groups)) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, pageIndexes);
    for (const page of copied) {
      out.addPage(page);
    }
    outputs[customerId] = await out.save();
  }

  return outputs;
}

function groupByCustomerId(
  classifications: PageClassification[],
): Record<string, number[]> {
  const groups: Record<string, number[]> = {};
  for (const c of classifications) {
    const key = c.customerId ? sanitizeFilenameId(c.customerId) : UNKNOWN_BUCKET;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c.pageIndex);
  }
  return groups;
}

export async function classifyAndZipPdf(
  pdfBytes: Uint8Array,
  originalFilename = "document.pdf",
): Promise<ClassifyResult> {
  const classifications = await classifyPages(pdfBytes);
  const groups = groupByCustomerId(classifications);
  const pdfs = await buildGroupedPdfs(pdfBytes, groups);

  const zip = new JSZip();
  for (const [customerId, bytes] of Object.entries(pdfs)) {
    zip.file(`${customerId}.pdf`, bytes);
  }

  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  const base = originalFilename.replace(/\.pdf$/i, "") || "classified";
  const unknownPageCount = groups[UNKNOWN_BUCKET]?.length ?? 0;

  return {
    classifications,
    groups,
    unknownPageCount,
    zipBytes,
    zipFilename: `${base}-by-customer.zip`,
  };
}

export async function disposePdfClassifyResources(): Promise<void> {
  if (ocrWorkerPromise) {
    const worker = await ocrWorkerPromise;
    await worker.terminate();
    ocrWorkerPromise = null;
  }
}
