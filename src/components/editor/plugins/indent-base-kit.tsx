import { BaseIndentPlugin } from "@platejs/indent";
import { KEYS } from "platejs";

export const BaseIndentKit = [
  BaseIndentPlugin.configure({
    inject: {
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.toggle],
    },
    options: {
      offset: 24,
    },
  }),
];
