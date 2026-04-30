import { ChevronsUpDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "./shared";
import type { FieldRendererProps } from "./shared";

const RankingField = ({ element, form }: FieldRendererProps<"Ranking">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      const errorMessage = hasErrors ? extractErrorMessage(f.state.meta.errors[0]) : "";
      const rankedValues = (f.state.value as string[] | undefined) ?? [];

      const handleRankClick = (optionValue: string) => {
        if (rankedValues.includes(optionValue)) {
          const idx = rankedValues.indexOf(optionValue);
          f.handleChange(rankedValues.slice(0, idx));
        } else {
          const newRanked = [...rankedValues, optionValue];
          if (newRanked.length === element.options.length - 1) {
            const remaining = element.options.find((o) => !newRanked.includes(o.value));
            if (remaining) {
              f.handleChange([...newRanked, remaining.value]);
              return;
            }
          }
          f.handleChange(newRanked);
        }
      };

      return (
        <>
          <div className="flex flex-col gap-2">
            {[
              ...rankedValues
                .map((v) => element.options.find((o) => o.value === v))
                .filter((o): o is { value: string; label: string } => Boolean(o)),
              ...element.options.filter((o) => !rankedValues.includes(o.value)),
            ].map((option) => {
              const rankIndex = rankedValues.indexOf(option.value);
              const isRanked = rankIndex !== -1;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRankClick(option.value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 py-1 text-left text-sm transition-colors",
                    hasErrors && "text-destructive",
                  )}
                >
                  {isRanked ? (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary text-[9px] leading-none font-semibold text-primary-foreground">
                      {rankIndex + 1}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border text-muted-foreground",
                        hasErrors && "border-destructive ring-1 ring-destructive",
                      )}
                    >
                      <ChevronsUpDownIcon className="size-2.5" />
                    </span>
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          {hasErrors && <p className="text-sm text-destructive">{errorMessage}</p>}
        </>
      );
    }}
  </form.AppField>
);

export default RankingField;
