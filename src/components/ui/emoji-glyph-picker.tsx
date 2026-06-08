"use client";

import emojiData from "@emoji-mart/data";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Minimal shape we read from @emoji-mart/data (already bundled by the Plate emoji kit).
interface EmojiDatum {
  id: string;
  name: string;
  keywords?: string[];
  skins: { native: string }[];
}
interface EmojiMartData {
  emojis: Record<string, EmojiDatum>;
}
const data = emojiData as unknown as EmojiMartData;

// Cap the rendered grid — the full set (~1.9k) is overkill for a bubble glyph.
const MAX_RESULTS = 240;

interface EmojiGlyphPickerProps {
  value: string;
  onSelect: (native: string) => void;
  /** The trigger element (button) the popover anchors to. */
  trigger: React.ReactElement;
}

/** Emoji glyph picker popover — search + grid, returns the chosen native emoji string. */
export const EmojiGlyphPicker = ({ value, onSelect, trigger }: EmojiGlyphPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = useMemo(() => Object.values(data.emojis), []);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? all.filter(
          (e) => e.name.toLowerCase().includes(term) || e.keywords?.some((k) => k.includes(term)),
        )
      : all;
    return list.slice(0, MAX_RESULTS);
  }, [all, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" sideOffset={6} className="w-72 gap-2 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          className="h-8"
          aria-label="Search emoji"
        />
        <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
          {results.map((e) => {
            const native = e.skins[0]?.native;
            if (!native) return null;
            return (
              <button
                key={e.id}
                type="button"
                aria-label={e.name}
                onClick={() => {
                  onSelect(native);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-xl hover:bg-accent",
                  value === native && "bg-accent",
                )}
              >
                {native}
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="col-span-8 px-1 py-4 text-center text-xs text-muted-foreground">
              No emoji found.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
