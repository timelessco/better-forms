import {
  createFormHook,
  createFormHookContexts,
  revalidateLogic,
  useStore,
} from "@tanstack/react-form";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { buttonVariants } from "@/components/ui/button";
import {
  Field as DefaultField,
  FieldError as DefaultFieldError,
  FieldSet as DefaultFieldSet,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field";
import type { fieldVariants } from "@/components/ui/field";
import { Input as InputBase } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PhoneInput as PhoneInputBase } from "@/components/ui/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea as TextareaBase } from "@/components/ui/textarea";
import { TimePicker as TimePickerBase } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

const {
  fieldContext,
  formContext,
  useFieldContext: _useFieldContext,
  useFormContext,
} = createFormHookContexts();

const Form = ({
  children,
  className,
  ref,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"form">, "onSubmit"> & {
  children?: React.ReactNode;
  ref?: React.Ref<HTMLFormElement>;
}) => {
  const form = useFormContext();
  const handleSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
    },
    [form],
  );
  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      className={cn("mx-auto w-full", className)}
      noValidate
      {...props}
    >
      {children}
    </form>
  );
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FieldSet = ({ className, children, ...props }: React.ComponentProps<"fieldset">) => {
  const id = React.useId();
  const itemContextValue = React.useMemo(() => ({ id }), [id]);

  return (
    <FormItemContext.Provider value={itemContextValue}>
      <DefaultFieldSet className={cn("grid", className)} {...props}>
        {children}
      </DefaultFieldSet>
    </FormItemContext.Provider>
  );
};

// Stable selector function to ensure consistent hook calls. `value` is
// intentionally excluded — only the input wrappers need it, and including it
// here would re-render every Field/FieldError on every keystroke.
// eslint-disable-next-line typescript-eslint/no-explicit-any
const fieldStateSelector = (state: any) => ({
  errors: state?.meta?.errors ?? [],
  isTouched: state?.meta?.isTouched ?? false,
});

// eslint-disable-next-line typescript-eslint/no-explicit-any
const fieldValueSelector = (state: any) => state?.value as unknown;

const useFieldContext = () => {
  const { id } = React.use(FormItemContext);

  // Always call _useFieldContext() unconditionally - it's a hook and must be called
  // This hook may conditionally call hooks internally, but we must always call it
  const innerFieldContext = _useFieldContext();

  // Use a ref to maintain a stable store reference across renders
  // This ensures useStore is always called with a consistent reference type
  const storeRef = React.useRef<unknown>(null);

  // Update the ref if we have a store, but always use the ref for useStore
  // This ensures hook order stability even when innerFieldContext changes
  if (innerFieldContext?.store !== undefined) {
    storeRef.current = innerFieldContext.store ?? null;
  }

  // Always call useStore unconditionally to keep hook order stable
  // useStore handles undefined/null store by not subscribing
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  const fieldState = useStore(storeRef.current as any, fieldStateSelector);

  if (!innerFieldContext) {
    throw new Error("useFieldContext should be used within <FormItem>");
  }

  return {
    id,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    errors: fieldState.errors,
    isTouched: fieldState.isTouched,
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    ...innerFieldContext,
  };
};

const useFieldValue = () => {
  const innerFieldContext = _useFieldContext();
  const storeRef = React.useRef<unknown>(null);
  if (innerFieldContext?.store !== undefined) {
    storeRef.current = innerFieldContext.store ?? null;
  }
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  return useStore(storeRef.current as any, fieldValueSelector);
};

