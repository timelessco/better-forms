import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import * as React from "react";

import { cn, isNullable } from "@/lib/utils";

const LinkTransitionContext = React.createContext(false);

interface AnchorLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  hasImageChildren?: boolean;
}

const AnchorLinkComponent = (props: AnchorLinkProps & { ref?: React.Ref<HTMLAnchorElement> }) => {
  const { hasImageChildren, className, children, ref, ...rest } = props;
  const restRecord = rest as Record<string, unknown>;
  const isTransitioning = restRecord["data-transitioning"] === "transitioning";

  return (
    <LinkTransitionContext.Provider value={isTransitioning}>
      <a
        ref={ref}
        data-slot="aria-current-link"
        className={cn(
          "rounded-xs underline transition data-disabled:cursor-default data-disabled:no-underline",
          !hasImageChildren && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasImageChildren && "group",
          className,
        )}
        {...rest}
      >
        {children}
        <ImageFocusRing hasImageChildren={hasImageChildren} />
      </a>
    </LinkTransitionContext.Provider>
  );
};

const CreatedLinkComponent = createLink(AnchorLinkComponent);

const isExternalUrl = (s: string) => /^(https?:|mailto:|tel:)/.test(s);

export type LinkProps = React.ComponentProps<typeof CreatedLinkComponent> & {
  hasImageChildren?: boolean;
};

export const Link: LinkComponent<typeof AnchorLinkComponent> = (props) => {
  const { to, ...rest } = props;
  const destination = to;
  const isExternal = typeof destination === "string" && isExternalUrl(destination);

  const linkProps = isExternal ? { ...rest, href: destination } : { ...rest, to: destination };

  return (
    <CreatedLinkComponent
      activeProps={{ "aria-current": "page" }}
      {...(linkProps as React.ComponentProps<typeof CreatedLinkComponent>)}
    />
  );
};

interface ImageFocusRingProps {
  hasImageChildren?: boolean;
}

const ImageFocusRing = (props: ImageFocusRingProps) => {
  const { hasImageChildren } = props;

  if (isNullable(hasImageChildren)) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 size-full transition ring-inset group-focus-visible:ring group-focus-visible:ring-ring/50"
      data-slot="image-focus-ring"
    />
  );
};

export const LinkHint = () => {
  const pending = React.use(LinkTransitionContext);

  return (
    <span
      aria-hidden
      className={`link-hint ${pending ? "is-pending" : ""}`}
      data-slot="link-hint"
    />
  );
};
