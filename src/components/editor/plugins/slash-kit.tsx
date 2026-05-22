import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";

import { SlashInputElement } from "@/components/ui/slash-node";

export const SlashKit = [SlashPlugin, SlashInputPlugin.withComponent(SlashInputElement)];
