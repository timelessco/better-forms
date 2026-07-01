import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EraserIcon } from "@/components/ui/icons";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { SignaturePadRef } from "@/components/ui/signature-pad";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

// Script font stack for the "Sign here" placeholder — no bundled font, falls back across OSes to a
// handwriting face, then generic cursive.
const SIGNATURE_FONT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';

// Themed signature box (Figma: single border, "Sign here" glyph, eraser bottom-left). Drawing is
// delegated to the vendored shadix-ui pad for gap-free strokes; emits a PNG data URL, "" once
// cleared. Stroke color follows the form theme via the canvas `color` (text-foreground).
const SignatureBox = ({
  value,
  onChange,
  invalid,
  ariaLabelledBy,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  ariaLabelledBy?: string;
}) => {
  const padRef = useRef<SignaturePadRef>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));

  return (
    <div
      className={cn(
        "relative h-40 w-full overflow-hidden rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] elevation-sm",
        invalid && "form-input-error",
      )}
    >
      {!hasInk && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-muted-foreground/45 italic select-none"
          style={{ fontFamily: SIGNATURE_FONT }}
        >
          Sign here
        </span>
      )}
      <SignaturePad
        ref={padRef}
        variant="bare"
        size="fill"
        showButtons={false}
        lineWidth={2}
        // Ink follows the theme foreground (canvas reads this computed `color`): dark ink on the
        // light pad in light mode, light ink on the dark pad in dark mode — always contrasting.
        className="size-full text-foreground"
        role="img"
        aria-label="Signature pad"
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid}
        onChange={(v) => {
          setHasInk(Boolean(v));
          onChange(v ?? "");
        }}
      />
      {hasInk && (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Clear signature"
          className="absolute bottom-2 left-2"
          onClick={() => padRef.current?.clear()}
        >
          <EraserIcon />
        </Button>
      )}
    </div>
  );
};

const SignatureField = ({ element, form, name }: FieldRendererProps<"Signature">) => {
  const fieldName = name ?? element.name;
  return (
    <form.AppField name={fieldName}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        return (
          <>
            <SignatureBox
              value={(f.state.value as string | undefined) ?? ""}
              onChange={(v) => f.handleChange(v)}
              invalid={hasErrors}
              ariaLabelledBy={getAriaLabelledBy(element)}
            />
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default SignatureField;
