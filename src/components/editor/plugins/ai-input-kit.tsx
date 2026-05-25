import { AIPlugin } from "@platejs/ai/react";

import { AIInputPlugin } from "@/components/editor/plugins/ai-input-base";
import { AIInputOverlay } from "@/components/ui/ai-input-node";

export {
  AIInputPlugin,
  hideAIInput,
  toggleAIInput,
  triggerAIInput,
} from "@/components/editor/plugins/ai-input-base";
export type { AIInputState } from "@/components/editor/plugins/ai-input-base";

const AIInputUIPlugin = AIInputPlugin.configure({
  render: {
    afterEditable: AIInputOverlay,
  },
});

export const AIInputKit = [AIPlugin, AIInputUIPlugin];
