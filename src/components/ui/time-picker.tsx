import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export type TimePickerProps = Omit<React.ComponentProps<typeof InputGroupInput>, "type">;

export const TimePicker = ({ className, ...props }: TimePickerProps) => (
  <InputGroup
    variant="borderless"
    className={cn(
      "h-7 form-input pr-[8px] pl-[10px] has-[[aria-invalid=true]]:form-input-error",
      className,
    )}
  >
    <InputGroupAddon align="inline-start" className="ps-0">
      <Clock />
    </InputGroupAddon>
    <InputGroupInput
      type="time"
      className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      {...props}
    />
  </InputGroup>
);
