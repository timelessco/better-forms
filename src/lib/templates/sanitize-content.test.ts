import { expect, it } from "vitest";

import type { LogicBlockNode } from "@/lib/logic/types";
import { classifyUrl, sanitizeTemplateContent } from "./sanitize-content";

const BLOB = "https://abc.public.blob.vercel-storage.com/editor/u1/x.png";
const UNSPLASH = "https://images.unsplash.com/photo-123?w=800";

it("classifies URLs", () => {
  expect(classifyUrl(BLOB)).toBe("blob");
  expect(classifyUrl(UNSPLASH)).toBe("keep");
  expect(classifyUrl("blob:http://localhost/x")).toBe("strip");
  expect(classifyUrl("https://evil.example/x")).toBe("strip");
});

it("copies vercel-blob assets and records them", async () => {
  const content = [
    { type: "formHeader", title: "Hi", icon: BLOB, cover: UNSPLASH, children: [{ text: "" }] },
    { type: "img", url: BLOB, children: [{ text: "" }] },
  ];
  const copied: string[] = [];
  const result = await sanitizeTemplateContent(content, {
    copyAsset: async (u) => {
      copied.push(u);
      return "https://abc.public.blob.vercel-storage.com/templates/t1/new.png";
    },
  });
  expect(copied).toHaveLength(2); // header icon + img url
  expect(result.assetUrls).toHaveLength(2);
  expect((result.content[0] as any).icon).toContain("/templates/t1/");
  expect((result.content[0] as any).cover).toBe(UNSPLASH); // unsplash kept
  expect((result.content[1] as any).url).toContain("/templates/t1/");
});

it("strips blob: and unknown urls and drops media nodes that lose their url", async () => {
  const content = [
    {
      type: "formHeader",
      title: "Hi",
      icon: "blob:http://x/y",
      cover: "https://evil/x",
      children: [{ text: "" }],
    },
    { type: "img", url: "blob:http://x/z", children: [{ text: "" }] },
  ];
  const result = await sanitizeTemplateContent(content, { copyAsset: async () => "unused" });
  expect((result.content[0] as any).icon).toBeNull();
  expect((result.content[0] as any).cover).toBeNull();
  expect(result.content.find((n: any) => n.type === "img")).toBeUndefined(); // dropped
  expect(result.assetUrls).toHaveLength(0);
});

it("strips logic redirect actions", async () => {
  const content = [
    {
      type: "logicBlock",
      actions: [
        { kind: "show", target: "a" },
        { kind: "redirect", url: "https://author/x" },
      ],
      children: [{ text: "" }],
    },
  ];
  const result = await sanitizeTemplateContent(content, { copyAsset: async () => "unused" });
  const block = result.content[0] as any;
  expect(block.actions).toEqual([{ kind: "show", target: "a" }]);
});

// Real LogicBlockNode shape (src/lib/logic/types.ts): actions/elseActions live directly
// on the node, items are flat { kind, ... }. Strip redirects from both keys.
it("strips redirect actions from a real-shaped logicBlock node (incl. elseActions)", async () => {
  const node: LogicBlockNode = {
    type: "logicBlock",
    id: "lb-1",
    when: { combinator: "all", children: [{ source: "email", operator: "isNotEmpty" }] },
    actions: [
      { kind: "show", target: "newsletter" },
      { kind: "redirect", url: "https://author.example/thanks" },
    ],
    elseActions: [
      { kind: "redirect", url: "https://author.example/bye" },
      { kind: "hide", target: "newsletter" },
    ],
    children: [{ text: "" }],
  };
  const result = await sanitizeTemplateContent([node], { copyAsset: async () => "unused" });
  const block = result.content[0] as any;
  expect(block.actions).toEqual([{ kind: "show", target: "newsletter" }]);
  expect(block.elseActions).toEqual([{ kind: "hide", target: "newsletter" }]);
});
