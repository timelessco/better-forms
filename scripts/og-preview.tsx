/**
 * Renders a handful of OG image variants to `.og-preview/` for visual review
 * without spinning up the dev server. Run with: `bun scripts/og-preview.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderOgImage } from "@/lib/og/render.server";
import { OgCard } from "@/lib/og/template";
import type { OgCardProps } from "@/lib/og/template";

const OUT_DIR = resolve(process.cwd(), ".og-preview");

type Variant = { name: string; props: OgCardProps };

const VARIANTS: Array<Variant> = [
  {
    name: "01-default",
    props: {
      title: "Untitled",
      description: "",
      iconUrl: null,
      themeColorName: null,
    },
  },
  {
    name: "02-short-title",
    props: {
      title: "Customer Feedback",
      description: "Help us improve our product with a quick two-minute survey.",
      iconUrl: null,
      themeColorName: "blue",
    },
  },
  {
    name: "03-long-title",
    props: {
      title:
        "A genuinely very long form title that should trigger render-time clamping behaviour and not break the layout",
      description:
        "And a description that goes on long enough to test the second line of body copy alignment too — should wrap softly without cutting off mid-word.",
      iconUrl: null,
      themeColorName: "rose",
    },
  },
  {
    name: "04-no-description",
    props: {
      title: "Just a title",
      description: "",
      iconUrl: null,
      themeColorName: "emerald",
    },
  },
  {
    name: "05-violet",
    props: {
      title: "Event RSVP",
      description: "Confirm your attendance for the kickoff dinner on Friday.",
      iconUrl: null,
      themeColorName: "violet",
    },
  },
];

const renderToFile = async (variant: Variant): Promise<void> => {
  const image = renderOgImage(<OgCard {...variant.props} />);
  const buf = Buffer.from(await image.arrayBuffer());
  const outPath = resolve(OUT_DIR, `${variant.name}.png`);
  writeFileSync(outPath, buf);
  console.log(`[ok] ${outPath} (${buf.length} bytes)`);
};

const main = async (): Promise<void> => {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const variant of VARIANTS) {
    await renderToFile(variant);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
