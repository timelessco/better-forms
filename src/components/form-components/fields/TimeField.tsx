import {
  TimePicker,
  TimePickerContent,
  TimePickerHour,
  TimePickerInput,
  TimePickerInputGroup,
  TimePickerMinute,
  TimePickerPeriod,
  TimePickerSeparator,
  TimePickerTrigger,
} from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "./shared";
import type { FieldRendererProps } from "./shared";

const TimeField = ({ element, form }: FieldRendererProps<"Time">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      const errorMessage = hasErrors ? extractErrorMessage(f.state.meta.errors[0]) : "";
      return (
        <>
          <TimePicker
            name={element.name}
            value={(f.state.value as string | undefined) ?? "00:00"}
            onValueChange={(v) => f.handleChange(v)}
            locale="en-US"
            invalid={hasErrors}
          >
            <TimePickerInputGroup
              className={cn("h-7 form-input px-[10px]", hasErrors && "form-input-error")}
              onBlur={f.handleBlur}
            >
              <TimePickerInput segment="hour" className="text-sm" />
              <TimePickerSeparator />
              <TimePickerInput segment="minute" className="text-sm" />
              <TimePickerInput segment="period" className="ml-1 text-sm" />
              <TimePickerTrigger />
            </TimePickerInputGroup>
            <TimePickerContent>
              <TimePickerHour />
              <TimePickerMinute />
              <TimePickerPeriod />
            </TimePickerContent>
          </TimePicker>
          {hasErrors && <p className="text-sm text-destructive">{errorMessage}</p>}
        </>
      );
    }}
  </form.AppField>
);

export default TimeField;
