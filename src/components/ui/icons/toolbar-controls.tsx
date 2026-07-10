export const Pencil2Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      opacity="0.12"
      d="M6.68 20.72C6.99 20.64 7.14 20.6 7.28 20.53C7.41 20.48 7.53 20.41 7.64 20.33C7.77 20.23 7.88 20.12 8.1 19.9L18.43 9.57C18.63 9.37 18.73 9.27 18.77 9.15C18.8 9.05 18.8 8.95 18.77 8.85C18.73 8.73 18.63 8.63 18.43 8.43L15.57 5.57C15.37 5.37 15.27 5.27 15.15 5.23C15.05 5.2 14.95 5.2 14.85 5.23C14.73 5.27 14.63 5.37 14.43 5.57L4.1 15.9C3.88 16.12 3.77 16.23 3.67 16.36C3.59 16.47 3.52 16.59 3.47 16.72C3.4 16.86 3.36 17.01 3.28 17.32L2 22L6.68 20.72Z"
      fill="currentColor"
    />
    <path
      d="M18 2L22 6M2 22L3.28 17.32C3.36 17.01 3.4 16.86 3.47 16.72C3.52 16.59 3.59 16.47 3.67 16.36C3.77 16.23 3.88 16.12 4.1 15.9L14.43 5.57C14.63 5.37 14.73 5.27 14.85 5.23C14.95 5.2 15.05 5.2 15.15 5.23C15.27 5.27 15.37 5.37 15.57 5.57L18.43 8.43C18.63 8.63 18.73 8.73 18.77 8.85C18.8 8.95 18.8 9.05 18.77 9.15C18.73 9.27 18.63 9.37 18.43 9.57L8.1 19.9C7.88 20.12 7.77 20.23 7.64 20.33C7.53 20.41 7.41 20.48 7.28 20.53C7.14 20.6 6.99 20.64 6.68 20.72L2 22Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Outline bin from Figma system-flat (node 25578:9168), 16→24 viewBox ×1.5 */}
    <path
      d="M4.7505 6.4995L5.6556 19.3896C5.7292 20.4372 6.6005 21.2495 7.6507 21.2495H16.3503C17.4005 21.2495 18.2718 20.4372 18.3455 19.3896L19.2506 6.4995M10.0005 10.5V16.25M13.9995 10.5V16.25M3.2505 5.7495H20.7506M8.5239 5.5834C8.7301 3.847 10.2074 2.5005 11.9993 2.5005C13.7912 2.5005 15.2685 3.847 15.4748 5.5834"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      opacity="0.12"
      d="M9 12C9 13.66 10.34 15 12 15C12.83 15 13.58 14.66 14.12 14.12L9.88 9.88C9.34 10.42 9 11.17 9 12Z"
      fill="currentColor"
    />
    <path
      d="M10.74 5.09C11.15 5.03 11.57 5 12 5C17.11 5 20.45 9.5 21.58 11.29C21.72 11.5 21.78 11.61 21.82 11.78C21.85 11.9 21.85 12.1 21.82 12.22C21.78 12.39 21.72 12.5 21.58 12.72C21.28 13.19 20.82 13.86 20.22 14.58M6.72 6.72C4.56 8.18 3.09 10.22 2.42 11.29C2.28 11.5 2.22 11.61 2.18 11.78C2.15 11.9 2.15 12.1 2.18 12.22C2.22 12.39 2.28 12.5 2.42 12.71C3.55 14.5 6.89 19 12 19C14.06 19 15.83 18.27 17.29 17.28M3 3L21 21M9.88 9.88C9.34 10.42 9 11.17 9 12C9 13.66 10.34 15 12 15C12.83 15 13.58 14.66 14.12 14.12"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CircleUserIcon = (_props: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.12">
      <path
        d="M14.01 14.58C12.68 15.77 10.93 16.5 9 16.5C7.07 16.5 5.32 15.77 3.99 14.58C4.44 13.5 5.51 12.75 6.75 12.75H11.25C12.49 12.75 13.56 13.5 14.01 14.58Z"
        fill="var(--sidebar-icon-stroke)"
      />
      <path
        d="M9 11.12C10.66 11.12 12 9.78 12 8.12C12 6.47 10.66 5.12 9 5.12C7.34 5.12 6 6.47 6 8.12C6 9.78 7.34 11.12 9 11.12Z"
        fill="var(--sidebar-icon-stroke)"
      />
    </g>
    <path
      d="M3.99 14.58C4.44 13.5 5.51 12.75 6.75 12.75C8.81 13.57 9.76 13.51 11.25 12.75C12.49 12.75 13.56 13.5 14.01 14.58M12 8.12C12 9.78 10.66 11.12 9 11.12C7.34 11.12 6 9.78 6 8.12C6 6.47 7.34 5.12 9 5.12C10.66 5.12 12 6.47 12 8.12ZM16.5 9C16.5 13.14 13.14 16.5 9 16.5C4.86 16.5 1.5 13.14 1.5 9C1.5 4.86 4.86 1.5 9 1.5C13.14 1.5 16.5 4.86 16.5 9Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g opacity="0.12">
      <path
        d="M9.5 12C11.99 12 14 9.99 14 7.5C14 5.01 11.99 3 9.5 3C7.01 3 5 5.01 5 7.5C5 9.99 7.01 12 9.5 12Z"
        fill="var(--sidebar-icon-stroke)"
      />
      <path
        d="M9.5 15C6.67 15 4.15 16.54 2.56 18.94C2.21 19.46 2.04 19.73 2.06 20.06C2.07 20.32 2.24 20.64 2.45 20.8C2.72 21 3.09 21 3.82 21H15.18C15.91 21 16.28 21 16.55 20.8C16.76 20.64 16.93 20.32 16.94 20.06C16.96 19.73 16.79 19.46 16.44 18.94C14.85 16.54 12.33 15 9.5 15Z"
        fill="var(--sidebar-icon-stroke)"
      />
    </g>
    <path
      d="M18 15.84C19.46 16.57 20.7 17.74 21.62 19.21C21.8 19.5 21.89 19.65 21.92 19.85C21.98 20.26 21.7 20.76 21.32 20.92C21.13 21 20.92 21 20.5 21M16 11.53C17.48 10.8 18.5 9.27 18.5 7.5C18.5 5.73 17.48 4.2 16 3.47M14 7.5C14 9.99 11.99 12 9.5 12C7.01 12 5 9.99 5 7.5C5 5.01 7.01 3 9.5 3C11.99 3 14 5.01 14 7.5ZM2.56 18.94C4.15 16.54 6.67 15 9.5 15C12.33 15 14.85 16.54 16.44 18.94C16.79 19.46 16.96 19.73 16.94 20.06C16.93 20.32 16.76 20.64 16.55 20.8C16.28 21 15.91 21 15.18 21H3.82C3.09 21 2.72 21 2.45 20.8C2.24 20.64 2.07 20.32 2.06 20.06C2.04 19.73 2.21 19.46 2.56 18.94Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      opacity="0.12"
      d="M8 0.5L9.51 4.42C9.72 4.97 9.83 5.25 9.99 5.48C10.14 5.68 10.32 5.86 10.52 6.01C10.75 6.17 11.03 6.28 11.58 6.49L15.5 8L11.58 9.51C11.03 9.72 10.75 9.83 10.52 9.99C10.32 10.14 10.14 10.32 9.99 10.52C9.83 10.75 9.72 11.03 9.51 11.58L8 15.5L6.49 11.58C6.28 11.03 6.17 10.75 6.01 10.52C5.86 10.32 5.68 10.14 5.48 9.99C5.25 9.83 4.97 9.72 4.42 9.51L0.5 8L4.42 6.49C4.97 6.28 5.25 6.17 5.48 6.01C5.68 5.86 5.86 5.68 6.01 5.48C6.17 5.25 6.28 4.97 6.49 4.42L8 0.5Z"
      fill="var(--sidebar-icon-stroke)"
    />
    <path
      d="M8 0.5L9.51 4.42C9.72 4.97 9.83 5.25 9.99 5.48C10.14 5.68 10.32 5.86 10.52 6.01C10.75 6.17 11.03 6.28 11.58 6.49L15.5 8L11.58 9.51C11.03 9.72 10.75 9.83 10.52 9.99C10.32 10.14 10.14 10.32 9.99 10.52C9.83 10.75 9.72 11.03 9.51 11.58L8 15.5L6.49 11.58C6.28 11.03 6.17 10.75 6.01 10.52C5.86 10.32 5.68 10.14 5.48 9.99C5.25 9.83 4.97 9.72 4.42 9.51L0.5 8L4.42 6.49C4.97 6.28 5.25 6.17 5.48 6.01C5.68 5.86 5.86 5.68 6.01 5.48C6.17 5.25 6.28 4.97 6.49 4.42L8 0.5Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      opacity="0.12"
      d="M8.92 16.5C13.06 16.54 16.46 13.22 16.5 9.08C16.54 4.94 13.22 1.54 9.08 1.5C4.94 1.46 1.54 4.78 1.5 8.92C1.46 13.06 4.78 16.46 8.92 16.5Z"
      fill="#212121"
    />
    <path
      d="M6 9L9 12M9 12L12 9M9 12V6M16.5 9C16.5 13.14 13.14 16.5 9 16.5C4.86 16.5 1.5 13.14 1.5 9C1.5 4.86 4.86 1.5 9 1.5C13.14 1.5 16.5 4.86 16.5 9Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MailIcon = (_props: React.SVGProps<SVGSVGElement>) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      opacity="0.12"
      d="M12.68 11.66C12.08 12.08 11.77 12.29 11.44 12.37C11.15 12.45 10.85 12.45 10.56 12.37C10.23 12.29 9.92 12.08 9.32 11.66L1.83 6.42C1.83 4.9 3.06 3.67 4.58 3.67H17.42C18.94 3.67 20.17 4.9 20.17 6.42L12.68 11.66Z"
      fill="#212121"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.83 6.42L9.32 11.66C9.92 12.08 10.23 12.29 10.56 12.37C10.85 12.45 11.15 12.45 11.44 12.37C11.77 12.29 12.08 12.08 12.68 11.66L20.17 6.42M6.23 18.33H15.77C17.31 18.33 18.08 18.33 18.67 18.03C19.18 17.77 19.6 17.35 19.87 16.83C20.17 16.24 20.17 15.47 20.17 13.93V8.07C20.17 6.53 20.17 5.76 19.87 5.17C19.6 4.65 19.18 4.23 18.67 3.97C18.08 3.67 17.31 3.67 15.77 3.67H6.23C4.69 3.67 3.92 3.67 3.33 3.97C2.82 4.23 2.4 4.65 2.13 5.17C1.83 5.76 1.83 6.53 1.83 8.07V13.93C1.83 15.47 1.83 16.24 2.13 16.83C2.4 17.35 2.82 17.77 3.33 18.03C3.92 18.33 4.69 18.33 6.23 18.33Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TeleVisionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2.52 6.19C2.52 4.67 3.75 3.44 5.27 3.44H16.73C18.25 3.44 19.48 4.67 19.48 6.19V12.15C19.48 13.66 18.25 14.9 16.73 14.9H5.27C3.75 14.9 2.52 13.66 2.52 12.15V6.19Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 18.56C14.77 17.97 12.92 17.65 11 17.65C9.08 17.65 7.23 17.97 5.5 18.56"
      stroke="var(--sidebar-icon-stroke)"
      strokeWidth="1.125"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronsLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M18 17L13 12L18 7M11 17L6 12L11 7"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Rounded-corner glyph: top-right corner bracket curving from top edge down the right edge.
export const CornerRadiusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M5 7H11C14.3137 7 17 9.68629 17 13V19"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── Figma "system-flat" customize-panel icons (node 25420:11484), pulled verbatim ── */

/** Theme toggle: light (sun). */
export const LightModeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 17.875 17.875"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M11.7217 6.15327C13.2594 7.69092 13.2594 10.1841 11.7217 11.7217C10.1841 13.2594 7.69092 13.2594 6.15327 11.7217C4.61558 10.1841 4.61558 7.69092 6.15327 6.15327C7.69092 4.61558 10.1841 4.61558 11.7217 6.15327Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.9375 2.375V0.5M8.9375 17.375V15.5M15.5 8.9375H17.375M0.5 8.9375H2.375M4.29711 4.29711L2.97129 2.97129M14.9037 14.9037L13.5779 13.5779M13.5779 4.29711L14.9037 2.9713M2.9713 14.9037L4.29711 13.5779"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Theme toggle: dark (moon). */
export const DarkModeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M15.9361 8.8584C15.1417 9.42 14.1718 9.75 13.125 9.75C10.4326 9.75 8.25 7.56743 8.25 4.875C8.25 3.82812 8.58 2.85831 9.1416 2.06392C9.0945 2.06297 9.04733 2.0625 9 2.0625C5.16853 2.0625 2.0625 5.16853 2.0625 9C2.0625 12.8314 5.16853 15.9375 9 15.9375C12.8314 15.9375 15.9375 12.8314 15.9375 9C15.9375 8.95267 15.9371 8.9055 15.9361 8.8584Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Theme toggle: system (monitor). */
export const SystemModeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2.8125 4.3125C2.8125 3.48407 3.48407 2.8125 4.3125 2.8125H13.6875C14.5159 2.8125 15.1875 3.48407 15.1875 4.3125V12.5625H2.8125V4.3125Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
    <path
      d="M1.3125 12.5625H16.6875V13.6875C16.6875 14.5159 16.0159 15.1875 15.1875 15.1875H2.8125C1.98407 15.1875 1.3125 14.5159 1.3125 13.6875V12.5625Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
  </svg>
);

