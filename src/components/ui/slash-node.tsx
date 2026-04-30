import {
  Code2,
  Columns3Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  LightbulbIcon,
  PilcrowIcon,
  Quote,
  Square,
  Table,
  TextCursorInputIcon,
} from "lucide-react";
import {
  AlignLeftIcon,
  AtSignIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  HashIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PhoneIcon,
  CheckCheckIcon,
  SmileIcon,
  SparklesIcon,
  SquareCheckIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { KEYS } from "platejs";
import type { TComboboxInputElement } from "platejs";
import type { PlateEditor, PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useCallback } from "react";
import type { ReactNode } from "react";

import { triggerAIInput } from "@/components/editor/plugins/ai-input-kit";
import { insertBlock, insertInlineElement } from "@/components/editor/transforms";
import {
  AskAIPreview,
  BlockquotePreview,
  BulletedListPreview,
  CalloutPreview,
  CodeBlockPreview,
  DateInlinePreview,
  FormCheckboxPreview,
  FormDatePreview,
  FormEmailPreview,
  FormFileUploadPreview,
  FormLinkPreview,
  FormMultiChoicePreview,
  FormMultiSelectPreview,
  FormNumberPreview,
  FormPhonePreview,
  FormTextAreaPreview,
  FormTextInputPreview,
  FormTimePreview,
  Heading1Preview,
  Heading2Preview,
  Heading3Preview,
  NewPagePreview,
  NumberedListPreview,
  TablePreview,
  TextPreview,
  ThankYouPagePreview,
  ThreeColumnsPreview,
  TodoListPreview,
  TogglePreview,
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
    focusEditor?: boolean;
    keywords?: string[];
    label?: string;
  }[];
};

