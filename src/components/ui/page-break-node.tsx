import type { PlateElementProps } from "platejs/react";
import {
  PlateElement,
  useEditorRef,
  useEditorVersion,
  useFocused,
  useReadOnly,
  useSelected,
} from "platejs/react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface PageBreakElementData {
  type: "pageBreak";
  id?: string;
  isThankYouPage: boolean;
  children: [{ text: "" }];
}

export const createPageBreakNode = (
  data: Partial<Omit<PageBreakElementData, "type" | "children">> = {},
): PageBreakElementData => ({
  type: "pageBreak",
  isThankYouPage: data.isThankYouPage ?? false,
  children: [{ text: "" }],
});

export const PageBreakElement = (props: PlateElementProps) => {
  const { element, children } = props;
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const selected = useSelected();
  const focused = useFocused();

  const isThankYouPage = (element.isThankYouPage as boolean) ?? false;

  // Subscribe to every editor change so the displayed page number follows
  // sibling reorders/deletes. findPath returns the live position, but Plate
  // memoizes element components by identity — without this version dep, a
  // pageBreak after a deleted sibling keeps rendering its stale page number.
  useEditorVersion();
  const pageNumber = (() => {
    const path = editor.api.findPath(element);
    if (!path) return 2;

    let count = 2; // Page 1 is before first pageBreak, so this starts at 2
    for (const [, nodePath] of editor.api.nodes({
      at: [],
      match: { type: "pageBreak" },
    })) {
      if (nodePath[0] < path[0]) {
        count++;
      }
    }
    return count;
  })();
  const handleThankYouToggle = (checked: boolean) => {
    const path = editor.api.findPath(element);
    if (!path) return;

    editor.tf.withoutNormalizing(() => {
      if (checked) {
        // Demote any other pageBreak that is currently flagged as thank-you so
        // only this pageBreak ends up as the thank-you page.
        for (const [, nodePath] of editor.api.nodes({
          match: { type: "pageBreak" },
        })) {
          if (nodePath[0] !== path[0]) {
            editor.tf.setNodes({ isThankYouPage: false }, { at: nodePath });
          }
        }
        editor.tf.setNodes({ isThankYouPage: true }, { at: path });
        // The form-blocks-kit normalizer strips any pageBreaks, form fields,
        // and form buttons that follow this thank-you pageBreak.
      } else {
        editor.tf.setNodes({ isThankYouPage: false }, { at: path });
      }
    });
  };

  return (
    <PlateElement {...props} className="clear-both">
      <div
        contentEditable={false}
        role="presentation"
        className={cn(
          "relative my-6 flex items-center justify-center select-none",
          selected && focused && "rounded ring-2 ring-ring ring-offset-2",
        )}
      >
        <div className="flex-1 border-t-2 border-dashed border-muted-foreground/30" />

        <div className="mx-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Page {pageNumber}</span>

          {!((element.hasFormFields as boolean) ?? false) && (
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`thank-you-toggle-${String(element.id || pageNumber)}`}
                className="cursor-pointer text-xs text-muted-foreground"
              >
                'Thank you' page
              </Label>
              <Switch
                id={`thank-you-toggle-${String(element.id || pageNumber)}`}
                aria-label="Thank you page"
                checked={isThankYouPage}
                onCheckedChange={handleThankYouToggle}
                disabled={readOnly}
                onMouseDown={(e) => e.stopPropagation()}
                // The editor canvas is white; the Switch's default `bg-input`
                // unchecked color blends into it. Border gives it an outline
                // matching the visibility level in the settings sidebar.
                className="border-border data-unchecked:bg-muted"
              />
            </div>
          )}
        </div>

        <div className="flex-1 border-t-2 border-dashed border-muted-foreground/30" />
      </div>
      {children}
    </PlateElement>
  );
};
