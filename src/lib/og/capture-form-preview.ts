import { domToPng } from "modern-screenshot";
import { getFormListings } from "@/collections";
import { uploadFormPreview } from "@/lib/server-fn/form-preview";

// OG / card thumbnail target. 1.91:1 (the OG standard); the dashboard card object-covers it.
const OUT_WIDTH = 1200;
const OUT_HEIGHT = 630;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Captures the live editor canvas (`[data-form-canvas]`) to a 1200×630 PNG data URL, fitting the
 * form to width and top-cropping. Returns null if the canvas isn't mounted. Best-effort — callers
 * must not fail publish on a null/throw.
 */
export const captureFormCanvas = async (): Promise<string | null> => {
  const node = document.querySelector<HTMLElement>("[data-form-canvas]");
  if (!node || node.offsetWidth === 0) return null;

  // Wait for web fonts so text isn't snapshotted in a fallback face.
  try {
    await document.fonts?.ready;
  } catch {
    // fonts API unavailable — proceed
  }

  // modern-screenshot paints the ROOT node's background via this option, so a hardcoded white
  // would drop the form's theme tint. Use the canvas's own computed background.
  const themeBg = getComputedStyle(node).backgroundColor || "#ffffff";

  // High-DPI source render, then crop deterministically into the OG frame.
  const dataUrl = await domToPng(node, { backgroundColor: themeBg, scale: 2 });
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = OUT_WIDTH;
  canvas.height = OUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Fill below-the-form area with the theme tint too (not white) for shorter forms.
  ctx.fillStyle = themeBg;
  ctx.fillRect(0, 0, OUT_WIDTH, OUT_HEIGHT);

  // Fit to width, top-align; overflow below 630 is cropped, shorter forms keep white below.
  const ratio = OUT_WIDTH / img.width;
  ctx.drawImage(img, 0, 0, OUT_WIDTH, img.height * ratio);

  return canvas.toDataURL("image/png");
};

/**
 * Captures the editor canvas and persists it as the form's content thumbnail, then refreshes the
 * dashboard listing so the new card preview shows. Best-effort — no-ops if capture yields nothing.
 * Dynamically imported from the publish flow so the browser-only capture lib never enters SSR.
 */
export const captureAndUploadFormPreview = async (formId: string): Promise<void> => {
  const png = await captureFormCanvas();
  if (!png) return;
  await uploadFormPreview({
    data: { formId, contentHash: String(Date.now()), pngBase64: png },
  });
  void getFormListings().utils.refetch();
};
