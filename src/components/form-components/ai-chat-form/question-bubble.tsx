import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

type Props = {
  question: PlateFormField;
  onPick: (value: unknown, label: string) => void | Promise<void>;
  onSkip?: () => void;
  canSkip: boolean;
};

const labelOf = (q: PlateFormField): string => ("label" in q && q.label) || q.name || q.id;

// Roving focus across option rows with ArrowUp/ArrowDown (Tab still works too).
// Attached to the options container; the keydown bubbles up from the focused
// option. Wraps around at the ends.
const moveOptionFocus = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  // The shadcn/base-ui Checkbox renders a focusable `[role=checkbox]` button AND
  // a visually-hidden `<input type=checkbox>`. Match only the visible focusable
  // control (`button` covers MultiChoice buttons and the checkbox button) and
  // drop hidden elements (offsetParent === null) so focus doesn't land on the
  // unfocusable hidden input.
  const options = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('button, [role="checkbox"]'),
  ).filter((el) => el.offsetParent !== null);
  if (options.length === 0) return;
  e.preventDefault();
  const current = options.indexOf(document.activeElement as HTMLElement);
  const delta = e.key === "ArrowDown" ? 1 : -1;
  const next = current === -1 ? 0 : (current + delta + options.length) % options.length;
  options[next]?.focus();
};

export const QuestionBubble = ({ question, onPick, onSkip, canSkip }: Props) => {
  switch (question.fieldType) {
    case "MultiChoice":
      return (
        <MultiChoiceBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />
      );
    case "MultiSelect":
      return (
        <MultiSelectBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />
      );
    case "Checkbox":
      return (
        <CheckboxBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />
      );
    case "Ranking":
      return (
        <RankingBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />
      );
    case "Date":
      return <DateBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />;
    case "Time":
      return <TimeBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />;
    case "Phone":
      return <PhoneBubble question={question} onPick={onPick} canSkip={canSkip} onSkip={onSkip} />;
    default:
      return null;
  }
};

const SkipLink = ({ onSkip }: { onSkip?: () => void }) =>
  onSkip ? (
    <button type="button" onClick={onSkip} className="text-xs text-muted-foreground underline">
      Skip this question
    </button>
  ) : null;

const Frame = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl bg-muted/30 p-3", className)}>{children}</div>
);

type SubProps = {
  question: PlateFormField;
  onPick: (value: unknown, label: string) => void | Promise<void>;
  onSkip?: () => void;
  canSkip: boolean;
};

const MultiChoiceBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  if (question.fieldType !== "MultiChoice") return null;
  return (
    <Frame>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        role="group"
        aria-label={labelOf(question)}
        onKeyDown={moveOptionFocus}
        className="flex flex-col gap-2"
      >
        {question.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => void onPick(opt.value, opt.label)}
            className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            {opt.label}
          </button>
        ))}
      </div>
      {canSkip && (
        <div className="mt-2">
          <SkipLink onSkip={onSkip} />
        </div>
      )}
    </Frame>
  );
};

const MultiSelectBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  const [picked, setPicked] = useState<string[]>([]);
  if (question.fieldType !== "MultiSelect") return null;
  const toggle = (v: string) =>
    setPicked((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  return (
    <Frame>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        role="group"
        aria-label={labelOf(question)}
        onKeyDown={moveOptionFocus}
        className="flex flex-col gap-2"
      >
        {question.options.map((opt) => {
          const id = `${question.id}-${opt.value}`;
          const checked = picked.includes(opt.value);
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(opt.value)} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {/* Continue is first in the DOM (so Tab reaches it before Skip); row-reverse
          keeps Skip visually on the left, Continue on the right. */}
      <div className="mt-3 flex flex-row-reverse items-center justify-between">
        <Button
          type="button"
          size="sm"
          disabled={picked.length === 0}
          onClick={() => {
            const labels = question.options
              .filter((o) => picked.includes(o.value))
              .map((o) => o.label)
              .join(", ");
            void onPick(picked, labels);
          }}
        >
          Continue
        </Button>
        {canSkip ? <SkipLink onSkip={onSkip} /> : <span />}
      </div>
    </Frame>
  );
};

const CheckboxBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  // Reform's Checkbox is options-based (multi-checkbox group, not a single
  // boolean). Render as multi-pick like MultiSelect.
  const [picked, setPicked] = useState<string[]>([]);
  if (question.fieldType !== "Checkbox") return null;
  const toggle = (v: string) =>
    setPicked((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  return (
    <Frame>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        role="group"
        aria-label={labelOf(question)}
        onKeyDown={moveOptionFocus}
        className="flex flex-col gap-2"
      >
        {question.options.map((opt) => {
          const id = `${question.id}-${opt.value}`;
          const checked = picked.includes(opt.value);
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(opt.value)} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-row-reverse items-center justify-between">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const labels = question.options
              .filter((o) => picked.includes(o.value))
              .map((o) => o.label)
              .join(", ");
            void onPick(picked, labels || "(none)");
          }}
        >
          Continue
        </Button>
        {canSkip ? <SkipLink onSkip={onSkip} /> : <span />}
      </div>
    </Frame>
  );
};

const RankingBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  const initial =
    question.fieldType === "Ranking" ? question.options.map((o) => o.value) : ([] as string[]);
  const [order, setOrder] = useState<string[]>(initial);
  if (question.fieldType !== "Ranking") return null;
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]] as [string, string];
    setOrder(next);
  };
  return (
    <Frame>
      <ol className="flex flex-col gap-2">
        {order.map((v, idx) => {
          const opt = question.options.find((o) => o.value === v);
          if (!opt) return null;
          return (
            <li
              key={v}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">{idx + 1}.</span>
              <span className="flex-1">{opt.label}</span>
              <button
                type="button"
                onClick={() => move(idx, -1)}
                aria-label="Move up"
                className="text-xs text-muted-foreground"
                disabled={idx === 0}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                aria-label="Move down"
                className="text-xs text-muted-foreground"
                disabled={idx === order.length - 1}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-row-reverse items-center justify-between">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const labels = order
              .map((v) => question.options.find((o) => o.value === v)?.label)
              .filter(Boolean)
              .join(" → ");
            void onPick(order, labels);
          }}
        >
          Continue
        </Button>
        {canSkip ? <SkipLink onSkip={onSkip} /> : <span />}
      </div>
    </Frame>
  );
};

const DateBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  const [value, setValue] = useState("");
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={labelOf(question)}
        />
        <Button type="button" size="sm" disabled={!value} onClick={() => void onPick(value, value)}>
          Continue
        </Button>
      </div>
      {canSkip && (
        <div className="mt-2">
          <SkipLink onSkip={onSkip} />
        </div>
      )}
    </Frame>
  );
};

const TimeBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  const [value, setValue] = useState("");
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={labelOf(question)}
        />
        <Button type="button" size="sm" disabled={!value} onClick={() => void onPick(value, value)}>
          Continue
        </Button>
      </div>
      {canSkip && (
        <div className="mt-2">
          <SkipLink onSkip={onSkip} />
        </div>
      )}
    </Frame>
  );
};

const PhoneBubble = ({ question, onPick, onSkip, canSkip }: SubProps) => {
  const [value, setValue] = useState("");
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <PhoneInput value={value} onChange={setValue} aria-label={labelOf(question)} variant="sm" />
        <Button type="button" size="sm" disabled={!value} onClick={() => void onPick(value, value)}>
          Continue
        </Button>
      </div>
      {canSkip && (
        <div className="mt-2">
          <SkipLink onSkip={onSkip} />
        </div>
      )}
    </Frame>
  );
};
