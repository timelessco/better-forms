import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";

import { MentionElement, MentionInputElement } from "@/components/ui/mention-node";

// `@` opens a field picker (see mention-node). Insert-only — no space appended, so a token
// can sit mid-sentence ("hi , @Name , ...").
export const MentionKit = [
  MentionPlugin.configure({ options: { insertSpaceAfterMention: false } }).withComponent(
    MentionElement,
  ),
  MentionInputPlugin.withComponent(MentionInputElement),
];
