const SkeletonBar = ({
  width = "w-full",
  className = "",
}: {
  width?: string;
  className?: string;
}) => <div className={`h-2 rounded-full bg-muted-foreground/20 ${width} ${className}`} />;

export const TextPreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-2.5 px-3">
    <SkeletonBar width="w-full" className="h-[5px]" />
    <SkeletonBar width="w-[90%]" className="h-[5px]" />
    <SkeletonBar width="w-[75%]" className="h-[5px]" />
  </div>
);

export const Heading1Preview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    <div className="font-heading text-lg leading-tight font-bold">Heading 1</div>
    <SkeletonBar width="w-full" className="h-[5px]" />
    <SkeletonBar width="w-[80%]" className="h-[5px]" />
  </div>
);

export const Heading2Preview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    <div className="font-heading text-base leading-tight font-semibold">Heading 2</div>
    <SkeletonBar width="w-full" className="h-[5px]" />
    <SkeletonBar width="w-[85%]" className="h-[5px]" />
  </div>
);

export const Heading3Preview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    <div className="font-heading text-sm leading-tight font-semibold">Heading 3</div>
    <SkeletonBar width="w-full" className="h-[5px]" />
    <SkeletonBar width="w-[70%]" className="h-[5px]" />
  </div>
);

export const BulletedListPreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    {(["w-[85%]", "w-[70%]", "w-[60%]"] as const).map((w) => (
      <div key={w} className="flex items-center gap-2">
        <div className="size-1.5 shrink-0 rounded-full bg-foreground" />
        <SkeletonBar width={w} className="h-[5px]" />
      </div>
    ))}
  </div>
);

export const NumberedListPreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    {[1, 2, 3].map((n) => (
      <div key={n} className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">{n}.</span>
        <SkeletonBar
          width={n === 1 ? "w-[85%]" : n === 2 ? "w-[70%]" : "w-[60%]"}
          className="h-[5px]"
        />
      </div>
    ))}
  </div>
);

const todoItems = [
  { width: "w-[80%]" as const, checked: true },
  { width: "w-[65%]" as const, checked: false },
  { width: "w-[75%]" as const, checked: false },
];

export const TodoListPreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-3 px-3">
    {todoItems.map(({ width, checked }) => (
      <div key={width} className="flex items-center gap-2">
        <div
          className={`size-3 shrink-0 rounded-[3px] border border-input ${checked ? "bg-primary" : ""}`}
        />
        <SkeletonBar width={width} className="h-[5px]" />
      </div>
    ))}
  </div>
);

export const TogglePreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-2.5 px-3">
    <div className="flex items-center gap-1.5">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4.5 2.5L8 6L4.5 9.5" />
      </svg>
      <SkeletonBar width="w-[70%]" className="h-[6px]" />
    </div>
    <div className="pl-5">
      <SkeletonBar width="w-[90%]" className="h-[5px]" />
      <SkeletonBar width="w-[60%]" className="mt-2 h-[5px]" />
    </div>
  </div>
);

export const CodeBlockPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
      <SkeletonBar width="w-[60%]" className="h-[4px] bg-muted-foreground/15" />
      <SkeletonBar width="w-[80%]" className="h-[4px] bg-muted-foreground/15" />
      <SkeletonBar width="w-[45%]" className="h-[4px] bg-muted-foreground/15" />
      <SkeletonBar width="w-[70%]" className="h-[4px] bg-muted-foreground/15" />
    </div>
  </div>
);

