import {
  IconAudio,
  IconCalculatedFields,
  IconCheckboxes,
  IconConditionalLogic,
  IconDate,
  IconDivider,
  IconEmail,
  IconEmbedAnything,
  IconFileUpload,
  IconGlobe,
  IconHeading1,
  IconHeading2,
  IconHeading3,
  IconHiddenFields,
  IconImage,
  IconLabel,
  IconLinearScale,
  IconLink,
  IconLongAnswer,
  IconMatrix,
  IconMultipleChoice,
  IconNewPage,
  IconNumber,
  IconPayment,
  IconPhone,
  IconRanking,
  IconRating,
  IconSecurity,
  IconShortAnswer,
  IconSignature,
  IconSparkle,
  IconText,
  IconTime,
  IconVideo,
  IconWallet,
  SmileIcon,
} from "@/components/ui/icons";
import type { TComboboxInputElement } from "platejs";
import { KEYS } from "platejs";
import type { PlateEditor, PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { insertBlock } from "@/components/editor/transforms";
import {
  FormCheckboxPreview,
  FormDatePreview,
  FormEmailPreview,
  FormFileUploadPreview,
  FormLinkPreview,
  FormMatrixPreview,
  FormMultiChoicePreview,
  FormLinearScalePreview,
  FormNumberPreview,
  FormPhonePreview,
  FormRatingPreview,
  FormSignaturePreview,
  FormTextAreaPreview,
  FormTextInputPreview,
  FormTimePreview,
  Heading1Preview,
  Heading2Preview,
  Heading3Preview,
  NewPagePreview,
  TextPreview,
  ThankYouPagePreview,
} from "./slash-preview-mockups";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

type Group = {
  group: string;
  items: {
    icon: ReactNode;
    value: string;
    onSelect: (editor: PlateEditor, value: string) => void;
    className?: string;
    description?: string;
    disabled?: boolean;
    focusEditor?: boolean;
    keywords?: string[];
    label?: string;
  }[];
};

// upsert-insert handler shared by every enabled block item
const insertOnSelect = (editor: PlateEditor, value: string) => {
  insertBlock(editor, value, { upsert: true });
};

// disabled items: not yet implemented, rendered greyed-out and non-interactive
const noop = () => {};

// Order mirrors Figma node 25434:3120 (system-flat → dropdown).
const groups: Group[] = [
  {
    group: "Questions",
    items: [
      {
        description: "Single line text field",
        icon: <IconShortAnswer />,
        keywords: ["form", "input", "text", "field", "question", "short"],
        label: "Short answer",
        value: "formInput",
      },
      {
        description: "Multi-line text field",
        icon: <IconLongAnswer />,
        keywords: ["form", "textarea", "multiline", "long", "paragraph", "description"],
        label: "Long answer",
        value: "formTextarea",
      },
      {
        description: "Single selection radio buttons",
        icon: <IconMultipleChoice />,
        keywords: ["form", "multi", "choice", "radio", "single", "select", "option"],
        label: "Multiple choice",
        value: "formMultiChoice",
      },
      {
        description: "Multiple choice checkboxes",
        icon: <IconCheckboxes />,
        keywords: ["form", "checkbox", "check", "option", "multiple", "select"],
        label: "Checkboxes",
        value: "formCheckbox",
      },
      {
        description: "Numeric input field",
        icon: <IconNumber />,
        keywords: ["form", "number", "numeric", "integer", "amount"],
        label: "Number",
        value: "formNumber",
      },
      {
        description: "Email address field",
        icon: <IconEmail />,
        keywords: ["form", "email", "address", "mail"],
        label: "Email",
        value: "formEmail",
      },
      {
        description: "Phone number field",
        icon: <IconPhone />,
        keywords: ["form", "phone", "telephone", "number", "call", "mobile"],
        label: "Phone number",
        value: "formPhone",
      },
      {
        description: "URL or website link field",
        icon: <IconLink />,
        keywords: ["form", "link", "url", "website", "address", "http", "hyperlink"],
        label: "Link",
        value: "formLink",
      },
      {
        description: "File attachment field",
        icon: <IconFileUpload />,
        keywords: ["form", "file", "upload", "attachment", "document"],
        label: "File upload",
        value: "formFileUpload",
      },
      {
        description: "Date picker field",
        icon: <IconDate />,
        keywords: ["form", "date", "calendar", "day", "month", "year"],
        label: "Date",
        value: "formDate",
      },
      {
        description: "Time picker field",
        icon: <IconTime />,
        keywords: ["form", "time", "clock", "hour", "minute"],
        label: "Time",
        value: "formTime",
      },
      {
        description: "Rate on a linear scale",
        icon: <IconLinearScale />,
        keywords: ["form", "linear", "scale", "slider", "range"],
        label: "Linear scale",
        value: "formLinearScale",
      },
      {
        description: "Grid of rows and columns",
        icon: <IconMatrix />,
        keywords: ["form", "matrix", "grid", "table", "rows", "columns"],
        label: "Matrix",
        value: "formMatrix",
      },
      {
        description: "Star rating field",
        icon: <IconRating />,
        keywords: ["form", "rating", "star", "score", "review"],
        label: "Rating",
        value: "formRating",
      },
      {
        description: "Collect a payment",
        disabled: true,
        icon: <IconPayment />,
        keywords: ["form", "payment", "card", "checkout", "money", "pay"],
        label: "Payment",
        value: "payment",
      },
      {
        description: "Capture a signature",
        icon: <IconSignature />,
        keywords: ["form", "signature", "sign", "draw"],
        label: "Signature",
        value: "formSignature",
      },
      {
        description: "Drag to rank options in order",
        icon: <IconRanking />,
        keywords: ["form", "ranking", "rank", "order", "priority"],
        label: "Ranking",
        value: "formRanking",
      },
      {
        description: "Connect a crypto wallet",
        disabled: true,
        icon: <IconWallet />,
        keywords: ["form", "wallet", "connect", "crypto", "web3"],
        label: "Wallet connect",
        value: "walletConnect",
      },
    ],
  },
  {
    group: "Layout blocks",
    items: [
      {
        description: "Start a new form page",
        icon: <IconNewPage />,
        keywords: ["page", "break"],
        label: "New page",
        value: "pageBreak",
      },
      {
        description: "Add a thank you confirmation",
        icon: <SmileIcon className="size-4" />,
        keywords: ["thankyou", "thank", "confirmation", "completion", "success"],
        label: "'Thank you' page",
        value: "pageBreakThankYou",
      },
      {
        description: "Start writing with plain text",
        icon: <IconText />,
        keywords: ["paragraph", "text"],
        label: "Text",
        value: KEYS.p,
      },
      {
        description: "Big section heading",
        icon: <IconHeading1 />,
        keywords: ["title", "h1"],
        label: "Heading 1",
        value: KEYS.h1,
      },
      {
        description: "Medium section heading",
        icon: <IconHeading2 />,
        keywords: ["subtitle", "h2"],
        label: "Heading 2",
        value: KEYS.h2,
      },
      {
        description: "Small section heading",
        icon: <IconHeading3 />,
        keywords: ["subtitle", "h3"],
        label: "Heading 3",
        value: KEYS.h3,
      },
      {
        description: "Visual divider line",
        disabled: true,
        icon: <IconDivider />,
        keywords: ["divider", "separator", "hr", "rule", "line"],
        label: "Divider",
        value: "divider",
      },
      {
        description: "Form title block",
        disabled: true,
        icon: <IconSparkle />,
        keywords: ["title", "header"],
        label: "Title",
        value: "title",
      },
      {
        description: "Standalone field label",
        disabled: true,
        icon: <IconLabel />,
        keywords: ["label", "tag", "caption"],
        label: "Label",
        value: "label",
      },
    ],
  },
  {
    group: "Embed blocks",
    items: [
      {
        description: "Embed an image",
        icon: <IconImage />,
        keywords: ["image", "picture", "photo", "media"],
        label: "Image",
        value: KEYS.img,
      },
      {
        description: "Embed a video",
        icon: <IconVideo />,
        keywords: ["video", "movie", "media", "clip"],
        label: "Video",
        value: KEYS.video,
      },
      {
        description: "Embed an audio clip",
        icon: <IconAudio />,
        keywords: ["audio", "sound", "music", "media"],
        label: "Audio",
        value: KEYS.audio,
      },
      {
        description: "Embed anything via URL",
        icon: <IconEmbedAnything />,
        keywords: ["embed", "iframe", "url", "link", "anything"],
        label: "Embed Anything",
        value: KEYS.mediaEmbed,
      },
    ],
  },
  {
    group: "Advanced blocks",
    items: [
      {
        description: "Show, hide, require, or branch based on answers",
        icon: <IconConditionalLogic />,
        keywords: [
          "logic",
          "conditional",
          "condition",
          "if",
          "rule",
          "branch",
          "show",
          "hide",
          "jump",
        ],
        label: "Conditional logic",
        value: "logicBlock",
      },
      {
        description: "Compute a value from other answers",
        disabled: true,
        icon: <IconCalculatedFields />,
        keywords: ["calculated", "calculation", "formula", "compute", "math"],
        label: "Calculated fields",
        value: "calculatedFields",
      },
      {
        description: "Store data hidden from respondents",
        disabled: true,
        icon: <IconHiddenFields />,
        keywords: ["hidden", "field", "metadata", "utm", "secret"],
        label: "Hidden fields",
        value: "hiddenFields",
      },
      {
        description: "Protect the form from spam bots",
        disabled: true,
        icon: <IconSecurity />,
        keywords: ["recaptcha", "captcha", "spam", "bot", "security"],
        label: "reCAPTCHA",
        value: "recaptcha",
      },
      {
        description: "Auto-detect the respondent's country",
        disabled: true,
        icon: <IconGlobe />,
        keywords: ["country", "respondent", "location", "geo", "region"],
        label: "Respondent's country",
        value: "respondentCountry",
      },
    ],
  },
].map((group) => ({
  ...group,
  items: group.items.map((item) => ({
    ...item,
    onSelect: item.disabled ? noop : insertOnSelect,
  })),
}));

const previewMap: Record<string, () => ReactNode> = {
  [KEYS.p]: TextPreview,
  [KEYS.h1]: Heading1Preview,
  [KEYS.h2]: Heading2Preview,
  [KEYS.h3]: Heading3Preview,
  pageBreak: NewPagePreview,
  pageBreakThankYou: ThankYouPagePreview,
  formInput: FormTextInputPreview,
  formTextarea: FormTextAreaPreview,
  formEmail: FormEmailPreview,
  formPhone: FormPhonePreview,
  formLink: FormLinkPreview,
  formNumber: FormNumberPreview,
  formDate: FormDatePreview,
  formTime: FormTimePreview,
  formFileUpload: FormFileUploadPreview,
  formCheckbox: FormCheckboxPreview,
  formMultiChoice: FormMultiChoicePreview,
  formLinearScale: FormLinearScalePreview,
  formRating: FormRatingPreview,
  formMatrix: FormMatrixPreview,
  formSignature: FormSignaturePreview,
};

const findItemByValue = (activeValue: string | null) => {
  if (!activeValue) return null;

  for (const group of groups) {
    for (const item of group.items) {
      if (item.value === activeValue) {
        return item;
      }
    }
  }

  return null;
};

export const SlashInputElement = (props: PlateElementProps<TComboboxInputElement>) => {
  const { editor, element } = props;

  const renderPreview = useCallback(({ activeValue }: { activeValue: string | null }) => {
    const item = findItemByValue(activeValue);

    if (!item) return null;

    const PreviewComponent = activeValue ? previewMap[activeValue] : null;

    return (
      <div className="p-3">
        <div className="overflow-hidden rounded-md bg-muted/50">
          {PreviewComponent ? <PreviewComponent /> : <div className="h-[130px]" />}
        </div>
        <div className="mt-2">
          <div className="text-sm font-medium">{item.label ?? item.value}</div>
          <div className="line-clamp-1 text-xs text-muted-foreground">{item.description}</div>
        </div>
      </div>
    );
  }, []);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent preview={renderPreview}>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>

          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>

              {items.map(({ disabled, focusEditor, icon, keywords, label, value, onSelect }) => (
                <InlineComboboxItem
                  key={value}
                  value={value}
                  disabled={disabled}
                  onClick={() => onSelect(editor, value)}
                  label={label}
                  focusEditor={focusEditor}
                  group={group}
                  keywords={keywords}
                >
                  <div className="mr-2">{icon}</div>
                  {label ?? value}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
};
