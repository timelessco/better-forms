import { KEYS } from "platejs";
import { BlockPlaceholderPlugin } from "platejs/react";

export const BlockPlaceholderKit = [
  BlockPlaceholderPlugin.configure({
    options: {
      className:
        "before:absolute before:cursor-text before:text-muted-foreground/80 before:content-[attr(placeholder)]",
      placeholders: {
        [KEYS.p]: "Press 'space' for AI or '/' for commands",
        formInput: "Type a placeholder",
        formTextarea: "Type a placeholder",
        formEmail: "Type a placeholder",
        formPhone: "Type a placeholder",
        formNumber: "Type a placeholder",
        formLink: "Type a placeholder",
        formDate: "Type a placeholder",
        formTime: "Type a placeholder",
        formOptionItem: "Option",
      },
      query: ({ path }) => path.length >= 1,
    },
  }),
];
