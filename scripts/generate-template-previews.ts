#!/usr/bin/env tsx
/**
 * Generate template preview screenshots (light + dark) using Orca.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-template-previews.ts
 *
 * Uses a dedicated preview route (/templates/:id/preview) with no header/sidebar.
 * Generates both {id}.png (light) and {id}-dark.png (dark) for each template.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const TEMPLATE_IDS = [
  "survey",
  "feedback",
  "eventRsvp",
  "registration",
  "contact",
  "jobApplication",
  "newsletter",
  "bugReport",
  "orderForm",
  "courseEnrollment",
  "leadGen",
];

const PREVIEWS_DIR = join(import.meta.dirname, "..", "public", "template-previews");
const BASE_URL = "http://localhost:3000/templates";

const orcaEval = (expression: string): unknown => {
  const result = execSync(`orca eval --expression "${expression}" --json`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const parsed = JSON.parse(result);
  if (!parsed.ok) throw new Error(`Orca eval failed: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
};

const orcaScreenshot = (): Buffer => {
  const result = execSync(`orca screenshot --json`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const parsed = JSON.parse(result);
  if (!parsed.ok) throw new Error(`Screenshot failed: ${JSON.stringify(parsed.error)}`);
  return Buffer.from(parsed.result.data, "base64");
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForForm = async (): Promise<void> => {
  for (let i = 0; i < 50; i++) {
    const hasForm = orcaEval(
      `document.querySelector('[data-bf-form-container]')?.offsetHeight > 0`,
    );
    if (hasForm) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for form to load");
};

const setTheme = (mode: "light" | "dark"): void => {
  if (mode === "dark") {
    orcaEval(`
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    `);
  } else {
    orcaEval(`
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    `);
  }
};

const generatePreview = async (templateId: string): Promise<void> => {
  orcaEval(`window.location.href = '${BASE_URL}/${templateId}/preview'`);
  await sleep(1500);
  await waitForForm();
  await sleep(300);

  setTheme("light");
  await sleep(200);
  const lightPng = orcaScreenshot();
  writeFileSync(join(PREVIEWS_DIR, `${templateId}.png`), lightPng);
  console.log(`   ✓ ${templateId}.png`);

  setTheme("dark");
  await sleep(200);
  const darkPng = orcaScreenshot();
  writeFileSync(join(PREVIEWS_DIR, `${templateId}-dark.png`), darkPng);
  console.log(`   ✓ ${templateId}-dark.png`);
};

const main = async (): Promise<void> => {
  if (!existsSync(PREVIEWS_DIR)) {
    mkdirSync(PREVIEWS_DIR, { recursive: true });
  }

  console.log("Generating template previews (light + dark)...\n");

  for (const id of TEMPLATE_IDS) {
    console.log(`📸 ${id}`);
    try {
      await generatePreview(id);
    } catch (e) {
      console.error(`   ✗ failed:`, e);
    }
  }

  console.log(`\nDone → ${PREVIEWS_DIR}`);
};

main().catch(console.error);
