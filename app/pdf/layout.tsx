import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF 고객 분류",
  description:
    "다중 페이지 PDF를 페이지 좌측 하단 고객 ID 기준으로 분리해 ZIP으로 내려받습니다.",
};

export default function PdfLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
