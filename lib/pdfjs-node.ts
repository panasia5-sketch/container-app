/**
 * Load PDFs for server-side text extraction / OCR rendering without
 * `pdfjs-dist`'s separate `pdf.worker.mjs` file.
 *
 * Why not `pdfjs-dist` directly on Vercel:
 * pdf.js Node "fake worker" dynamically imports
 * `node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`. That sibling is not
 * reliably present under `/var/task` even with `outputFileTracingIncludes`,
 * which produced:
 *   Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'
 *
 * `unpdf` redistributes PDF.js with the worker inlined, so serverless does
 * not need that file on disk.
 */
import { getDocumentProxy } from "unpdf";

export type PDFDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Minimal page surface used by the classifier (matches pdf.js page proxy). */
export type PDFPageProxy = {
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
  };
  getTextContent: () => Promise<{ items: unknown[] }>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

export async function loadPdfDocument(
  data: Uint8Array,
): Promise<PDFDocumentProxy> {
  // unpdf accepts Uint8Array / Buffer and runs the inlined worker in-process.
  return getDocumentProxy(data.slice());
}

export async function destroyPdfDocument(
  pdf: PDFDocumentProxy,
): Promise<void> {
  try {
    const anyPdf = pdf as PDFDocumentProxy & {
      destroy?: () => Promise<void> | void;
      cleanup?: (keepLoadedFonts?: boolean) => Promise<unknown> | unknown;
    };
    if (typeof anyPdf.destroy === "function") {
      await anyPdf.destroy();
      return;
    }
    if (typeof anyPdf.cleanup === "function") {
      await anyPdf.cleanup();
    }
  } catch {
    /* ignore */
  }
}
