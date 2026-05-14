import {
  Columns3Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  PilcrowIcon,
  QuoteIcon,
  SquareIcon,
} from "lucide-react";
import { ChevronRightIcon, ListIcon, ListOrderedIcon } from "@/components/ui/icons";
import type { TElement } from "platejs";
import { KEYS } from "platejs";
import { useEditorRef, useSelectionFragmentProp } from "platejs/react";
import * as React from "react";
import { getBlockType, setBlockType } from "@/components/editor/transforms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ToolbarButton, ToolbarMenuGroup } from "./toolbar";

export const turnIntoItems = [
  {
    icon: <PilcrowIcon />,
    keywords: ["paragraph"],
    label: "Text",
    value: KEYS.p,
  },
  {
    icon: <Heading1Icon />,
    keywords: ["title", "h1"],
    label: "Heading 1",
    value: "h1",
  },
  {
    icon: <Heading2Icon />,
    keywords: ["subtitle", "h2"],
    label: "Heading 2",
    value: "h2",
  },
  {
    icon: <Heading3Icon />,
    keywords: ["subtitle", "h3"],
    label: "Heading 3",
    value: "h3",
  },
  {
    icon: <Heading4Icon />,
    keywords: ["subtitle", "h4"],
    label: "Heading 4",
    value: "h4",
  },
  {
    icon: <Heading5Icon />,
    keywords: ["subtitle", "h5"],
    label: "Heading 5",
    value: "h5",
  },
  {
    icon: <Heading6Icon />,
    keywords: ["subtitle", "h6"],
    label: "Heading 6",
    value: "h6",
  },
  {
    icon: <ListIcon />,
    keywords: ["unordered", "ul", "-"],
    label: "Bulleted list",
    value: KEYS.ul,
  },
  {
    icon: <ListOrderedIcon />,
    keywords: ["ordered", "ol", "1"],
    label: "Numbered list",
    value: KEYS.ol,
  },
  {
    icon: <SquareIcon />,
    keywords: ["checklist", "task", "checkbox", "[]"],
    label: "To-do list",
    value: KEYS.listTodo,
  },
  {
    icon: <ChevronRightIcon />,
    keywords: ["collapsible", "expandable"],
    label: "Toggle list",
    value: KEYS.toggle,
  },
  {
    icon: <QuoteIcon />,
    keywords: ["citation", "blockquote", ">"],
    label: "Quote",
    value: KEYS.blockquote,
  },
  {
    icon: <Columns3Icon />,
    label: "3 columns",
    value: "action_three_columns",
  },
];

export const TurnIntoToolbarButton = (props: React.ComponentProps<typeof DropdownMenu>) => {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const value = useSelectionFragmentProp({
    defaultValue: KEYS.p,
    getProp: (node) => getBlockType(node as TElement),
  });
  const selectedItem = React.useMemo(
    () => turnIntoItems.find((item) => item.value === (value ?? KEYS.p)) ?? turnIntoItems[0],
    [value],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger
        render={
          <ToolbarButton className="min-w-[125px]" pressed={open} tooltip="Turn into" isDropdown />
        }
      >
        {selectedItem.label}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="ignore-click-outside/toolbar min-w-0" align="start">
        <ToolbarMenuGroup
          value={value}
          onValueChange={(type) => {
            setBlockType(editor, type);
          }}
          label="Turn into"
        >
          {turnIntoItems.map(({ icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem key={itemValue} className="min-w-[180px] pl-2" value={itemValue}>
              {icon}
              {label}
            </DropdownMenuRadioItem>
          ))}
        </ToolbarMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
