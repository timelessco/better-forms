/* eslint-disable eslint/func-style, eslint-plugin-react/jsx-no-constructed-context-values */
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { createContext, use, useMemo, useState } from "react";
import * as BasePhoneInput from "react-phone-number-input";

import { useMounted } from "@/hooks/use-mounted";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { getVisitorCountry } from "@/lib/server-fn/geo";
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

const NON_DIGIT_REGEX = /\D/g;

const getBrowserDefaultCountry = (): BasePhoneInput.Country | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const region = navigator.language.split(/[-_]/)[1]?.toUpperCase();
  return region && BasePhoneInput.isSupportedCountry(region) ? region : undefined;
};

/**
 * Resolve the initial country for the phone field, preferring the
 * Respondent's actual location over their browser UI language:
 *   1. an explicit `defaultCountry` prop, if supplied;
 *   2. Vercel edge geo-IP (`x-vercel-ip-country`), read once and shared
 *      across every PhoneInput via the `visitor-country` query;
 *   3. the browser locale's region — but ONLY after the geo query settles
 *      with no usable result (local dev / non-Vercel), so we never flash a
 *      locale-derived country (e.g. US for an `en-US` browser) before geo
 *      resolves and reformat an autofilled number under the wrong country.
 */
const useResolvedDefaultCountry = (
  override: BasePhoneInput.Country | undefined,
): BasePhoneInput.Country | undefined => {
  const mounted = useMounted();
  const { data: geoCountry, isPending: geoPending } = useQuery({
    queryKey: ["visitor-country"],
    queryFn: () => getVisitorCountry(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (override) return override;
  if (geoCountry && BasePhoneInput.isSupportedCountry(geoCountry)) return geoCountry;
  return mounted && !geoPending ? getBrowserDefaultCountry() : undefined;
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
  // `defaultCountry` is read once on mount by react-phone-number-input, so
  // we resolve it after hydration (geo-IP first, browser locale as a settled
  // fallback) and key the underlying component so it remounts with the
  // resolved value.
  const defaultCountry = useResolvedDefaultCountry(defaultCountryProp);
  return (
    <PhoneInputContext.Provider
      value={{ variant: phoneInputSize, popupClassName, scrollAreaClassName }}
    >
      <BasePhoneInput.default
        key={defaultCountry ?? "no-default"}
        // The wrapper carries the visual outline (drop-shadow recipe in
        // light mode, just bg contrast in dark — same as every other input
        // on the page; no borders in either mode). The two inner pieces
        // (country select + number field) stay transparent and just butt
        // together inside this shared surface. Surface is driven by the
        // same `--form-input-bg` token the `form-input` utility uses so
        // themed and unthemed pages stay consistent with other inputs.
        // `[&]:` bumps specificity past react-phone-number-input's own
        // defaults.
        className={cn(
          "flex flex-row items-stretch overflow-hidden rounded-lg text-foreground elevation-sm dark:shadow-none [&]:bg-[var(--form-input-bg,var(--color-gray-50))]",
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
  // ComboboxContent portals to document.body, so it loses the .bf-themed
  // CSS-var context. Re-anchor the theme on the popup (same pattern as
  // date-picker / multi-select).
  const themeReanchor = useReanchorThemeProps();

  const filteredCountries = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return countryList;
    // Match by country name OR calling code, so a Respondent who knows their
    // dialing code (e.g. "91" or "+91") can type it directly, not just the name.
    const digits = query.replace(NON_DIGIT_REGEX, "");
    return countryList.filter(({ label, value }) => {
      if (label.toLowerCase().includes(query)) return true;
      if (!digits || !value || !BasePhoneInput.isSupportedCountry(value)) return false;
      return BasePhoneInput.getCountryCallingCode(value).startsWith(digits);
    });
  }, [countryList, searchValue]);

  return (
    <Combobox
      items={filteredCountries}
      // We filter manually (by name OR calling code) above, so disable base-ui's
      // built-in filter — it auto-matches the item `label` only, which would
      // re-hide calling-code matches like "91".
      filter={null}
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
          // Drop any blanket "*:data-[slot=input-group]:bg-transparent"
          // override here — the search-input InputGroup below intentionally
          // carries `bg-secondary` so the search row reads as a themed chip
          // inside the popover (matches the Command palette pattern).
          "w-[246px] rounded-xl bg-popover p-1 elevation-xl",
          themeReanchor.className,
          popupClassName,
        )}
        style={themeReanchor.style}
      >
        {/* Single InputGroup carries bg + the focus ring so search icon and
            input read as one focused control. variant="borderless" suppresses
            the default border; focus-within paints the unified ring. */}
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
