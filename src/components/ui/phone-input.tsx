/* eslint-disable eslint/func-style, eslint-plugin-react/jsx-no-constructed-context-values */
import { createContext, use, useMemo, useState, useSyncExternalStore } from "react";
import * as BasePhoneInput from "react-phone-number-input";

const subscribeMountedNoop = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

const getBrowserDefaultCountry = (): BasePhoneInput.Country | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const region = navigator.language.split(/[-_]/)[1]?.toUpperCase();
  return region && BasePhoneInput.isSupportedCountry(region) ? region : undefined;
};

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Search } from "lucide-react";

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
  // `defaultCountry` is read once on mount by react-phone-number-input, so
  // we wait for hydration before deriving from `navigator.language` and key
  // the underlying component so it remounts with the resolved value.
  const mounted = useSyncExternalStore(subscribeMountedNoop, getMountedClient, getMountedServer);
  const defaultCountry = defaultCountryProp ?? (mounted ? getBrowserDefaultCountry() : undefined);
  return (
    <PhoneInputContext.Provider
      value={{ variant: phoneInputSize, popupClassName, scrollAreaClassName }}
    >
      <BasePhoneInput.default
        key={defaultCountry ?? "no-default"}
        // Two-part layout per Figma: left "input-select" (flag + chevron) and
        // right "input-text" (number) each own their own border. `[&]:` bumps
        // specificity past react-phone-number-input's defaults.
        className={cn(
          "flex flex-row items-stretch [&]:bg-transparent [&]:text-foreground",
          phoneInputSize === "sm" && "[&]:h-7",
          phoneInputSize === "lg" && "[&]:h-9",
          phoneInputSize === "default" && "[&]:h-8",
          props["aria-invalid"] &&
            "[&_[data-slot=input-group]]:ring-1 [&_[data-slot=input-group]]:ring-destructive",
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
        // Right-side "input-text" piece: full border, only the right corners
        // rounded so it butts cleanly against the country select. Surface
        // color is bg-background by default; .bf-themed overrides via
        // [data-bf-input-fill] so the Input token applies.
        "flex-1 rounded-l-none rounded-r-[8px] border border-border bg-background px-2.5 py-2 text-sm tracking-[0.28px] text-foreground shadow-none ring-0! outline-none! focus-visible:ring-0 aria-invalid:ring-0 dark:border dark:border-border dark:bg-background",
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
              // Left "input-select" piece — flag + chevron in a left-rounded
              // bordered cell. Top/left/bottom borders only; right edge butts
              // against the input-text piece's left border.
              "flex items-center gap-[3px] rounded-l-[8px] rounded-r-none border-y border-l border-border bg-background py-2 pr-1 pl-2 shadow-none hover:bg-secondary focus:z-10 data-pressed:bg-secondary",
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
        // Figma elevation/light/xl: triple drop-shadow recipe (1px hairline +
        // 10px ambient + 24px lift).
        className={cn(
          "w-[246px] rounded-xl border border-border bg-popover p-1 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.2),0px_0px_10px_0px_rgba(0,0,0,0.04),0px_24px_30px_0px_rgba(0,0,0,0.1)] *:data-[slot=input-group]:bg-transparent",
          popupClassName,
        )}
      >
        <div className="flex h-7 items-center gap-2 rounded-lg bg-secondary px-2 py-1.5">
          <Search className="size-4 shrink-0" strokeWidth={2} color="var(--color-gray-alpha-600)" />
          <ComboboxInput
            placeholder="Search for countries"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            showTrigger={false}
            className="border-0 bg-transparent p-0 text-sm tracking-[0.28px] text-foreground shadow-none ring-0! outline-none! placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
        </div>
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
                      // Hide the built-in ItemIndicator slot — we surface
                      // selection via the country code on the right instead,
                      // and the 16px reserved indicator span shoves the code
                      // away from the popover edge.
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
