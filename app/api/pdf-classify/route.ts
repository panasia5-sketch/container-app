import { NextRequest, NextResponse } from "next/server";
import {
  classifyAndZipPdf,
  disposePdfClassifyResources,
} from "@/lib/pdf-classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow longer processing for OCR on multi-page PDFs. */
export const maxDuration = 300;

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF 파일이 필요합니다. (file 필드)" },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "파일이 너무 큽니다. 최대 40MB까지 지원합니다." },
        { status: 413 },
      );
    }

    const typeOk =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!typeOk) {
      return NextResponse.json(
        { error: "PDF 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await classifyAndZipPdf(
      new Uint8Array(buffer),
      file.name || "document.pdf",
    );

    const summary = {
      pageCount: result.classifications.length,
      groupCount: Object.keys(result.groups).length,
      unknownPageCount: result.unknownPageCount,
      groups: Object.fromEntries(
        Object.entries(result.groups).map(([id, pages]) => [
          id,
          {
            pageCount: pages.length,
            // 1-based page numbers for UI
            pages: pages.map((i) => i + 1),
          },
        ]),
      ),
      classifications: result.classifications.map((c) => ({
        page: c.pageIndex + 1,
        customerId: c.customerId,
        method: c.method,
      })),
    };

    const zipBuffer = Buffer.from(result.zipBytes);
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(result.zipFilename)}"`,
    );
    headers.set("X-Pdf-Classify-Summary", encodeURIComponent(JSON.stringify(summary)));
    headers.set("Access-Control-Expose-Headers", "X-Pdf-Classify-Summary, Content-Disposition");

    return new NextResponse(zipBuffer, { status: 200, headers });
  } catch (err) {
    console.error("pdf-classify failed:", err);
    const message =
      err instanceof Error ? err.message : "PDF 분류 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Best-effort cleanup of the long-lived OCR worker between requests.
    try {
      await disposePdfClassifyResources();
    } catch {
      /* ignore */
    }
  }
}
