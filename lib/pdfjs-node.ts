/**
 * Configure pdf.js for Node / Next.js serverless (Vercel `/var/task`).
 *
 * pdfjs's Node "fake worker" dynamically `import()`s `pdf.worker.mjs`. That
 * sibling is invisible to @vercel/nft, so we:
 * 1. Statically import the worker and install it on `globalThis.pdfjsWorker`
 *    (fake-worker then skips the dynamic import).
 * 2. Also set `GlobalWorkerOptions.workerSrc` to an absolute `file://` URL
 *    under `process.cwd()/node_modules/...` as a fallback.
 * 3. Rely on `outputFileTracingIncludes` in next.config.ts to ship the worker
 *    (and standard_fonts) into the serverless function bundle.
 */
import { join } from "path";
import { pathToFileURL } from "url";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

export type { PDFDocumentProxy, PDFPageProxy };

function pdfjsAssetUrl(...parts: string[]): string {
  // On Vercel, cwd is `/var/task` and traced node_modules live there.
  return pathToFileURL(
    join(process.cwd(), "node_modules", "pdfjs-dist", ...parts),
  ).href;
}

function ensurePdfjsWorkerConfigured(): void {
  const g = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  // Prefer in-process handler so fake-worker never does dynamic import().
  if (pdfjsWorker?.WorkerMessageHandler) {
    g.pdfjsWorker = pdfjsWorker;
  }

  // Fallback for environments where the static import is stripped/externalized.
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = pdfjsAssetUrl(
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
  }
}

export async function loadPdfDocument(
  data: Uint8Array,
): Promise<PDFDocumentProxy> {
  ensurePdfjsWorkerConfigured();
  const loadingTask = getDocument({
    data: data.slice(),
    // Text positions come from the content stream; avoid native font
    // fallbacks that need platform-specific canvas binaries on serverless.
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: pdfjsAssetUrl("standard_fonts") + "/",
  });
  return loadingTask.promise;
}
