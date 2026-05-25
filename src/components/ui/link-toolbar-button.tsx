import { useLinkToolbarButton, useLinkToolbarButtonState } from "@platejs/link/react";
import { LinkIcon } from "@/components/ui/icons";
import type * as React from "react";

import { ToolbarButton } from "./toolbar";

export const LinkToolbarButton = (props: React.ComponentProps<typeof ToolbarButton>) => {
  const state = useLinkToolbarButtonState();
  const { props: buttonProps } = useLinkToolbarButton(state);

  return (
    <ToolbarButton {...props} {...buttonProps} data-plate-focus tooltip="Link">
      <LinkIcon />
    </ToolbarButton>
  );
};
