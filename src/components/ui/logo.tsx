import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="21"
    viewBox="0 0 16 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("text-foreground", className)}
    {...props}
  >
    <path
      d="M7.35 7.17C7.39 7 7.38 6.86 7.33 6.76C7.27 6.66 7.15 6.59 6.98 6.54C6.8 6.5 6.57 6.48 6.26 6.48H5.63L5.83 5.54H7.72L7.87 4.93C8.23 3.51 8.84 2.34 9.7 1.41C10.57 0.47 11.62 4.17e-05 12.87 4.17e-05C13.62 4.17e-05 14.2 0.17 14.61 0.5C15.01 0.83 15.17 1.25 15.07 1.74C14.99 2.04 14.85 2.29 14.63 2.48C14.43 2.65 14.17 2.74 13.87 2.74C13.59 2.74 13.41 2.66 13.3 2.5C13.2 2.34 13.12 2.09 13.04 1.76C12.97 1.43 12.88 1.17 12.76 1C12.64 0.83 12.44 0.74 12.15 0.74C11.54 0.74 11.07 1.07 10.74 1.72C10.42 2.36 10.14 3.17 9.91 4.15C9.88 4.24 9.86 4.36 9.83 4.52L9.57 5.54H12.35L12.15 6.48H10.63C10.31 6.48 10.06 6.5 9.87 6.54C9.68 6.59 9.53 6.67 9.41 6.78C9.31 6.88 9.24 7.04 9.2 7.24L7.35 15.48C7.16 16.36 6.83 17.17 6.37 17.91C5.92 18.67 5.36 19.27 4.67 19.72C3.98 20.18 3.2 20.41 2.35 20.41C1.61 20.41 1.04 20.25 0.63 19.91C0.21 19.59 0.06 19.18 0.17 18.67C0.25 18.37 0.39 18.12 0.61 17.93C0.81 17.76 1.06 17.67 1.35 17.67C1.64 17.67 1.83 17.75 1.93 17.91C2.04 18.07 2.12 18.32 2.2 18.65C2.27 18.99 2.36 19.24 2.48 19.41C2.58 19.59 2.78 19.67 3.09 19.67C3.67 19.67 4.13 19.34 4.48 18.67C4.83 18.01 5.14 17.08 5.41 15.89L7.35 7.17Z"
      fill="currentColor"
    />
    <path
      d="M13.81 16.46C13.42 16.46 13.08 16.32 12.81 16.04C12.53 15.77 12.4 15.43 12.4 15.04C12.4 14.64 12.53 14.3 12.81 14.04C13.08 13.77 13.42 13.63 13.81 13.63C14.21 13.63 14.55 13.77 14.81 14.04C15.08 14.3 15.22 14.64 15.22 15.04C15.22 15.43 15.08 15.77 14.81 16.04C14.55 16.32 14.21 16.46 13.81 16.46Z"
      fill="currentColor"
    />
  </svg>
);

interface LogoToggleProps {
  direction?: "left" | "right";
  static?: boolean;
  onClick?: () => void;
  className?: string;
}

export const LogoToggle = ({
  direction = "left",
  static: isStatic,
  onClick,
  className,
}: LogoToggleProps) => (
  <Button
    variant="ghost"
    size="default"
    onClick={onClick}
    className={cn(
      "group/logo relative flex size-8 items-center justify-center rounded-lg transition-colors",
      !isStatic && "cursor-pointer hover:bg-muted/60",
      isStatic && "cursor-default",
      className,
    )}
  >
    {/* Logo - visible by default, fades out on hover */}
    <svg
      width="16"
      height="21"
      viewBox="0 0 16 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "absolute text-foreground transition-all duration-200 ease-out",
        !isStatic && "group-hover/logo:scale-75 group-hover/logo:opacity-0",
      )}
    >
      <path
        d="M7.35 7.17C7.39 7 7.38 6.86 7.33 6.76C7.27 6.66 7.15 6.59 6.98 6.54C6.8 6.5 6.57 6.48 6.26 6.48H5.63L5.83 5.54H7.72L7.87 4.93C8.23 3.51 8.84 2.34 9.7 1.41C10.57 0.47 11.62 4.17e-05 12.87 4.17e-05C13.62 4.17e-05 14.2 0.17 14.61 0.5C15.01 0.83 15.17 1.25 15.07 1.74C14.99 2.04 14.85 2.29 14.63 2.48C14.43 2.65 14.17 2.74 13.87 2.74C13.59 2.74 13.41 2.66 13.3 2.5C13.2 2.34 13.12 2.09 13.04 1.76C12.97 1.43 12.88 1.17 12.76 1C12.64 0.83 12.44 0.74 12.15 0.74C11.54 0.74 11.07 1.07 10.74 1.72C10.42 2.36 10.14 3.17 9.91 4.15C9.88 4.24 9.86 4.36 9.83 4.52L9.57 5.54H12.35L12.15 6.48H10.63C10.31 6.48 10.06 6.5 9.87 6.54C9.68 6.59 9.53 6.67 9.41 6.78C9.31 6.88 9.24 7.04 9.2 7.24L7.35 15.48C7.16 16.36 6.83 17.17 6.37 17.91C5.92 18.67 5.36 19.27 4.67 19.72C3.98 20.18 3.2 20.41 2.35 20.41C1.61 20.41 1.04 20.25 0.63 19.91C0.21 19.59 0.06 19.18 0.17 18.67C0.25 18.37 0.39 18.12 0.61 17.93C0.81 17.76 1.06 17.67 1.35 17.67C1.64 17.67 1.83 17.75 1.93 17.91C2.04 18.07 2.12 18.32 2.2 18.65C2.27 18.99 2.36 19.24 2.48 19.41C2.58 19.59 2.78 19.67 3.09 19.67C3.67 19.67 4.13 19.34 4.48 18.67C4.83 18.01 5.14 17.08 5.41 15.89L7.35 7.17Z"
        fill="currentColor"
      />
      <path
        d="M13.81 16.46C13.42 16.46 13.08 16.32 12.81 16.04C12.53 15.77 12.4 15.43 12.4 15.04C12.4 14.64 12.53 14.3 12.81 14.04C13.08 13.77 13.42 13.63 13.81 13.63C14.21 13.63 14.55 13.77 14.81 14.04C15.08 14.3 15.22 14.64 15.22 15.04C15.22 15.43 15.08 15.77 14.81 16.04C14.55 16.32 14.21 16.46 13.81 16.46Z"
        fill="currentColor"
      />
    </svg>
    {/* Chevrons - hidden by default, fades in on hover */}
    {!isStatic && (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "absolute scale-75 text-foreground opacity-0 transition-all duration-200 ease-out group-hover/logo:scale-100 group-hover/logo:opacity-100",
          direction === "right" && "scale-x-[-1] group-hover/logo:scale-x-[-1]",
        )}
      >
        <path
          d="M18 17L13 12L18 7M11 17L6 12L11 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </Button>
);
