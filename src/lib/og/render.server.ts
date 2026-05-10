import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ImageResponse } from "@takumi-rs/image-response";
import type { ReactElement } from "react";
import { loadOgAssets } from "@/lib/og/assets.server";

// Force WASM mode by passing a `module` to the renderer. The native
// `@takumi-rs/core` napi binding requires platform-specific `.node` files
// that Vercel's function bundler is unreliable about including; the WASM
// build ships a single platform-agnostic `.wasm` asset that nft + Nitro's
// SSR-external trace pick up cleanly because it sits next to the JS entry
// inside `node_modules/@takumi-rs/wasm/pkg/`.
const WASM_SUBPATH = "@takumi-rs/wasm/takumi_wasm_bg.wasm";

let cachedWasmBytes: Uint8Array | null = null;
const loadTakumiWasm = (): Uint8Array => {
  if (cachedWasmBytes) return cachedWasmBytes;
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve(WASM_SUBPATH);
  cachedWasmBytes = readFileSync(wasmPath);
  return cachedWasmBytes;
};

export type OgRenderInit = Pick<ResponseInit, "headers" | "status" | "statusText">;

/**
 * Build a takumi-rendered PNG response for the given React tree at 1200x630.
 * Mirrors @vercel/og's `ImageResponse` shape — returns a `Response`-extending
 * object that can be returned directly from a server handler.
 */
export const renderOgImage = (tree: ReactElement, init?: OgRenderInit): ImageResponse => {
  const assets = loadOgAssets();
  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    format: "png",
    module: loadTakumiWasm(),
    fonts: [
      { name: "Inter", data: assets.interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: assets.interExtraBold, weight: 800, style: "normal" },
    ],
    ...init,
  });
};
