import { describe, expect, it } from "vitest";

import { isDeadWeight } from "../../scripts/trim-server-trace.mjs";

/**
 * What `scripts/trim-server-trace.mjs` removes from the build's trace files (D139). The rule
 * decides what is copied into every serverless function of every deployment, so the two halves
 * of it are worth pinning: a file dropped by mistake is an inbox that stops reading documents,
 * and a file kept by mistake is megabytes stored again on each push.
 */
describe("trim-server-trace: what leaves the serverless bundle", () => {
  const dead = (file: string) => isDeadWeight(file) as boolean;

  it("drops the source maps of third-party packages, which Node never opens", () => {
    expect(dead("/app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs.map")).toBe(true);
    expect(dead("/app/node_modules/next/dist/server/whatever.js.map")).toBe(true);
  });

  it("keeps our own maps — they are not what weighs, and they name our files", () => {
    expect(dead("/app/.next/server/chunks/ssr/src_lib_inbox.js.map")).toBe(false);
  });

  it("drops the browser build of the OCR engine", () => {
    for (const variant of ["", "-simd", "-relaxedsimd"]) {
      expect(
        dead(`/app/node_modules/tesseract.js-core/tesseract-core${variant}-lstm.wasm.js`),
      ).toBe(true);
    }
  });

  it("keeps what the Node loader actually reads: the small `.js` and its `.wasm`", () => {
    const core = "/app/node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm";
    expect(dead(`${core}.js`)).toBe(false);
    expect(dead(`${core}.wasm`)).toBe(false);
  });

  it("leaves the model and the rest of the bundle alone", () => {
    expect(dead("/app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).toBe(false);
    expect(dead("/app/node_modules/bmp-js/lib/decoder.js")).toBe(false);
    expect(dead("/app/src/lib/inbox/extract.js")).toBe(false);
  });
});
