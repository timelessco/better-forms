/* eslint-disable eslint/func-style, eslint-plugin-react/jsx-no-constructed-context-values */
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Search } from "lucide-react";
import { createContext, use, useMemo, useState } from "react";
import * as BasePhoneInput from "react-phone-number-input";

import { useMounted } from "@/hooks/use-mounted";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { ChevronDownIcon } from "@/components/ui/icons";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";

const getBrowserDefaultCountry = (): BasePhoneInput.Country | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const region = navigator.language.split(/[-_]/)[1]?.toUpperCase();
  return region && BasePhoneInput.isSupportedCountry(region) ? region : undefined;
};

type PhoneInputSize = "sm" | "default" | "lg";

const PhoneInputContext = createContext<{
  variant: PhoneInputSize;
  popupClassName?: string;
  scrollAreaClassName?: string;
}>({
  variant: "default",
  popupClassName: undefined,
  scrollAreaClassName: undefined,
});

type PhoneInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref"> &
  Omit<
    BasePhoneInput.Props<typeof BasePhoneInput.default>,
    "onChange" | "variant" | "popupClassName" | "scrollAreaClassName"
  > & {
    onChange?: (value: BasePhoneInput.Value) => void;
    variant?: PhoneInputSize;
    popupClassName?: string;
    scrollAreaClassName?: string;
  };

function PhoneInput({
  className,
  variant,
  popupClassName,
  scrollAreaClassName,
  onChange,
  value,
  defaultCountry: defaultCountryProp,
  ...props
}: PhoneInputProps) {
  const phoneInputSize = variant || "default";
  // react-phone-number-input reads defaultCountry once on mount; wait for hydration to derive
  // from navigator.language, then key the component to remount with the resolved value.
  const mounted = useMounted();
  const defaultCountry = defaultCountryProp ?? (mounted ? getBrowserDefaultCountry() : undefined);
  return (
    <PhoneInputContext.Provider
      value={{ variant: phoneInputSize, popupClassName, scrollAreaClassName }}
    >
      <BasePhoneInput.default
        key={defaultCountry ?? "no-default"}
        // Wrapper owns the visual surface (drop-shadow in light, bg contrast in dark; no borders);
        // both inner pieces stay transparent. Surface uses --form-input-bg (same as form-input util)
        // for theme consistency. [&]: bumps specificity past react-phone-number-input's defaults.
        className={cn(
          // min-h (not fixed h): the inner pieces carry the themed --bf-input-height (via
          // [data-bf-input-fill]); the wrapper hugs them so a customized input height grows the
          // surface instead of overflowing it (overflow-hidden was clipping the text — #broken).
          "flex flex-row items-stretch overflow-hidden rounded-lg text-foreground elevation-sm dark:shadow-none [&]:bg-[var(--form-input-bg,var(--color-gray-50))]",
          phoneInputSize === "sm" && "[&]:min-h-7",
          phoneInputSize === "lg" && "[&]:min-h-9",
          phoneInputSize === "default" && "[&]:min-h-8",
          props["aria-invalid"] &&
            "**:data-[slot=input-group]:ring-1 **:data-[slot=input-group]:ring-destructive",
          className,
        )}
        countrySelectComponent={CountrySelect}
        inputComponent={InputComponent}
        smartCaret={false}
        value={value || undefined}
        defaultCountry={defaultCountry}
        onChange={(next) => onChange?.(next || ("" as BasePhoneInput.Value))}
        {...props}
      />
    </PhoneInputContext.Provider>
  );
}

function InputComponent({ className, ...props }: React.ComponentProps<"input">) {
  const { variant } = use(PhoneInputContext);

  return (
    <InputGroupInput
      data-bf-input-fill
      className={cn(
        // Right "input-text" piece: bordered in light for the seam, transparent in dark (bg
        // contrast like other dark inputs). Surface bg-background by default; .bf-themed overrides
        // via [data-bf-input-fill]. Inner input fully transparent — bg/shadow/border forced with !
        // because Input's cva ships bg-card + dark:border in a CSS layer out-racing tailwind-merge.
        "flex-1 rounded-l-none rounded-r-[8px] bg-transparent! px-2.5 py-2 text-sm tracking-[0.28px] text-foreground shadow-none! ring-0! outline-none! focus-visible:ring-0 aria-invalid:ring-0 dark:border-0! dark:bg-transparent! dark:shadow-none!",
        variant === "sm" && "h-7",
        variant === "lg" && "h-9",
        variant === "default" && "h-8",
        className,
      )}
      {...props}
    />
  );
}

type CountryEntry = {
  label: string;
  value: BasePhoneInput.Country | undefined;
};

type CountrySelectProps = {
  disabled?: boolean;
  value: BasePhoneInput.Country;
  options: CountryEntry[];
  onChange: (country: BasePhoneInput.Country) => void;
};

