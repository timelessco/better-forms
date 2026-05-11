import { suggestionPlugin as basePlugin } from "@/components/editor/plugins/suggestion-plugin";
import { SuggestionLeaf, SuggestionLineBreak } from "@/components/ui/suggestion-node";

export { suggestionPlugin } from "@/components/editor/plugins/suggestion-plugin";
export type { SuggestionConfig } from "@/components/editor/plugins/suggestion-plugin";

const suggestionPluginWithUI = basePlugin.configure({
  render: {
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    belowNodes: SuggestionLineBreak as any,
    node: SuggestionLeaf,
  },
});

export const SuggestionKit = [suggestionPluginWithUI];