const groups: Group[] = [
  {
    group: "AI",
    items: [
      {
        description: "Ask AI to help with your form",
        icon: <SparklesIcon />,
        keywords: ["ai", "generate", "prompt", "ask"],
        label: "Ask AI",
        value: "ai_input",
        onSelect: (editor) => {
          triggerAIInput(editor);
        },
      },
    ],
  },
  {
    group: "Basic blocks",
    items: [
      {
        description: "Start writing with plain text",
        icon: <PilcrowIcon />,
        keywords: ["paragraph"],
        label: "Text",
        value: KEYS.p,
      },
      {
        description: "Big section heading",
        icon: <Heading1Icon />,
        keywords: ["title", "h1"],
        label: "Heading 1",
        value: KEYS.h1,
      },
      {
        description: "Medium section heading",
        icon: <Heading2Icon />,
        keywords: ["subtitle", "h2"],
        label: "Heading 2",
        value: KEYS.h2,
      },
      {
        description: "Small section heading",
        icon: <Heading3Icon />,
        keywords: ["subtitle", "h3"],
        label: "Heading 3",
        value: KEYS.h3,
      },
      {
        description: "Create a simple bulleted list",
        icon: <ListIcon />,
        keywords: ["unordered", "ul", "-"],
        label: "Bulleted list",
        value: KEYS.ul,
      },
      {
        description: "Create a numbered list",
        icon: <ListOrderedIcon />,
        keywords: ["ordered", "ol", "1"],
        label: "Numbered list",
        value: KEYS.ol,
      },
      {
        description: "Track tasks with checkboxes",
        icon: <Square />,
        keywords: ["checklist", "task", "checkbox", "[]"],
        label: "To-do list",
        value: KEYS.listTodo,
      },
      {
        description: "Collapsible content section",
        icon: <ChevronRightIcon />,
        keywords: ["collapsible", "expandable"],
        label: "Toggle",
        value: KEYS.toggle,
      },
      {
        description: "Write and display code",
        icon: <Code2 />,
        keywords: ["```"],
        label: "Code Block",
        value: KEYS.codeBlock,
      },
      {
        description: "Add a table with rows and columns",
        icon: <Table />,
        label: "Table",
        value: KEYS.table,
      },
      {
        description: "Highlight a quote or excerpt",
        icon: <Quote />,
        keywords: ["citation", "blockquote", "quote", ">"],
        label: "Blockquote",
        value: KEYS.blockquote,
      },
      {
        description: "Highlight important information",
        icon: <LightbulbIcon />,
        keywords: ["note"],
        label: "Callout",
        value: KEYS.callout,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
  {
    group: "Advanced blocks",
    items: [
      {
        description: "Split content into three columns",
        icon: <Columns3Icon />,
        label: "3 columns",
        value: "action_three_columns",
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
  {
    group: "Inline",
    items: [
      {
        description: "Insert an inline date",
        focusEditor: true,
        icon: <CalendarIcon />,
        keywords: ["time"],
        label: "Date",
        value: KEYS.date,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertInlineElement(editor, value);
      },
    })),
  },
  {
    group: "Layout blocks",
    items: [
      {
        description: "Start a new form page",
        icon: <FileIcon />,
        keywords: ["page"],
        label: "New page",
        value: "pageBreak",
      },
      {
        description: "Add a thank you confirmation",
        icon: <SmileIcon />,
        keywords: ["thankyou"],
        label: "'Thank you' page",
        value: "pageBreakThankYou",
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
  {
    group: "Form blocks",
    items: [
      {
        description: "Single line text field",
        icon: <TextCursorInputIcon />,
        keywords: ["form", "input", "text", "field", "question"],
        label: "Text Input",
        value: "formInput",
      },
      {
        description: "Multi-line text field",
        icon: <AlignLeftIcon />,
        keywords: ["form", "textarea", "multiline", "long", "paragraph", "description"],
        label: "Text Area",
        value: "formTextarea",
      },
      {
        description: "Email address field",
        icon: <AtSignIcon />,
        keywords: ["form", "email", "address", "mail"],
        label: "Email",
        value: "formEmail",
      },
      {
        description: "Phone number field",
        icon: <PhoneIcon />,
        keywords: ["form", "phone", "telephone", "number", "call", "mobile"],
        label: "Phone number",
        value: "formPhone",
      },
      {
        description: "Numeric input field",
        icon: <HashIcon />,
        keywords: ["form", "number", "numeric", "integer", "amount"],
        label: "Number",
        value: "formNumber",
      },
      {
        description: "URL or website field",
        icon: <LinkIcon />,
        keywords: ["form", "link", "url", "website", "href"],
        label: "Link",
        value: "formLink",
      },
      {
        description: "Date picker field",
        icon: <CalendarIcon />,
        keywords: ["form", "date", "calendar", "day", "month", "year"],
        label: "Date",
        value: "formDate",
      },
      {
        description: "Time picker field",
        icon: <ClockIcon />,
        keywords: ["form", "time", "clock", "hour", "minute"],
        label: "Time",
        value: "formTime",
      },
      {
        description: "File attachment field",
        icon: <UploadIcon />,
        keywords: ["form", "file", "upload", "attachment", "document"],
        label: "File upload",
        value: "formFileUpload",
      },
      {
        description: "Multiple choice checkboxes",
        icon: <SquareCheckIcon />,
        keywords: ["form", "checkbox", "check", "option", "multiple", "select"],
        label: "Checkbox",
        value: "formCheckbox",
      },
      {
        description: "Single selection radio buttons",
        icon: <SquareCheckIcon />,
        keywords: ["form", "multi", "choice", "radio", "single", "select", "option"],
        label: "Multi Choice",
        value: "formMultiChoice",
      },
      {
        description: "Multiple selection dropdown",
        icon: <CheckCheckIcon />,
        keywords: ["form", "multi", "select", "dropdown", "tag", "option"],
        label: "Multi Select",
        value: "formMultiSelect",
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value, { upsert: true });
      },
    })),
  },
];

const previewMap: Record<string, () => ReactNode> = {
  ai_input: AskAIPreview,
  [KEYS.p]: TextPreview,
  [KEYS.h1]: Heading1Preview,
  [KEYS.h2]: Heading2Preview,
  [KEYS.h3]: Heading3Preview,
  [KEYS.ul]: BulletedListPreview,
  [KEYS.ol]: NumberedListPreview,
  [KEYS.listTodo]: TodoListPreview,
  [KEYS.toggle]: TogglePreview,
  [KEYS.codeBlock]: CodeBlockPreview,
  [KEYS.table]: TablePreview,
  [KEYS.blockquote]: BlockquotePreview,
  [KEYS.callout]: CalloutPreview,
  action_three_columns: ThreeColumnsPreview,
  [KEYS.date]: DateInlinePreview,
  pageBreak: NewPagePreview,
  pageBreakThankYou: ThankYouPagePreview,
  formInput: FormTextInputPreview,
  formTextarea: FormTextAreaPreview,
  formEmail: FormEmailPreview,
  formPhone: FormPhonePreview,
  formNumber: FormNumberPreview,
  formLink: FormLinkPreview,
  formDate: FormDatePreview,
  formTime: FormTimePreview,
  formFileUpload: FormFileUploadPreview,
  formCheckbox: FormCheckboxPreview,
  formMultiChoice: FormMultiChoicePreview,
  formMultiSelect: FormMultiSelectPreview,
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

              {items.map(({ focusEditor, icon, keywords, label, value, onSelect }) => (
                <InlineComboboxItem
                  key={value}
                  value={value}
                  onClick={() => onSelect(editor, value)}
                  label={label}
                  focusEditor={focusEditor}
                  group={group}
                  keywords={keywords}
                >
                  <div className="mr-2 text-muted-foreground">{icon}</div>
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