/** Scope/mode select chevron (up+down), Figma icon/line/select — stroked for crispness at 14px. */
export const SelectChevronIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M4.5 5.25L7 2.75L9.5 5.25M4.5 8.75L7 11.25L9.5 8.75"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Figma icon/line/menu (26153-13886) — "=" two-bar drag handle on ranking option rows. */
export const RankDragHandleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12.5 10C12.7761 10 13 10.2239 13 10.5C13 10.7761 12.7761 11 12.5 11H2.5C2.22386 11 2 10.7761 2 10.5C2 10.2239 2.22386 10 2.5 10H12.5ZM12.5 6C12.7761 6 13 6.22386 13 6.5C13 6.77614 12.7761 7 12.5 7H2.5C2.22386 7 2 6.77614 2 6.5C2 6.22386 2.22386 6 2.5 6H12.5Z"
      fill="currentColor"
    />
  </svg>
);

/** Inline value-select caret — thin stroked chevron-down (Figma's filled caret reads too heavy). */
export const CaretDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3.5 5.5L7 9L10.5 5.5"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Thin stroked chevron-up — matches CaretDownIcon (select dropdown scroll-up). */
export const CaretUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3.5 8.5L7 5L10.5 8.5"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Text alignment toggle — Figma system-flat. */
export const TextAlignLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2.25 3.5625C2.25 3.25184 2.50184 3 2.8125 3H15.1875C15.4982 3 15.75 3.25184 15.75 3.5625C15.75 3.87316 15.4982 4.125 15.1875 4.125H2.8125C2.50184 4.125 2.25 3.87316 2.25 3.5625Z"
      fill="currentColor"
    />
    <path
      d="M2.25 9C2.25 8.68935 2.50184 8.4375 2.8125 8.4375H9.1875C9.49815 8.4375 9.75 8.68935 9.75 9C9.75 9.31065 9.49815 9.5625 9.1875 9.5625H2.8125C2.50184 9.5625 2.25 9.31065 2.25 9Z"
      fill="currentColor"
    />
    <path
      d="M2.25 14.4375C2.25 14.1268 2.50184 13.875 2.8125 13.875H15.1875C15.4982 13.875 15.75 14.1268 15.75 14.4375C15.75 14.7482 15.4982 15 15.1875 15H2.8125C2.50184 15 2.25 14.7482 2.25 14.4375Z"
      fill="currentColor"
    />
  </svg>
);

