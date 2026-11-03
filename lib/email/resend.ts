import { Resend } from "resend";

export type SendPdfEmailInput = {
  to: string;
  customerCode: string;
  filename: string;
  pdfBytes: Uint8Array;
};

export type SendPdfEmailResult = {
  customerCode: string;
  filename: string;
  to: string | null;
  status: "sent" | "skipped" | "failed";
  message: string;
  emailId?: string;
};

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY가 설정되지 않았습니다. .env.local에 추가하세요.",
    );
  }
  return new Resend(key);
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL이 설정되지 않았습니다. 예: PDF Split <noreply@yourdomain.com>",
    );
  }
  return from;
}

export async function sendCustomerPdfEmail(
  input: SendPdfEmailInput,
): Promise<SendPdfEmailResult> {
  const resend = getResendClient();
  const from = getFromAddress();
  const subject =
    process.env.PDF_EMAIL_SUBJECT?.replaceAll(
      "{customerCode}",
      input.customerCode,
    ) || `[PDF] ${input.customerCode} 문서`;

  const htmlTemplate =
    process.env.PDF_EMAIL_HTML ||
    `<p>안녕하세요.</p>
<p>고객 코드 <strong>{customerCode}</strong> 관련 PDF를 첨부합니다.</p>
<p>파일명: {filename}</p>`;
  const html = htmlTemplate
    .replaceAll("{customerCode}", input.customerCode)
    .replaceAll("{filename}", input.filename);

  const { data, error } = await resend.emails.send({
    from,
    to: [input.to],
    subject,
    html,
    attachments: [
      {
        filename: input.filename,
        // Base64 string avoids SDK Buffer serialization quirks.
        content: Buffer.from(input.pdfBytes).toString("base64"),
      },
    ],
  });

  if (error) {
    return {
      customerCode: input.customerCode,
      filename: input.filename,
      to: input.to,
      status: "failed",
      message: error.message || "발송 실패",
    };
  }

  return {
    customerCode: input.customerCode,
    filename: input.filename,
    to: input.to,
    status: "sent",
    message: "발송 완료",
    emailId: data?.id,
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}
