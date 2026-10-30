import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / worker-heavy packages must stay external for the Node route handler.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
  ],
  // pdfjs fake-worker dynamically imports pdf.worker.mjs; NFT cannot see that
  // path, so force-ship the worker (and related assets) into the serverless
  // function bundle used by /api/pdf-classify on Vercel (/var/task).
  outputFileTracingIncludes: {
    "/api/pdf-classify": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/wasm/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default nextConfig;
