import { getMentionOnSelectItem } from "@platejs/mention";
import type { TComboboxInputElement, TMentionElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useReadOnly, useSelected } from "platejs/react";

import { getMentionableFields } from "@/components/editor/plugins/mention-fields";
import { HelpCircleIcon, MoreHorizontalIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

// `key` carries the stable field name; `value` the display label (rename-tolerant lookups
// happen at resolution time — the pill shows the label captured at insert).
export const MentionElement = (props: PlateElementProps<TMentionElement>) => {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();

  return (
    <PlateElement
      {...props}
      className={cn(
        // Neutral grey via foreground tokens so it auto-inverts: dark text on light grey (light
        // mode) ↔ light text on subtle grey (dark mode). Avoids the form's --primary brand color.
        "inline-block rounded-md bg-foreground/10 px-1.5 py-0.5 align-baseline text-sm font-medium text-foreground",
        !readOnly && "cursor-pointer",
        selected && focused && "ring-2 ring-ring",
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        "data-slate-value": element.value,
      }}
    >
      {props.children}@{element.value}
    </PlateElement>
  );
};

const onSelectItem = getMentionOnSelectItem();

export const MentionInputElement = (props: PlateElementProps<TComboboxInputElement>) => {
  const { editor, element } = props;
  const fields = getMentionableFields(editor, element);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="@">
        <span className="inline-block rounded-md bg-foreground/10 px-1.5 py-0.5 align-baseline text-sm text-foreground">
          <InlineComboboxInput />
        </span>

        <InlineComboboxContent>
          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Mention an input field</InlineComboboxGroupLabel>

            <InlineComboboxEmpty>No fields above to reference</InlineComboboxEmpty>

            {fields.map((item) => (
              <InlineComboboxItem
                key={item.key}
                className="gap-2"
                value={item.text}
                keywords={[item.key]}
                onClick={() => onSelectItem(editor, item, "")}
              >
                <MoreHorizontalIcon className="text-muted-foreground" />
                {item.text}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>

          {/* Non-interactive footer (combobox keyboard nav skips plain children). */}
          <div className="mt-1 flex items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
            <HelpCircleIcon className="size-4 shrink-0" />
            Learn about mentions
          </div>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
};
