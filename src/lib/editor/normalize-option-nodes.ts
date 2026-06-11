import type { TElement, Value } from "platejs";

/** Legacy choice shapes → canonical option items. Dropdown / Multi-select stopped being field
 * types (2026-06): dropdown = multiChoice + showAsDropdown, multi-select = checkbox +
 * showAsDropdown. Runs on every read (editor load + both plate transforms) so stored docs and
 * already-published forms migrate lazily — no DB rewrite. */
export const normalizeOptionNodes = (content: Value): Value => {
  let changed = false;
  const result: TElement[] = [];

  // Group flags (showAsDropdown/randomizeOrder/optionLabel) live on the group's first option node.
  const isGroupStart = () => result[result.length - 1]?.type !== "formOptionItem";

  for (const node of content) {
    if (
      node.type === "formOptionItem" &&
      (node.variant === "dropdown" || node.variant === "multiSelect")
    ) {
      changed = true;
      const first = isGroupStart();
      const { shuffle, ...rest } = node as TElement & { shuffle?: boolean };
      result.push({
        ...rest,
        variant: node.variant === "dropdown" ? "multiChoice" : "checkbox",
        ...(first ? { showAsDropdown: true } : {}),
        // legacy dropdown kept its own `shuffle` key (old context menu); fold into randomizeOrder
        ...(first && shuffle ? { randomizeOrder: true } : {}),
        // dropdown rows had no leading marker; pin "none" (the builder reads optionLabel per row)
        // so migrated rows don't sprout letter badges
        ...(node.variant === "dropdown" && !node.optionLabel ? { optionLabel: "none" } : {}),
      } as TElement);
      continue;
    }

    if (node.type === "formMultiSelectInput") {
      changed = true;
      const opts = ((node.options as string[] | undefined) ?? []).filter((t) => t.trim());
      const texts = opts.length > 0 ? opts : [""];
      const {
        type: _type,
        options: _options,
        children: _children,
        ...rest
      } = node as TElement & { options?: string[] };
      texts.forEach((text, idx) => {
        result.push({
          // id/required/selection limits carry onto the group's first option node
          ...(idx === 0 ? { ...rest, showAsDropdown: true } : {}),
          type: "formOptionItem",
          variant: "checkbox",
          children: [{ text }],
        } as TElement);
      });
      continue;
    }

    result.push(node);
  }

  return changed ? result : content;
};
