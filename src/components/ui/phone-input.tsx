/* eslint-disable eslint/func-style, eslint-plugin-react/jsx-no-constructed-context-values */
import { createContext, use, useMemo, useState } from "react";
import * as BasePhoneInput from "react-phone-number-input";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const getBrowserDefaultCountry = (): BasePhoneInput.Country | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const region = navigator.language.split(/[-_]/)[1]?.toUpperCase();
  return region && BasePhoneInput.isSupportedCountry(region) ? region : undefined;
};
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
  const mounted = useMounted();
  const defaultCountry = defaultCountryProp ?? (mounted ? getBrowserDefaultCountry() : undefined);
  return (
    <PhoneInputContext.Provider
      value={{ variant: phoneInputSize, popupClassName, scrollAreaClassName }}
    >
      <BasePhoneInput.default
        key={defaultCountry ?? "no-default"}
        // The wrapper carries the visual outline (drop-shadow recipe in
        // light mode, just bg-input contrast in dark — same as every other
        // input on the page; no borders in either mode). The two inner
        // pieces (country select + number field) stay transparent and just
        // butt together inside this shared surface. `[&]:` bumps specificity
        // past react-phone-number-input's own defaults.
        className={cn(
          "flex flex-row items-stretch overflow-hidden rounded-lg text-foreground elevation-sm dark:shadow-none [&]:bg-card dark:[&]:bg-input",
          phoneInputSize === "sm" && "[&]:h-7",
          phoneInputSize === "lg" && "[&]:h-9",
          phoneInputSize === "default" && "[&]:h-8",
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
        // Right-side "input-text" piece: full border in light mode for the
        // two-part seam, transparent in dark mode so the whole control reads
        // as a single bg-tinted block — matching every other dark-mode input
        // in the form (which rely on bg contrast, not borders).
        // Surface color is bg-background by default; .bf-themed overrides
        // via [data-bf-input-fill] so the Input token applies.
        // Inner input is fully transparent — bg / shadow / border are
        // overridden via `!` because Input's cva variant ships `bg-card`
        // and `dark:border dark:border-border` in a CSS layer that
        // out-races plain tailwind-merge. The wrapper above owns the
        // visual surface.
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
              // Left "input-select" piece — flag + chevron. No border, no
              // shadow, no own bg: the wrapper owns the visual surface and
              // both inner pieces are transparent so the whole control
              // reads as one rounded block. Hover/pressed paint a subtle
              // overlay so the click target is still discoverable.
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
          "w-[246px] rounded-xl bg-popover p-1 elevation-xl *:data-[slot=input-group]:bg-transparent",
          popupClassName,
        )}
      >
        <div className="flex h-7 items-center gap-1.5 rounded-lg bg-secondary px-2 py-1.5">
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