function CountrySelect({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
}: CountrySelectProps) {
  const { variant, popupClassName } = use(PhoneInputContext);
  const [searchValue, setSearchValue] = useState("");
  // ComboboxContent portals to body, losing .bf-themed CSS vars — re-anchor theme on the popup
  // (same as date-picker/multi-select).
  const themeReanchor = useReanchorThemeProps();

  const filteredCountries = useMemo(() => {
    if (!searchValue) return countryList;
    return countryList.filter(({ label }) =>
      label.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [countryList, searchValue]);

  return (
    <Combobox
      items={filteredCountries}
      value={selectedCountry || ""}
      onValueChange={(country: BasePhoneInput.Country | null) => {
        if (country) {
          onChange(country);
        }
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            variant="ghost"
            size={variant}
            aria-label="Select country"
            data-bf-input-fill
            suffix={<ChevronDownIcon className="ml-0.5 size-3 text-muted-foreground" />}
            className={cn(
              // Left "input-select" piece (flag + chevron). No border/shadow/bg — wrapper owns
              // the surface; transparent so the control reads as one block. Hover/pressed paint a
              // subtle overlay to keep the target discoverable.
              "flex items-center gap-[3px] rounded-l-[8px] rounded-r-none bg-transparent! py-2 pr-1 pl-2 shadow-none hover:bg-secondary/40 focus:z-10 data-pressed:bg-secondary/40 dark:border-0! dark:bg-transparent! dark:shadow-none! dark:hover:bg-muted/40 dark:data-pressed:bg-muted/40",
              variant === "sm" && "h-7",
              variant === "lg" && "h-9",
              variant === "default" && "h-8",
              disabled && "opacity-50",
            )}
            disabled={disabled}
          >
            <span className="sr-only">
              <ComboboxValue />
            </span>
            <span className="text-sm text-foreground">
              {selectedCountry && BasePhoneInput.isSupportedCountry(selectedCountry)
                ? `+${BasePhoneInput.getCountryCallingCode(selectedCountry)}`
                : ""}
            </span>
          </Button>
        }
      />
      <ComboboxContent
        align="start"
        className={cn(
          // No blanket *:data-[slot=input-group]:bg-transparent — search InputGroup keeps
          // bg-secondary so it reads as a themed chip (Command palette pattern).
          "w-[246px] rounded-xl bg-popover p-1 elevation-xl",
          themeReanchor.className,
          popupClassName,
        )}
        style={themeReanchor.style}
      >
        {/* One InputGroup carries bg + focus ring so icon and input read as one control.
            variant="borderless" drops the default border; focus-within paints the ring. */}
        <InputGroup
          variant="borderless"
          className="h-7 gap-1.5 rounded-lg bg-secondary px-2 focus-within:ring-2 focus-within:ring-ring/50"
        >
          <InputGroupAddon align="inline-start" className="ps-0 pe-0">
            <Search
              className="size-4 shrink-0"
              strokeWidth={2}
              color="var(--color-gray-alpha-600)"
            />
          </InputGroupAddon>
          <ComboboxPrimitive.Input
            placeholder="Search for countries"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            render={
              <InputGroupInput className="bg-transparent! px-0 text-sm tracking-[0.28px] text-foreground shadow-none ring-0! outline-none! placeholder:text-muted-foreground/70 focus-visible:ring-0 dark:bg-transparent!" />
            }
          />
        </InputGroup>
        <ComboboxSeparator className="my-1 hidden" />
        <ComboboxEmpty className="px-2 py-1.5 text-sm text-muted-foreground">
          No country found.
        </ComboboxEmpty>
        <ComboboxList className="p-0 pt-1">
          <div className="relative flex max-h-full">
            <div className="flex max-h-[min(var(--available-height),24rem)] w-full scroll-pt-1 scroll-pb-1 flex-col overscroll-contain">
              <ScrollArea className="size-full min-h-0 **:data-[slot=scroll-area-scrollbar]:m-0 [&_[data-slot=scroll-area-viewport]]:h-full [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
                {filteredCountries.map((item: CountryEntry) =>
                  item.value && BasePhoneInput.isSupportedCountry(item.value) ? (
                    <ComboboxItem
                      key={item.value}
                      value={item.value}
                      // Hide built-in ItemIndicator — selection shown via country code on right;
                      // its 16px reserved span would shove the code off the popover edge.
                      className="flex h-7 items-center gap-1 rounded-lg px-2 py-1.5 text-sm tracking-[0.28px] [&>span[aria-hidden=true]]:hidden"
                    >
                      <span className="flex-1 text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {`+${BasePhoneInput.getCountryCallingCode(item.value)}`}
                      </span>
                    </ComboboxItem>
                  ) : null,
                )}
              </ScrollArea>
            </div>
          </div>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { PhoneInput };