export const TablePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <div className="overflow-hidden rounded-sm border">
      {[0, 1, 2].map((row) => (
        <div key={row} className={`flex ${row > 0 ? "border-t" : ""}`}>
          {[0, 1, 2].map((col) => (
            <div key={col} className={`flex-1 px-2 py-1.5 ${col > 0 ? "border-l" : ""}`}>
              <SkeletonBar
                width={row === 0 ? "w-[70%]" : "w-[50%]"}
                className={`h-[4px] ${row === 0 ? "bg-muted-foreground/30" : ""}`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const BlockquotePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <div className="border-l-2 border-foreground/30 pl-4">
      <SkeletonBar width="w-full" className="h-[5px]" />
      <SkeletonBar width="w-[85%]" className="mt-2.5 h-[5px]" />
      <SkeletonBar width="w-[60%]" className="mt-2.5 h-[5px]" />
    </div>
  </div>
);

export const CalloutPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <div className="flex gap-2.5 rounded-sm bg-muted p-3">
      <span className="shrink-0 text-sm">💡</span>
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonBar width="w-full" className="h-[5px]" />
        <SkeletonBar width="w-[75%]" className="h-[5px]" />
      </div>
    </div>
  </div>
);

export const ThreeColumnsPreview = () => (
  <div className="flex h-[130px] items-center gap-0 px-3">
    <div className="flex flex-1 flex-col gap-2 px-2">
      <SkeletonBar width="w-full" className="h-[5px]" />
      <SkeletonBar width="w-[80%]" className="h-[5px]" />
    </div>
    <div className="h-16 w-px shrink-0 bg-border" />
    <div className="flex flex-1 flex-col gap-2 px-2">
      <SkeletonBar width="w-full" className="h-[5px]" />
      <SkeletonBar width="w-[70%]" className="h-[5px]" />
      <SkeletonBar width="w-[50%]" className="h-[5px]" />
    </div>
    <div className="h-16 w-px shrink-0 bg-border" />
    <div className="flex flex-1 flex-col gap-2 px-2">
      <SkeletonBar width="w-full" className="h-[5px]" />
      <SkeletonBar width="w-[60%]" className="h-[5px]" />
    </div>
  </div>
);

export const DateInlinePreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-2.5 px-3">
    <div className="flex flex-wrap items-center gap-1">
      <SkeletonBar width="w-[30%]" className="h-[5px]" />
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          className="text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
        <span className="text-xs text-muted-foreground">Apr 12, 2026</span>
      </span>
      <SkeletonBar width="w-[25%]" className="h-[5px]" />
    </div>
    <SkeletonBar width="w-[90%]" className="h-[5px]" />
  </div>
);

export const NewPagePreview = () => (
  <div className="flex h-[130px] items-center px-3">
    <div className="w-full border-t border-dashed border-muted-foreground/40" />
  </div>
);

export const ThankYouPagePreview = () => (
  <div className="flex h-[130px] flex-col items-center justify-center gap-2 px-3">
    <span className="text-2xl">😊</span>
    <span className="text-sm font-medium">Thank you!</span>
    <SkeletonBar width="w-[50%]" className="h-[5px]" />
  </div>
);

const FormFieldLabel = () => <SkeletonBar width="w-[40%]" className="mb-2 h-[6px]" />;

export const FormTextInputPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center rounded-md border border-input px-2">
      <span className="text-xs text-muted-foreground/60">John Doe</span>
    </div>
  </div>
);

export const FormTextAreaPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-16 items-start rounded-md border border-input px-2 pt-2">
      <span className="text-xs text-muted-foreground/60">Tell us more...</span>
    </div>
  </div>
);

export const FormEmailPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </svg>
      <span className="text-xs text-muted-foreground/60">name@example.com</span>
    </div>
  </div>
);

export const FormPhonePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <span className="text-xs text-muted-foreground/60">+1 (555) 000-0000</span>
    </div>
  </div>
);

export const FormNumberPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 w-24 items-center justify-between rounded-md border border-input px-2">
      <span className="text-xs text-muted-foreground/60">0</span>
      <div className="flex flex-col gap-0.5">
        <svg
          width="8"
          height="8"
          viewBox="0 0 12 12"
          className="text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 8L6 4L10 8" />
        </svg>
        <svg
          width="8"
          height="8"
          viewBox="0 0 12 12"
          className="text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 4L6 8L10 4" />
        </svg>
      </div>
    </div>
  </div>
);

export const FormLinkPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span className="text-xs text-muted-foreground/60">https://</span>
    </div>
  </div>
);

export const FormDatePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
      <span className="text-xs text-muted-foreground/60">MM/DD/YYYY</span>
    </div>
  </div>
);

export const FormTimePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        className="shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span className="text-xs text-muted-foreground/60">HH:MM</span>
    </div>
  </div>
);

export const FormFileUploadPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span className="text-xs text-muted-foreground/60">Drop file here</span>
    </div>
  </div>
);

const checkboxOptions = ["Option A", "Option B", "Option C"] as const;

export const FormCheckboxPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex flex-col gap-2">
      {checkboxOptions.map((label) => (
        <div key={label} className="flex items-center gap-2">
          <div className="size-3 shrink-0 rounded-[3px] border border-input" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

export const FormMultiChoicePreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex flex-col gap-2">
      {checkboxOptions.map((label) => (
        <div key={label} className="flex items-center gap-2">
          <div className="size-3 shrink-0 rounded-full border border-input" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

export const FormMultiSelectPreview = () => (
  <div className="flex h-[130px] flex-col justify-center px-3">
    <FormFieldLabel />
    <div className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2">
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Tag 1</span>
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Tag 2</span>
    </div>
  </div>
);

export const AskAIPreview = () => (
  <div className="flex h-[130px] flex-col justify-center gap-2 px-3">
    <div className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5">
      <svg
        className="size-4 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <title>AI</title>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
      <SkeletonBar width="w-[70%]" className="h-[5px]" />
    </div>
    <div className="flex flex-col gap-1 pl-1">
      <SkeletonBar width="w-[60%]" className="h-[4px]" />
      <SkeletonBar width="w-[50%]" className="h-[4px]" />
      <SkeletonBar width="w-[55%]" className="h-[4px]" />
    </div>
  </div>
);