const Field = ({
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) => {
  const {
    errors,
    isTouched,
    formItemId,
    formDescriptionId,
    formMessageId,
    handleBlur: markFieldTouched,
  } = useFieldContext();
  const hasVisibleErrors = !!errors.length && isTouched;

  return (
    <DefaultField
      data-invalid={hasVisibleErrors}
      id={formItemId}
      onBlur={markFieldTouched}
      aria-describedby={
        !hasVisibleErrors ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={hasVisibleErrors}
      {...props}
    >
      {children}
    </DefaultField>
  );
};

// Field-bound input wrappers — pull value/onChange/onBlur/aria-invalid from
// `useFieldContext()` so renderers don't have to wire them up by hand. Use
// as `<f.Input />`, `<f.Textarea />`, `<f.PhoneInput />` inside `form.AppField`.

const Input = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputBase>, "value" | "onChange" | "onBlur">) => {
  const field = useFieldContext();
  const value = useFieldValue();
  const hasErrors = field.errors.length > 0 && field.isTouched;
  return (
    <InputBase
      name={field.name}
      value={(value as string | undefined) ?? ""}
      onChange={(e) => field.handleChange(e.target.value as never)}
      onBlur={field.handleBlur}
      aria-invalid={hasErrors}
      className={cn("aria-invalid:form-input-error", className)}
      {...props}
    />
  );
};

const Textarea = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TextareaBase>, "value" | "onChange" | "onBlur">) => {
  const field = useFieldContext();
  const value = useFieldValue();
  const hasErrors = field.errors.length > 0 && field.isTouched;
  return (
    <TextareaBase
      name={field.name}
      value={(value as string | undefined) ?? ""}
      onChange={(e) => field.handleChange(e.target.value as never)}
      onBlur={field.handleBlur}
      aria-invalid={hasErrors}
      className={cn("aria-invalid:form-input-error", className)}
      {...props}
    />
  );
};

const PhoneInput = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PhoneInputBase>, "value" | "onChange" | "onBlur">) => {
  const field = useFieldContext();
  const value = useFieldValue();
  const hasErrors = field.errors.length > 0 && field.isTouched;
  return (
    <PhoneInputBase
      value={(value as string | undefined) ?? ""}
      onChange={(next) => field.handleChange(next as never)}
      onBlur={field.handleBlur}
      aria-invalid={hasErrors}
      className={className}
      {...props}
    />
  );
};

const TimePicker = ({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TimePickerBase>, "value" | "onChange" | "onBlur">) => {
  const field = useFieldContext();
  const value = useFieldValue();
  const hasErrors = field.errors.length > 0 && field.isTouched;
  return (
    <TimePickerBase
      name={field.name}
      value={(value as string | undefined) ?? ""}
      onChange={(e) => field.handleChange(e.target.value as never)}
      onBlur={field.handleBlur}
      aria-invalid={hasErrors}
      className={className}
      {...props}
    />
  );
};

const FieldError = ({ className, ...props }: React.ComponentProps<"p">) => {
  const { errors, isTouched, formMessageId } = useFieldContext();
  const body = errors.length ? String(errors.at(0)?.message ?? "") : "";
  if (!body || !isTouched) return null;
  return (
    <DefaultFieldError
      data-slot="form-message"
      id={formMessageId}
      className={cn("mt-1.5 text-sm text-destructive", className)}
      {...props}
      errors={body ? [{ message: body }] : []}
    />
  );
};

const SubmitButton = ({
  label,
  className,
  size,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    label: string;
  }) => {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button className={className} size={size} type="submit" disabled={isSubmitting} {...props}>
          {isSubmitting && <Spinner />}
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
};

const StepButton = ({
  label,
  handleMovement,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    label: React.ReactNode | string;
    handleMovement: () => void;
  }) => (
  <Button size="sm" variant="ghost" type="button" onClick={handleMovement} {...props}>
    {label}
  </Button>
);

const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Field,
    FieldError,
    FieldSet,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldTitle,
    Input,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    PhoneInput,
    Textarea,
    TimePicker,
  },
  formComponents: {
    SubmitButton,
    StepButton,
    FieldLegend,
    FieldDescription,
    FieldSeparator,
    Form,
  },
});

export { revalidateLogic, useAppForm, useFieldContext, useFormContext, withFieldGroup, withForm };
