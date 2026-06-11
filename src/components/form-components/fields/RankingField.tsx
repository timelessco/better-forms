import { useId, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { domMax, LazyMotion, m } from "motion/react";

import { IconSwap } from "@/components/transitions/icon-swap";
import { ChevronsUpDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { shuffleOptions } from "./shared";
import type { FieldRendererProps } from "./shared";

type RankingOption = { label: string; value: string };

const SortableRankRow = ({
  option,
  rankIndex,
  hasErrors,
  onRankClick,
}: {
  option: RankingOption;
  rankIndex: number;
  hasErrors: boolean;
  onRankClick: (value: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.value,
  });
  const isRanked = rankIndex !== -1;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onRankClick(option.value)}
      // Inline sortable transition overrides the colors-only class while items animate.
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex cursor-pointer touch-manipulation items-center gap-2 py-1 text-left text-sm transition-colors",
        isDragging && "relative z-10 cursor-grabbing opacity-80",
        hasErrors && "text-destructive",
      )}
      {...attributes}
      {...listeners}
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
};

const RankingField = ({ element, form }: FieldRendererProps<"Ranking">) => {
  const dndId = useId();
  // Distance/delay gates keep plain clicks (and touch scrolling) as tap-to-rank;
  // moving past the threshold or press-and-hold starts a drag instead.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // Tap-to-rank reorders slide via motion layout animation; suspended while a real drag is in
  // flight (and for the drop commit itself) so it never fights dnd-kit's own transforms.
  const [dragActive, setDragActive] = useState(false);

  // Shuffle the unranked pool once per mount when enabled, so order stays stable while ranking.
  const options = useMemo(
    () => (element.shuffle ? shuffleOptions(element.options) : element.options),
    [element.options, element.shuffle],
  );

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const rankedValues = (f.state.value as string[] | undefined) ?? [];
        const rankedCount = rankedValues.length;

        // Once every option but one is ranked, the last rank is forced — fill it in.
        const completeIfOneLeft = (ranked: string[]) => {
          if (ranked.length !== options.length - 1) return ranked;
          const remaining = options.find((o) => !ranked.includes(o.value));
          return remaining ? [...ranked, remaining.value] : ranked;
        };

        const handleRankClick = (optionValue: string) => {
          if (rankedValues.includes(optionValue)) {
            // Unranking invalidates everything after it — truncate.
            f.handleChange(rankedValues.slice(0, rankedValues.indexOf(optionValue)));
          } else {
            f.handleChange(completeIfOneLeft([...rankedValues, optionValue]));
          }
        };

        // Ranked options in rank order, then the unranked pool in display (possibly shuffled) order.
        const displayed = [
          ...rankedValues.flatMap((v) => {
            const opt = options.find((o) => o.value === v);
            return opt ? [opt] : [];
          }),
          ...options.filter((o) => !rankedValues.includes(o.value)),
        ];

        const handleDragEnd = ({ active, over }: DragEndEvent) => {
          // Re-enable layout animation only after the drop's reorder render has committed.
          requestAnimationFrame(() => setDragActive(false));
          if (!over || active.id === over.id) return;
          const from = displayed.findIndex((o) => o.value === active.id);
          const to = displayed.findIndex((o) => o.value === over.id);
          if (from === -1 || to === -1) return;
          const wasRanked = from < rankedCount;
          if (wasRanked && to >= rankedCount) {
            // Dragged out of the ranked region ⇒ unrank it, keep the others' order.
            f.handleChange(rankedValues.filter((v) => v !== active.id));
            return;
          }
          // Reordering within the unranked pool carries no meaning — let it snap back.
          if (!wasRanked && to >= rankedCount) return;
          const next = arrayMove(displayed, from, to)
            .slice(0, wasRanked ? rankedCount : rankedCount + 1)
            .map((o) => o.value);
          f.handleChange(wasRanked ? next : completeIfOneLeft(next));
        };

        return (
          <>
            <DndContext
              id={dndId}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              sensors={sensors}
              onDragStart={() => setDragActive(true)}
              onDragCancel={() => setDragActive(false)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayed.map((o) => o.value)}
                strategy={verticalListSortingStrategy}
              >
                {/* domMax (not domAnimation): layout animations ship in the max bundle. */}
                <LazyMotion features={domMax} strict>
                  <div className="flex flex-col gap-2">
                    {displayed.map((option) => (
                      <m.div
                        key={option.value}
                        layout={dragActive ? false : "position"}
                        transition={{ type: "spring", stiffness: 550, damping: 38 }}
                      >
                        <SortableRankRow
                          option={option}
                          rankIndex={rankedValues.indexOf(option.value)}
                          hasErrors={hasErrors}
                          onRankClick={handleRankClick}
                        />
                      </m.div>
                    ))}
                  </div>
                </LazyMotion>
              </SortableContext>
            </DndContext>
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default RankingField;
