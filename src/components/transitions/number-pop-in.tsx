import { cn } from "@/lib/utils";

interface NumberPopInProps {
  /** The value to display. Changing it replays the per-character pop-in. */
  value: string | number;
  className?: string;
}

/**
 * Number whose chars slide + blur in. Changing `value` re-keys the group → remount replays CSS anim (no effect). Last two chars stagger.
 * See `.t-digit-group` in `src/styles/transitions.css`.
 */
export const NumberPopIn = ({ value, className }: NumberPopInProps) => {
  const text = String(value);
  const characters = Array.from(text);
  const lastIndex = characters.length - 1;

  return (
    <span key={text} className={cn("t-digit-group is-animating", className)}>
      {characters.map((char, index) => {
        const stagger = index === lastIndex - 1 ? "1" : index === lastIndex ? "2" : undefined;
        return (
          <span key={`${text}-${index}`} className="t-digit" data-stagger={stagger}>
            {char}
          </span>
        );
      })}
    </span>
  );
};
