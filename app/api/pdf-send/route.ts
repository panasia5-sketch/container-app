import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import {
  requireAction,
  requireAuthedUser,
  supabaseAsUser,
} from "@/lib/auth/api-auth";
import { isEmailConfigured, sendCustomerPdfEmail } from "@/lib/email/resend";
import { customerCodeFromOutputBasename } from "@/lib/pdf-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ZIP_BYTES = 40 * 1024 * 1024;
const UNKNOWN_PREFIX = "unknown";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthedUser(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const denied = requireAction(auth, "pdf.emails.send");
    if (denied) {
      return NextResponse.json({ error: denied.error }, { status: denied.status });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "이메일 발송이 설정되지 않았습니다. RESEND_API_KEY와 RESEND_FROM_EMAIL을 확인하세요.",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const zipFile = formData.get("zip");
    if (!(zipFile instanceof File)) {
      return NextResponse.json(
        { error: "분류 ZIP 파일이 필요합니다. (zip 필드)" },
        { status: 400 },
      );
    }
    if (zipFile.size <= 0 || zipFile.size > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { error: "ZIP 파일 크기가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const zipBytes = new Uint8Array(await zipFile.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBytes);

    const supabase = supabaseAsUser(auth.accessToken);
    const { data: emailRows, error: emailError } = await supabase
      .from("customer_emails")
      .select("customer_code, email");

    if (emailError) {
      return NextResponse.json(
        { error: `이메일 목록을 불러오지 못했습니다: ${emailError.message}` },
        { status: 500 },
      );
    }

    const emailByCode: Record<string, string> = {};
    for (const row of emailRows ?? []) {
      emailByCode[row.customer_code] = row.email;
    }

    const results: Awaited<ReturnType<typeof sendCustomerPdfEmail>>[] = [];
    const pdfEntries = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".pdf"),
    );

    for (const entry of pdfEntries) {
      const filename = entry.name.split("/").pop() || entry.name;
      const basename = filename.replace(/\.pdf$/i, "");
      const customerCode = customerCodeFromOutputBasename(basename);

      if (customerCode === UNKNOWN_PREFIX) {
        // Skip unknown bucket entirely (warn in aggregate).
        results.push({
          customerCode,
          filename,
          to: null,
          status: "skipped",
          message: "미식별(unknown) 파일은 발송하지 않습니다.",
        });
        continue;
      }

      const to = emailByCode[customerCode];
      if (!to) {
        results.push({
          customerCode,
          filename,
          to: null,
          status: "skipped",
          message: "등록된 이메일이 없습니다.",
        });
        continue;
      }

      const pdfBytes = await entry.async("uint8array");
      const sendResult = await sendCustomerPdfEmail({
        to,
        customerCode,
        filename,
        pdfBytes,
      });
      results.push(sendResult);
    }

    const summary = {
      total: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("pdf-send failed:", err);
    const message =
      err instanceof Error ? err.message : "이메일 발송 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
