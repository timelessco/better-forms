import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";

const formatStaticDate = (dateValue: string | undefined): string => {
  if (!dateValue) return "No date";
  // Static renderer: no relative labels (Today/Yesterday/Tomorrow) because
  // they would compute differently on the server vs the client and trigger
  // a hydration mismatch. The interactive `DateElement` swaps in relative
  // labels client-side once mounted.
  return new Date(dateValue).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const DateElementStatic = (props: SlateElementProps) => {
  const { element } = props;
  const dateValue = element.date as string | undefined;

  return (
    <SlateElement className="inline-block" {...props}>
      <span className="w-fit rounded-sm bg-muted px-1 text-muted-foreground">
        {dateValue ? formatStaticDate(dateValue) : <span>Pick a date</span>}
      </span>
      {props.children}
    </SlateElement>
  );
};
