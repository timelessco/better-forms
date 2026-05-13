import { NodeIdPlugin, TrailingBlockPlugin } from "platejs";

import { AIDiffKit } from "@/components/editor/plugins/ai-diff-kit";
import { AIInputKit } from "@/components/editor/plugins/ai-input-kit";
import { AlignKit } from "@/components/editor/plugins/align-kit";
import { AutoformatKit } from "@/components/editor/plugins/autoformat-kit";
import { BasicBlocksKit } from "@/components/editor/plugins/basic-blocks-kit";
import { BasicMarksKit } from "@/components/editor/plugins/basic-marks-kit";
import { BlockMenuKit } from "@/components/editor/plugins/block-menu-kit";
import { BlockPlaceholderKit } from "@/components/editor/plugins/block-placeholder-kit";
import { CalloutKit } from "@/components/editor/plugins/callout-kit";
import { ColumnKit } from "@/components/editor/plugins/column-kit";
import { CursorOverlayKit } from "@/components/editor/plugins/cursor-overlay-kit";
import { DateKit } from "@/components/editor/plugins/date-kit";
import { DndKit } from "@/components/editor/plugins/dnd-kit";
import { EmojiKit } from "@/components/editor/plugins/emoji-kit";
import { ExitBreakKit } from "@/components/editor/plugins/exit-break-kit";
import { FloatingToolbarKit } from "@/components/editor/plugins/floating-toolbar-kit";
import { FontKit } from "@/components/editor/plugins/font-kit";
import { FormBlocksKit, TabGuardPlugin } from "@/components/editor/plugins/form-blocks-kit";
import { FormHeaderKit } from "@/components/editor/plugins/form-header-kit";
import { LineHeightKit } from "@/components/editor/plugins/line-height-kit";
import { LinkKit } from "@/components/editor/plugins/link-kit";
import { ListKit } from "@/components/editor/plugins/list-kit";
import { MarkdownKit } from "@/components/editor/plugins/markdown-kit";
import { MediaKit } from "@/components/editor/plugins/media-kit";
import { SlashKit } from "@/components/editor/plugins/slash-kit";
import { SuggestionKit } from "@/components/editor/plugins/suggestion-kit";
import { TocKit } from "@/components/editor/plugins/toc-kit";
import { ToggleKit } from "@/components/editor/plugins/toggle-kit";

export const EditorKit = [
  // Block-selection gates on element.id — without this, legacy docs fail to drag-select.
  NodeIdPlugin.configure({ options: { normalizeInitialValue: true } }),
  ...FormHeaderKit,
  ...BasicBlocksKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...CalloutKit,
  ...ColumnKit,
  ...FormBlocksKit,
  ...DateKit,
  ...LinkKit,

  ...BasicMarksKit,
  ...FontKit,

  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Tab guard must come after IndentPlugin (ListKit/ToggleKit) to wrap outermost
  TabGuardPlugin,

  ...SuggestionKit,

  ...SlashKit,
  ...AutoformatKit,
  ...CursorOverlayKit,
  ...BlockMenuKit,
  ...DndKit,
  ...EmojiKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  ...MarkdownKit,

  ...BlockPlaceholderKit,
  ...FloatingToolbarKit,

  ...AIInputKit,
  ...AIDiffKit,
];
