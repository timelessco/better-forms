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

// Math/Mention/Comment/Suggestion intentionally omitted — runtime EditorKit never wired them (no insertion/toolbar). Their Base kits would drag @platejs/math (katex.min.css), mention, comment, suggestion into the RSC SSR CSS manifest for zero output.
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
