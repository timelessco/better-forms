import type { TElement } from "platejs";
import { PathApi } from "platejs";
import { createPlatePlugin } from "platejs/react";
import type { PlateElementProps } from "platejs/react";
import { FormButtonElement } from "@/components/ui/form-button-node";
import { FormFieldElement } from "@/components/ui/form-field-node";
import { FormLabelElement } from "@/components/ui/form-label-node";
import { FormTextareaElement } from "@/components/ui/form-textarea-node";
import { LogicBlockElement } from "@/components/ui/logic-block-node";
import { PageBreakElement } from "@/components/ui/page-break-node";
import { FormFileUploadElement } from "@/components/ui/form-file-upload-node";
import { FormLinearScaleElement } from "@/components/ui/form-linear-scale-node";
import { FormMatrixElement } from "@/components/ui/form-matrix-node";
import { FormRatingElement } from "@/components/ui/form-rating-node";
import { FormSignatureElement } from "@/components/ui/form-signature-node";
import { FormOptionItemElement } from "@/components/ui/form-option-item-node";
import {
  handleBackspace,
  handleFormFieldEnter,
} from "@/components/editor/plugins/form-blocks-handlers";
import {
  extendFormButtonEditor,
  formButtonOnChange,
} from "@/components/editor/plugins/form-blocks-normalizer";
import {
  findNextFocusTarget,
  findPrevFocusTarget,
  goToFocusTarget,
  insertParagraphAfterPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";

type FormFieldPluginConfig = {
  component: React.FunctionComponent<PlateElementProps>;
  gutterPosition?: "center" | "top";
  isVoid?: boolean;
  isSelectable?: boolean;
};

// Every form-field plugin has the same shape: an element node (optionally void/selectable) with a
// gutter position and the shared backspace handler. Factory + config table replaces ~14 copies.
const createFormFieldPlugin = (
  key: string,
  { component, gutterPosition, isVoid, isSelectable }: FormFieldPluginConfig,
) =>
  createPlatePlugin({
    key,
    node: {
      isElement: true,
      ...(isVoid ? { isVoid: true } : {}),
      ...(isSelectable !== undefined ? { isSelectable } : {}),
      component,
    },
    ...(gutterPosition ? { options: { gutterPosition } } : {}),
    handlers: {
      onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
    },
  });

const FormLabelPlugin = createFormFieldPlugin("formLabel", {
  component: FormLabelElement,
  gutterPosition: "center",
});
const FormInputPlugin = createFormFieldPlugin("formInput", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormTextareaPlugin = createFormFieldPlugin("formTextarea", {
  component: FormTextareaElement,
  gutterPosition: "top",
});
const FormEmailPlugin = createFormFieldPlugin("formEmail", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormPhonePlugin = createFormFieldPlugin("formPhone", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormNumberPlugin = createFormFieldPlugin("formNumber", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormLinkPlugin = createFormFieldPlugin("formLink", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormDatePlugin = createFormFieldPlugin("formDate", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormTimePlugin = createFormFieldPlugin("formTime", {
  component: FormFieldElement,
  gutterPosition: "center",
});
const FormFileUploadPlugin = createFormFieldPlugin("formFileUpload", {
  component: FormFileUploadElement,
  gutterPosition: "top",
  isVoid: true,
});
const FormLinearScalePlugin = createFormFieldPlugin("formLinearScale", {
  component: FormLinearScaleElement,
  gutterPosition: "center",
  isVoid: true,
});
const FormRatingPlugin = createFormFieldPlugin("formRating", {
  component: FormRatingElement,
  gutterPosition: "center",
  isVoid: true,
});
const FormMatrixPlugin = createFormFieldPlugin("formMatrix", {
  component: FormMatrixElement,
  gutterPosition: "center",
  isVoid: true,
});
const FormSignaturePlugin = createFormFieldPlugin("formSignature", {
  component: FormSignatureElement,
  gutterPosition: "center",
  isVoid: true,
});
const PageBreakPlugin = createFormFieldPlugin("pageBreak", {
  component: PageBreakElement,
  isVoid: true,
  isSelectable: true,
});
const LogicBlockPlugin = createFormFieldPlugin("logicBlock", {
  component: LogicBlockElement,
  isVoid: true,
  isSelectable: true,
});

export const FormButtonPlugin = createPlatePlugin({
  key: "formButton",
  node: {
    isElement: true,
    isVoid: true,
    isSelectable: false,
    component: FormButtonElement,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
    onChange: ({ editor }) => formButtonOnChange(editor),
  },
  extendEditor: extendFormButtonEditor,
});

export const FormOptionItemPlugin = createFormFieldPlugin("formOptionItem", {
  component: FormOptionItemElement,
  gutterPosition: "center",
}).overrideEditor(({ editor, tf: { insertBreak } }) => ({
  transforms: {
    insertBreak: () => {
      const block = editor.api.block();
      if (block && block[0].type === "formOptionItem") {
        const [node, path] = block;

        // Empty option → convert to paragraph (exit list). Enter twice escapes option group to add a field.
        if (editor.api.isEmpty(node)) {
          editor.tf.setNodes({ type: "p", variant: undefined } as unknown as Partial<TElement>, {
            at: path,
          });
          return;
        }

        const nextPath = PathApi.next(path);
        editor.tf.insertNodes(
          {
            type: "formOptionItem",
            variant: node.variant || "checkbox",
            // Inherit the group's label style (letters/numbers/none) — else a new option reverts to
            // the "letters" default and mismatches siblings the user switched to "off".
            ...(node.optionLabel ? { optionLabel: node.optionLabel } : {}),
            children: [{ text: "" }],
          } as TElement,
          { at: nextPath },
        );
        moveToPath(editor, nextPath);
        return;
      }
      insertBreak();
    },
  },
}));

// Global Tab/Shift+Tab nav (skips buttons, page-breaks, header) + Enter-on-form-field (inserts paragraph, doesn't split label; formOptionItem handled by its own insertBreak).
const NavigationPlugin = createPlatePlugin({
  key: "navigation",
  priority: 1000, // Runs before IndentPlugin's Tab handler
  handlers: {
    onKeyDown: ({ editor, event }) => {
      if (handleFormFieldEnter(editor, event)) return;

      const isLogicBlockNavigation =
        event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp";
      if (!isLogicBlockNavigation) return;

      const block = editor.api.block();
      if (!block) return;
      const [node, path] = block;
      const isLogicBlock = node.type === "logicBlock";
      if (!isLogicBlock && event.key !== "Tab") return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const goPrev = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
      // Focus targets INCLUDE form buttons now (editable label) — Tab from the last field lands on
      // the page's button(s) before crossing to the next page; goToFocusTarget focuses a button's
      // native input or a field's Slate caret (matrix void → first/last input).
      const target = goPrev
        ? findPrevFocusTarget(editor, path[0])
        : findNextFocusTarget(editor, path[0]);

      if (target) {
        goToFocusTarget(editor, target, goPrev);
        return;
      }

      if (isLogicBlock && !goPrev) {
        const at = insertParagraphAfterPath(editor, path);
        setTimeout(() => {
          editor.tf.select({ offset: 0, path: [...at, 0] });
          editor.tf.focus();
        }, 0);
      }
    },
  },
});

// Register AFTER IndentPlugin (ListKit/ToggleKit) so this tab override wraps outermost and short-circuits before indent.
export const TabGuardPlugin = createPlatePlugin({
  key: "tabGuard",
}).overrideEditor(({ editor, tf: { tab } }) => ({
  transforms: {
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    tab: (options: any) => {
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const event = (editor as any).dom?.currentKeyboardEvent;

      if (event?.defaultPrevented) return;

      return tab(options);
    },
  },
}));

export const FormBlocksKit = [
  NavigationPlugin,
  FormLabelPlugin,
  FormInputPlugin,
  FormButtonPlugin,
  FormTextareaPlugin,
  FormEmailPlugin,
  FormPhonePlugin,
  FormNumberPlugin,
  FormLinkPlugin,
  FormDatePlugin,
  FormTimePlugin,
  FormFileUploadPlugin,
  FormLinearScalePlugin,
  FormRatingPlugin,
  FormMatrixPlugin,
  FormSignaturePlugin,
  FormOptionItemPlugin,
  PageBreakPlugin,
  LogicBlockPlugin,
];
