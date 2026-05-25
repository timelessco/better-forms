import { describe, expect, it } from "vitest";
import { seo } from "@/lib/seo";

type MetaTag = { title?: string; name?: string; property?: string; content?: string };
const findMeta = (tags: ReturnType<typeof seo>, predicate: (t: MetaTag) => boolean) =>
  tags.find(predicate);

describe("seo", () => {
  it("uses passed description in description, og:description, twitter:description", () => {
    const tags = seo({ formTitle: "Survey", description: "Tell us." });
    expect(findMeta(tags, (t) => t.name === "description")?.content).toBe("Tell us.");
    expect(findMeta(tags, (t) => t.property === "og:description")?.content).toBe("Tell us.");
    expect(findMeta(tags, (t) => t.name === "twitter:description")?.content).toBe("Tell us.");
  });

  it("falls back to 'Fill out X' when description is omitted", () => {
    const tags = seo({ formTitle: "Survey" });
    expect(findMeta(tags, (t) => t.name === "description")?.content).toBe("Fill out Survey");
  });

  it("uses passed image for og:image and twitter:image", () => {
    const tags = seo({ formTitle: "Survey", image: "https://x.test/og.png" });
    expect(findMeta(tags, (t) => t.property === "og:image")?.content).toBe("https://x.test/og.png");
    expect(findMeta(tags, (t) => t.name === "twitter:image")?.content).toBe(
      "https://x.test/og.png",
    );
  });

  it("emits robots noindex when noindex is true", () => {
    const tags = seo({ formTitle: "Survey", noindex: true });
    expect(findMeta(tags, (t) => t.name === "robots")?.content).toBe("noindex, nofollow");
  });

  it("does NOT emit robots tag by default", () => {
    const tags = seo({ formTitle: "Survey" });
    expect(findMeta(tags, (t) => t.name === "robots")).toBeUndefined();
  });
});
