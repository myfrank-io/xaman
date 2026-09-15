import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * What the local reader (D92) needs at run time and the tracer cannot find on its own: Tesseract
 * loads its engine and pdf.js its worker by file path, from inside a worker the tracer does not
 * follow. Everything here is copied into the two functions listed below, so every file that is
 * not strictly reachable is paid twice per deployment, on every deployment (D139).
 */
const INBOX_READER_FILES = [
  "./node_modules/tesseract.js/package.json",
  "./node_modules/tesseract.js/src/**/*",
  // The OCR engine. `extract.ts` calls `createWorker(…, 1, …)` — OEM 1, LSTM only — so
  // `tesseract.js-core`'s getCore can only ever require a `-lstm` build. Which of the three it
  // picks depends on the CPU's wasm features: Vercel's runtime asks for `relaxedsimd`, the two
  // others are the insurance against that changing under us. Node requires the small `.js`,
  // which reads the `.wasm` sitting beside it — the `.wasm.js` files are the browser's
  // single-file build and are never loaded here. Shipping the whole package cost 43 Mo a
  // function, 35 of them unreachable.
  "./node_modules/tesseract.js-core/package.json",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.js",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm",
  // What the worker script requires at run time; the tracer stops at the worker boundary.
  // `zlibjs` is not in the list: `worker-script/node/gunzip.js` is `require('zlib').gunzipSync`,
  // Node's own — zlibjs is the browser's gunzip, and it travelled 3,5 Mo a function for nothing.
  "./node_modules/tesseract.js/node_modules/**/*",
  "./node_modules/{bmp-js,idb-keyval,is-url,node-fetch,whatwg-url,tr46,webidl-conversions}/**/*",
  "./node_modules/{regenerator-runtime,wasm-feature-detect}/**/*",
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
     * mail webhook: Tesseract's worker and wasm and pdf.js's worker are loaded by path at run
     * time, which the tracer cannot follow on its own. The French model is no longer here — it
     * is served from Supabase Storage (D139).
     */
    // The key is a picomatch glob: the brackets of the segment have to be escaped.
    "/boats/\\[boatId\\]/inbox": INBOX_READER_FILES,
    "/api/webhooks/resend": INBOX_READER_FILES,
  },
  /**
   * `outputFileTracingExcludes` is deliberately not used to drop what the tracer adds on its own
   * — pdf.js's source map, the browser build of the OCR engine. Turbopack honours the includes
   * above and ignores the excludes: measured on this project, the files stayed in the trace with
   * every shape of glob and of route key. `scripts/trim-server-trace.mjs` does it after the
   * build instead, on the one file Vercel actually reads (D139).
   */
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