export const TextAlignCenterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2.25 3.5625C2.25 3.25184 2.50184 3 2.8125 3H15.1875C15.4982 3 15.75 3.25184 15.75 3.5625C15.75 3.87316 15.4982 4.125 15.1875 4.125H2.8125C2.50184 4.125 2.25 3.87316 2.25 3.5625Z"
      fill="currentColor"
    />
    <path
      d="M2.25 9C2.25 8.68935 2.50184 8.4375 2.8125 8.4375H15.1875C15.4982 8.4375 15.75 8.68935 15.75 9C15.75 9.31065 15.4982 9.5625 15.1875 9.5625H2.8125C2.50184 9.5625 2.25 9.31065 2.25 9Z"
      fill="currentColor"
    />
    <path
      d="M2.25 14.4375C2.25 14.1268 2.50184 13.875 2.8125 13.875H15.1875C15.4982 13.875 15.75 14.1268 15.75 14.4375C15.75 14.7482 15.4982 15 15.1875 15H2.8125C2.50184 15 2.25 14.7482 2.25 14.4375Z"
      fill="currentColor"
    />
  </svg>
);

export const TextAlignRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2.25 3.5625C2.25 3.25184 2.50184 3 2.8125 3H15.1875C15.4982 3 15.75 3.25184 15.75 3.5625C15.75 3.87316 15.4982 4.125 15.1875 4.125H2.8125C2.50184 4.125 2.25 3.87316 2.25 3.5625Z"
      fill="currentColor"
    />
    <path
      d="M8.25 9C8.25 8.68935 8.50185 8.4375 8.8125 8.4375H15.1875C15.4982 8.4375 15.75 8.68935 15.75 9C15.75 9.31065 15.4982 9.5625 15.1875 9.5625H8.8125C8.50185 9.5625 8.25 9.31065 8.25 9Z"
      fill="currentColor"
    />
    <path
      d="M2.25 14.4375C2.25 14.1268 2.50184 13.875 2.8125 13.875H15.1875C15.4982 13.875 15.75 14.1268 15.75 14.4375C15.75 14.7482 15.4982 15 15.1875 15H2.8125C2.50184 15 2.25 14.7482 2.25 14.4375Z"
      fill="currentColor"
    />
  </svg>
);
