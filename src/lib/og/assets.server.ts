import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// In dev/preview cwd is the repo root; in the Vercel function bundle cwd is
// `/var/task` and `public/` ships alongside the bundled handler — both layouts
// resolve `public/fonts/...` correctly from process.cwd().
const readBinary = (relPath: string): Buffer => readFileSync(resolve(process.cwd(), relPath));

let cached: { interRegular: Buffer; interExtraBold: Buffer } | null = null;

export const loadOgAssets = () => {
  if (cached) return cached;
  cached = {
    interRegular: readBinary("public/fonts/inter/Inter-Regular.ttf"),
    interExtraBold: readBinary("public/fonts/inter/Inter-ExtraBold.ttf"),
  };
  return cached;
};
