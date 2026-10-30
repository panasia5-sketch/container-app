import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must stay external. PDF parsing uses `unpdf` (inlined
  // worker) so we deliberately do NOT depend on pdfjs-dist's pdf.worker.mjs.
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/pdf-classify": ["./node_modules/@napi-rs/canvas/**/*"],
  },
};

export default nextConfig;
