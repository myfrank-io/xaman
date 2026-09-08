import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const INBOX_READER_FILES = [
  "./src/lib/inbox/tessdata/*",
  "./node_modules/tesseract.js/package.json",
  "./node_modules/tesseract.js/src/**/*",
  // The OCR engine: the LSTM builds only (the ones tesseract.js picks by default), not the legacy ones.
  "./node_modules/tesseract.js-core/package.json",
  "./node_modules/tesseract.js-core/index.js",
  "./node_modules/tesseract.js-core/tesseract-core-*lstm*",
  // What the worker script requires at run time; the tracer stops at the worker boundary.
  "./node_modules/tesseract.js/node_modules/**/*",
  "./node_modules/{bmp-js,idb-keyval,is-url,node-fetch,whatwg-url,tr46,webidl-conversions}/**/*",
  "./node_modules/{regenerator-runtime,wasm-feature-detect,zlibjs}/**/*",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  /**
   * /dev/ui/emails reads the committed Supabase Auth templates at request time. They live
   * outside src/, so nothing traces them into the serverless bundle on its own and the page
   * would answer ENOENT on a Vercel preview — the one place the gallery is meant to be used.
   */
  outputFileTracingIncludes: {
    "/dev/ui/emails": ["./supabase/templates/*.html"],
    /**
     * The local reader of the inbox (D92) runs behind the inbox page's Server Actions and the
     * mail webhook: Tesseract's worker and wasm, pdf.js's worker and the French OCR model are
     * loaded by path at run time, which the tracer cannot follow on its own.
     */
    // The key is a picomatch glob: the brackets of the segment have to be escaped.
    "/boats/\\[boatId\\]/inbox": INBOX_READER_FILES,
    "/api/webhooks/resend": INBOX_READER_FILES,
  },
  /** Loaded as they are from node_modules: they spawn workers and load wasm by file path. */
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "pdfjs-dist"],
  env: {
    /**
     * The commit this bundle was built from, shown in the install dialog.
     *
     * « C'est toujours le même texte » is unanswerable without it: neither of us can tell a
     * deploy that has not landed from a change that did not work, and we each guessed wrong
     * once today. Vercel sets `VERCEL_GIT_COMMIT_SHA`; locally it reads « dev ».
     */
    NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
