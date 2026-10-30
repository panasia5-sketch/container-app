import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / worker-heavy packages must stay external for the Node route handler.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
  ],
};

export default nextConfig;
