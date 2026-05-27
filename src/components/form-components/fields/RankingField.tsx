import { IconSwap } from "@/components/transitions/icon-swap";
import { ChevronsUpDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { FieldRendererProps } from "./shared";

const RankingField = ({ element, form }: FieldRendererProps<"Ranking">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
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
              ...rankedValues.flatMap((v) => {
                const opt = element.options.find((o) => o.value === v);
                return opt ? [opt] : [];
              }),
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
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px]",
                      isRanked
                        ? "bg-primary text-[9px] leading-none font-semibold text-primary-foreground"
                        : cn(
                            "border border-border text-muted-foreground",
                            hasErrors && "border-destructive ring-1 ring-destructive",
                          ),
                    )}
                  >
                    <IconSwap
                      state={isRanked ? "b" : "a"}
                      iconA={<ChevronsUpDownIcon className="size-2.5" />}
                      iconB={<span>{isRanked ? rankIndex + 1 : ""}</span>}
                    />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <f.FieldError />
        </>
      );
    }}
  </form.AppField>
);

export default RankingField;
