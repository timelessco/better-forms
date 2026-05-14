import { BaseAlignKit } from "./plugins/align-base-kit";
import { BaseBasicBlocksKit } from "./plugins/basic-blocks-base-kit";
import { BaseBasicMarksKit } from "./plugins/basic-marks-base-kit";
import { BaseCalloutKit } from "./plugins/callout-base-kit";
import { BaseColumnKit } from "./plugins/column-base-kit";
import { BaseDateKit } from "./plugins/date-base-kit";
import { BaseFontKit } from "./plugins/font-base-kit";
import { BaseLineHeightKit } from "./plugins/line-height-base-kit";
import { BaseLinkKit } from "./plugins/link-base-kit";
import { BaseListKit } from "./plugins/list-base-kit";
import { MarkdownKit } from "./plugins/markdown-kit";
import { BaseMediaKit } from "./plugins/media-base-kit";
import { BaseTocKit } from "./plugins/toc-base-kit";
import { BaseToggleKit } from "./plugins/toggle-base-kit";

// Math, Mention, Comment, Suggestion are intentionally omitted. The runtime
// EditorKit never included MathKit/MentionKit/CommentKit (no insertion path
// or toolbar wired), and SuggestionKit had no entry point either. Pulling
// their Base counterparts would drag @platejs/math (→ katex.min.css side-
// effect), @platejs/mention, @platejs/comment, and @platejs/suggestion into
// the public-form RSC's SSR CSS manifest for zero rendered output.
export const BaseEditorKit = [
  ...BaseBasicBlocksKit,
  ...BaseToggleKit,
  ...BaseTocKit,
  ...BaseMediaKit,
  ...BaseCalloutKit,
  ...BaseColumnKit,
  ...BaseDateKit,
  ...BaseLinkKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseListKit,
  ...BaseAlignKit,
  ...BaseLineHeightKit,
  ...MarkdownKit,
];
