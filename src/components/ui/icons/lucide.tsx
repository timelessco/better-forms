import type { LucideProps } from "lucide-react";
import {
  AlertCircle as LucideAlertCircle,
  AlignCenter as LucideAlignCenter,
  AtSign as LucideAtSign,
  AlignLeft as LucideAlignLeft,
  AlignRight as LucideAlignRight,
  ArrowDownToLine as LucideArrowDownToLine,
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  ArrowUpToLine as LucideArrowUpToLine,
  AudioLines as LucideAudioLines,
  Ban as LucideBan,
  Bluetooth as LucideBluetooth,
  Bold as LucideBold,
  Braces as LucideBraces,
  Check as LucideCheck,
  CheckCheck as LucideCheckCheck,
  CheckCircle2 as LucideCheckCircle2,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  ChevronUp as LucideChevronUp,
  ChevronsRight as LucideChevronsRight,
  ChevronsUpDown as LucideChevronsUpDown,
  CircleCheck as LucideCircleCheck,
  CirclePlus as LucideCirclePlus,
  CircleX as LucideCircleX,
  Clock as LucideClock,
  CodeXml as LucideCodeXml,
  CornerDownLeft as LucideCornerDownLeft,
  Crop as LucideCrop,
  Eraser as LucideEraser,
  ExternalLink as LucideExternalLink,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  File as LucideFile,
  FileQuestion as LucideFileQuestion,
  FileText as LucideFileText,
  FileUp as LucideFileUp,
  Film as LucideFilm,
  Filter as LucideFilter,
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  FolderSearch as LucideFolderSearch,
  Globe as LucideGlobe,
  GripHorizontal as LucideGripHorizontal,
  GripVertical as LucideGripVertical,
  DecimalsArrowRight as LucideDecimalsArrowRight,
  Hash as LucideHash,
  HelpCircle as LucideHelpCircle,
  Indent as LucideIndent,
  Info as LucideInfo,
  Italic as LucideItalic,
  Keyboard as LucideKeyboard,
  Languages as LucideLanguages,
  Layout as LucideLayout,
  Link as LucideLink,
  List as LucideList,
  ListCollapse as LucideListCollapse,
  ListOrdered as LucideListOrdered,
  ListTodo as LucideListTodo,
  Loader2 as LucideLoader2,
  Lock as LucideLock,
  MessageSquareText as LucideMessageSquareText,
  Minus as LucideMinus,
  Monitor as LucideMonitor,
  MoreVertical as LucideMoreVertical,
  OctagonX as LucideOctagonX,
  Outdent as LucideOutdent,
  PanelLeft as LucidePanelLeft,
  Pen as LucidePen,
  Pencil as LucidePencil,
  Phone as LucidePhone,
  PencilLine as LucidePencilLine,
  Radical as LucideRadical,
  Redo2 as LucideRedo2,
  RefreshCw as LucideRefreshCw,
  Repeat as LucideRepeat,
  Rocket as LucideRocket,
  RotateCcw as LucideRotateCcw,
  Save as LucideSave,
  Shield as LucideShield,
  Shuffle as LucideShuffle,
  SquareCheck as LucideSquareCheck,
  Strikethrough as LucideStrikethrough,
  Tag as LucideTag,
  Text as LucideText,
  Trash2 as LucideTrash2,
  TriangleAlert as LucideTriangleAlert,
  Underline as LucideUnderline,
  Undo2 as LucideUndo2,
  Unlink as LucideUnlink,
  Upload as LucideUpload,
  User as LucideUser,
  WrapText as LucideWrapText,
  X as LucideX,
} from "lucide-react";

export type { LucideProps };

const createConsistentLucideIcon = (Icon: React.ComponentType<LucideProps>) => {
  // eslint-disable-next-line eslint-plugin-unicorn/consistent-function-scoping -- Icon is captured via JSX
  const ConsistentLucideIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <Icon strokeWidth={1.5} absoluteStrokeWidth {...props} />
  );
  ConsistentLucideIcon.displayName = Icon.displayName || Icon.name || "ConsistentLucideIcon";
  return ConsistentLucideIcon;
};

export const BanIcon = createConsistentLucideIcon(LucideBan);
export const BluetoothIcon = createConsistentLucideIcon(LucideBluetooth);
export const CheckIcon = createConsistentLucideIcon(LucideCheck);
export const CheckCircle2Icon = createConsistentLucideIcon(LucideCheckCircle2);
export const ChevronLeftIcon = createConsistentLucideIcon(LucideChevronLeft);
export const ChevronRightIcon = createConsistentLucideIcon(LucideChevronRight);
export const ChevronUpIcon = createConsistentLucideIcon(LucideChevronUp);
export const ChevronsRightIcon = createConsistentLucideIcon(LucideChevronsRight);
export const CircleCheckIcon = createConsistentLucideIcon(LucideCircleCheck);
export const CirclePlusIcon = createConsistentLucideIcon(LucideCirclePlus);
export const CircleUserRoundIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z"
      fill="var(--sidebar-icon-stroke)"
    />
    <path
      d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14M15 9H15.01M9 9H9.01M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12ZM15.5 9C15.5 9.28 15.28 9.5 15 9.5C14.72 9.5 14.5 9.28 14.5 9C14.5 8.72 14.72 8.5 15 8.5C15.28 8.5 15.5 8.72 15.5 9ZM9.5 9C9.5 9.28 9.28 9.5 9 9.5C8.72 9.5 8.5 9.28 8.5 9C8.5 8.72 8.72 8.5 9 8.5C9.28 8.5 9.5 8.72 9.5 9Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const CircleXIcon = createConsistentLucideIcon(LucideCircleX);
export const ClockIcon = createConsistentLucideIcon(LucideClock);
export const CreditCardIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M2 8.2V10H22V8.2C22 7.08 22 6.52 21.78 6.09C21.59 5.72 21.28 5.41 20.91 5.22C20.48 5 19.92 5 18.8 5H5.2C4.08 5 3.52 5 3.09 5.22C2.72 5.41 2.41 5.72 2.22 6.09C2 6.52 2 7.08 2 8.2Z"
      fill="var(--sidebar-icon-stroke)"
    />
    <path
      d="M22 10H2M11 14H6M2 8.2L2 15.8C2 16.92 2 17.48 2.22 17.91C2.41 18.28 2.72 18.59 3.09 18.78C3.52 19 4.08 19 5.2 19L18.8 19C19.92 19 20.48 19 20.91 18.78C21.28 18.59 21.59 18.28 21.78 17.91C22 17.48 22 16.92 22 15.8V8.2C22 7.08 22 6.52 21.78 6.09C21.59 5.72 21.28 5.41 20.91 5.22C20.48 5 19.92 5 18.8 5L5.2 5C4.08 5 3.52 5 3.09 5.22C2.72 5.41 2.41 5.72 2.22 6.09C2 6.52 2 7.08 2 8.2Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const EyeIcon = createConsistentLucideIcon(LucideEye);
export const EyeOffLucideIcon = createConsistentLucideIcon(LucideEyeOff);
export const FileCodeIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M14 18.6C14 18.04 14 17.76 14.11 17.55C14.2 17.36 14.36 17.2 14.55 17.11C14.76 17 15.04 17 15.6 17H19.4C19.96 17 20.24 17 20.45 17.11C20.64 17.2 20.8 17.36 20.89 17.55C21 17.76 21 18.04 21 18.6V19.4C21 19.96 21 20.24 20.89 20.45C20.8 20.64 20.64 20.8 20.45 20.89C20.24 21 19.96 21 19.4 21H15.6C15.04 21 14.76 21 14.55 20.89C14.36 20.8 14.2 20.64 14.11 20.45C14 20.24 14 19.96 14 19.4V18.6Z"
      fill="var(--sidebar-icon-stroke)"
    />
    <path
      d="M20 10V6.8C20 5.12 20 4.28 19.67 3.64C19.39 3.07 18.93 2.61 18.36 2.33C17.72 2 16.88 2 15.2 2H8.8C7.12 2 6.28 2 5.64 2.33C5.07 2.61 4.61 3.07 4.33 3.64C4 4.28 4 5.12 4 6.8V17.2C4 18.88 4 19.72 4.33 20.36C4.61 20.93 5.07 21.39 5.64 21.67C6.28 22 7.12 22 8.8 22H10.5M13 11H8M11 15H8M16 7H8M19.25 17V15.25C19.25 14.28 18.47 13.5 17.5 13.5C16.53 13.5 15.75 14.28 15.75 15.25V17M15.6 21H19.4C19.96 21 20.24 21 20.45 20.89C20.64 20.8 20.8 20.64 20.89 20.45C21 20.24 21 19.96 21 19.4V18.6C21 18.04 21 17.76 20.89 17.55C20.8 17.36 20.64 17.2 20.45 17.11C20.24 17 19.96 17 19.4 17H15.6C15.04 17 14.76 17 14.55 17.11C14.36 17.2 14.2 17.36 14.11 17.55C14 17.76 14 18.04 14 18.6V19.4C14 19.96 14 20.24 14.11 20.45C14.2 20.64 14.36 20.8 14.55 20.89C14.76 21 15.04 21 15.6 21Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const FileIcon = createConsistentLucideIcon(LucideFile);
export const FileQuestionIcon = createConsistentLucideIcon(LucideFileQuestion);
export const FileTextIcon = createConsistentLucideIcon(LucideFileText);
export const FilterIcon = createConsistentLucideIcon(LucideFilter);
export const FolderIcon = createConsistentLucideIcon(LucideFolder);
export const FolderOpenIcon = createConsistentLucideIcon(LucideFolderOpen);
export const FolderSearchIcon = createConsistentLucideIcon(LucideFolderSearch);
export const HelpCircleIcon = createConsistentLucideIcon(LucideHelpCircle);
export const ImageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g opacity="0.12">
      <path
        d="M5.67 7C6.4 7 7 6.4 7 5.67C7 4.93 6.4 4.33 5.67 4.33C4.93 4.33 4.33 4.93 4.33 5.67C4.33 6.4 4.93 7 5.67 7Z"
        fill="var(--sidebar-icon-stroke)"
      />
      <path
        d="M14.27 10.27C13.34 12.83 10.88 14.67 8 14.67C6.5 14.67 5.11 14.17 4 13.33L9.91 7.42C10.18 7.16 10.31 7.03 10.46 6.98C10.59 6.93 10.74 6.93 10.87 6.98C11.02 7.03 11.16 7.16 11.42 7.42L14.27 10.27Z"
        fill="var(--sidebar-icon-stroke)"
      />
    </g>
    <path
      d="M4 13.33L9.91 7.42C10.18 7.16 10.31 7.03 10.46 6.98C10.59 6.93 10.74 6.93 10.87 6.98C11.02 7.03 11.16 7.16 11.42 7.42L14.27 10.27M7 5.67C7 6.4 6.4 7 5.67 7C4.93 7 4.33 6.4 4.33 5.67C4.33 4.93 4.93 4.33 5.67 4.33C6.4 4.33 7 4.93 7 5.67ZM14.67 8C14.67 11.68 11.68 14.67 8 14.67C4.32 14.67 1.33 11.68 1.33 8C1.33 4.32 4.32 1.33 8 1.33C11.68 1.33 14.67 4.32 14.67 8Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeLinecap="round"
      strokeWidth="var(--stroke-width)"
      strokeLinejoin="round"
    />
  </svg>
);
// Figma icon/line/image (node I25424:12047): filled "Union" photo-frame glyph (rounded rect + sun +
// mountain), 14×13 path inset in a 16px box. Used for the Cover upload row. currentColor = gray/700.
export const ImageLineIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      transform="translate(1 1.5)"
      d="M11.5 0C12.8807 0 14 1.11929 14 2.5V10.5C14 11.8807 12.8807 13 11.5 13H2.5L2.24414 12.9873C0.983608 12.8592 0 11.7943 0 10.5V2.5C1.28853e-07 1.11929 1.11929 0 2.5 0H11.5ZM3.48828 12H11.5C12.3284 12 13 11.3284 13 10.5V8.93066C12.9948 8.92762 12.9886 8.9261 12.9834 8.92285L9.21582 6.55273L3.48828 12ZM2.5 1C1.67157 1 1 1.67157 1 2.5V10.5C1 11.1914 1.46822 11.7716 2.10449 11.9453C2.1199 11.9254 2.13646 11.9056 2.15527 11.8877L8.58398 5.77441L8.70215 5.67969C8.95196 5.51181 9.27083 5.4803 9.54883 5.5957L9.68359 5.66504L13 7.75098V2.5C13 1.67157 12.3284 1 11.5 1H2.5ZM4.25 2.5C5.2165 2.5 6 3.2835 6 4.25C6 5.2165 5.2165 6 4.25 6C3.2835 6 2.5 5.2165 2.5 4.25C2.5 3.2835 3.2835 2.5 4.25 2.5ZM4.25 3.5C3.83579 3.5 3.5 3.83579 3.5 4.25C3.5 4.66421 3.83579 5 4.25 5C4.66421 5 5 4.66421 5 4.25C5 3.83579 4.66421 3.5 4.25 3.5Z"
      fill="currentColor"
    />
  </svg>
);
export const InfoIcon = createConsistentLucideIcon(LucideInfo);
export const KeyboardIcon = createConsistentLucideIcon(LucideKeyboard);
export const LanguagesIcon = createConsistentLucideIcon(LucideLanguages);
export const LayoutIcon = createConsistentLucideIcon(LucideLayout);
export const Loader2Icon = createConsistentLucideIcon(LucideLoader2);
export const LockIcon = createConsistentLucideIcon(LucideLock);
export const LogOutIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M21 16.2V7.8C21 6.12 21 5.28 20.67 4.64C20.39 4.07 19.93 3.61 19.36 3.33C18.72 3 17.88 3 16.2 3H15V21H16.2C17.88 21 18.72 21 19.36 20.67C19.93 20.39 20.39 19.93 20.67 19.36C21 18.72 21 17.88 21 16.2Z"
      fill="currentColor"
    />
    <path
      d="M15 3H16.2C17.88 3 18.72 3 19.36 3.33C19.93 3.61 20.39 4.07 20.67 4.64C21 5.28 21 6.12 21 7.8V16.2C21 17.88 21 18.72 20.67 19.36C20.39 19.93 19.93 20.39 19.36 20.67C18.72 21 17.88 21 16.2 21H15M10 7L15 12M15 12L10 17M15 12L3 12"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const MinusIcon = createConsistentLucideIcon(LucideMinus);
export const MonitorIcon = createConsistentLucideIcon(LucideMonitor);
export const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M22 15.84C20.69 16.44 19.23 16.77 17.69 16.77C11.92 16.77 7.23 12.08 7.23 6.31C7.23 4.77 7.56 3.31 8.16 2C4.53 3.64 2 7.29 2 11.54C2 17.32 6.68 22 12.46 22C16.71 22 20.36 19.47 22 15.84Z"
      fill="currentColor"
    />
    <path
      d="M22 15.84C20.69 16.44 19.23 16.77 17.69 16.77C11.92 16.77 7.23 12.08 7.23 6.31C7.23 4.77 7.56 3.31 8.16 2C4.53 3.64 2 7.29 2 11.54C2 17.32 6.68 22 12.46 22C16.71 22 20.36 19.47 22 15.84Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const MoreVerticalIcon = createConsistentLucideIcon(LucideMoreVertical);
export const OctagonXIcon = createConsistentLucideIcon(LucideOctagonX);
export const PaletteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Palette from Figma system-flat (node 25690:11485) */}
    <path
      opacity="0.12"
      transform="translate(1.5 1.5)"
      d="M0 7.5C0 11.6421 3.35786 15 7.5 15C8.74264 15 9.75 13.9926 9.75 12.75V12.375C9.75 12.0267 9.75 11.8525 9.76925 11.7063C9.90217 10.6967 10.6967 9.90217 11.7063 9.76925C11.8525 9.75 12.0267 9.75 12.375 9.75H12.75C13.9926 9.75 15 8.74264 15 7.5C15 3.35786 11.6421 0 7.5 0C3.35786 0 0 3.35786 0 7.5Z"
      fill="currentColor"
    />
    <g
      transform="translate(1 1)"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M0.5 8C0.5 12.1421 3.85786 15.5 8 15.5C9.24264 15.5 10.25 14.4926 10.25 13.25V12.875C10.25 12.5267 10.25 12.3525 10.2692 12.2063C10.4022 11.1967 11.1967 10.4022 12.2063 10.2692C12.3525 10.25 12.5267 10.25 12.875 10.25H13.25C14.4926 10.25 15.5 9.24264 15.5 8C15.5 3.85786 12.1421 0.5 8 0.5C3.85786 0.5 0.5 3.85786 0.5 8Z" />
      <path d="M4.25 8.75C4.66421 8.75 5 8.41421 5 8C5 7.58579 4.66421 7.25 4.25 7.25C3.83579 7.25 3.5 7.58579 3.5 8C3.5 8.41421 3.83579 8.75 4.25 8.75Z" />
      <path d="M11 5.75C11.4142 5.75 11.75 5.41421 11.75 5C11.75 4.58579 11.4142 4.25 11 4.25C10.5858 4.25 10.25 4.58579 10.25 5C10.25 5.41421 10.5858 5.75 11 5.75Z" />
      <path d="M6.5 5C6.91421 5 7.25 4.66421 7.25 4.25C7.25 3.83579 6.91421 3.5 6.5 3.5C6.08579 3.5 5.75 3.83579 5.75 4.25C5.75 4.66421 6.08579 5 6.5 5Z" />
    </g>
  </svg>
);
export const PanelLeftIcon = createConsistentLucideIcon(LucidePanelLeft);
export const PencilIcon = createConsistentLucideIcon(LucidePencil);
export const RefreshCwIcon = createConsistentLucideIcon(LucideRefreshCw);
export const RepeatIcon = createConsistentLucideIcon(LucideRepeat);
export const RocketIcon = createConsistentLucideIcon(LucideRocket);
export const RotateCcwIcon = createConsistentLucideIcon(LucideRotateCcw);
export const SaveIcon = createConsistentLucideIcon(LucideSave);
export const ShieldIcon = createConsistentLucideIcon(LucideShield);
export const ShuffleIcon = createConsistentLucideIcon(LucideShuffle);
export const SmileIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z"
      fill="currentColor"
    />
    <path
      d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14M15 9H15.01M9 9H9.01M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12ZM15.5 9C15.5 9.28 15.28 9.5 15 9.5C14.72 9.5 14.5 9.28 14.5 9C14.5 8.72 14.72 8.5 15 8.5C15.28 8.5 15.5 8.72 15.5 9ZM9.5 9C9.5 9.28 9.28 9.5 9 9.5C8.72 9.5 8.5 9.28 8.5 9C8.5 8.72 8.72 8.5 9 8.5C9.28 8.5 9.5 8.72 9.5 9Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M11 1V3M11 19V21M3 11H1M5.31 5.31L3.9 3.9M16.69 5.31L18.1 3.9M5.31 16.69L3.9 18.1M16.69 16.69L18.1 18.1M21 11H19M16 11C16 13.76 13.76 16 11 16C8.24 16 6 13.76 6 11C6 8.24 8.24 6 11 6C13.76 6 16 8.24 16 11Z"
      stroke="var(--sidebar-icon-stroke)"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const TagIcon = createConsistentLucideIcon(LucideTag);
export const Trash2Icon = createConsistentLucideIcon(LucideTrash2);
export const TriangleAlertIcon = createConsistentLucideIcon(LucideTriangleAlert);
export const UploadIcon = createConsistentLucideIcon(LucideUpload);
export const UserIcon = createConsistentLucideIcon(LucideUser);
export const XIcon = createConsistentLucideIcon(LucideX);

export const AlignCenterIcon = createConsistentLucideIcon(LucideAlignCenter);
export const AlignLeftIcon = createConsistentLucideIcon(LucideAlignLeft);
export const AlignRightIcon = createConsistentLucideIcon(LucideAlignRight);
export const ArrowDownToLineIcon = createConsistentLucideIcon(LucideArrowDownToLine);
export const ArrowLeftIcon = createConsistentLucideIcon(LucideArrowLeft);
export const ArrowRightIcon = createConsistentLucideIcon(LucideArrowRight);
export const ArrowUpToLineIcon = createConsistentLucideIcon(LucideArrowUpToLine);
export const AudioLinesIcon = createConsistentLucideIcon(LucideAudioLines);
export const BoldIcon = createConsistentLucideIcon(LucideBold);
export const BracesIcon = createConsistentLucideIcon(LucideBraces);
export const CodeXmlIcon = createConsistentLucideIcon(LucideCodeXml);
export const CornerDownLeftIcon = createConsistentLucideIcon(LucideCornerDownLeft);
export const CropIcon = createConsistentLucideIcon(LucideCrop);
export const EraserIcon = createConsistentLucideIcon(LucideEraser);
export const ExternalLinkIcon = createConsistentLucideIcon(LucideExternalLink);
export const FileUpIcon = createConsistentLucideIcon(LucideFileUp);
export const FilmIcon = createConsistentLucideIcon(LucideFilm);
export const GlobeIcon = createConsistentLucideIcon(LucideGlobe);
export const GripHorizontalIcon = createConsistentLucideIcon(LucideGripHorizontal);
export const GripVerticalIcon = createConsistentLucideIcon(LucideGripVertical);
export const IndentIcon = createConsistentLucideIcon(LucideIndent);
export const ItalicIcon = createConsistentLucideIcon(LucideItalic);
export const LinkIcon = createConsistentLucideIcon(LucideLink);
export const ListIcon = createConsistentLucideIcon(LucideList);
export const ListCollapseIcon = createConsistentLucideIcon(LucideListCollapse);
export const ListOrderedIcon = createConsistentLucideIcon(LucideListOrdered);
export const ListTodoIcon = createConsistentLucideIcon(LucideListTodo);
export const MessageSquareTextIcon = createConsistentLucideIcon(LucideMessageSquareText);
export const OutdentIcon = createConsistentLucideIcon(LucideOutdent);
export const PencilLineIcon = createConsistentLucideIcon(LucidePencilLine);
export const PenIcon = createConsistentLucideIcon(LucidePen);
export const RadicalIcon = createConsistentLucideIcon(LucideRadical);
export const Redo2Icon = createConsistentLucideIcon(LucideRedo2);
export const StrikethroughIcon = createConsistentLucideIcon(LucideStrikethrough);
export const TextIcon = createConsistentLucideIcon(LucideText);
export const UnderlineIcon = createConsistentLucideIcon(LucideUnderline);
export const Undo2Icon = createConsistentLucideIcon(LucideUndo2);
export const UnlinkIcon = createConsistentLucideIcon(LucideUnlink);
export const WrapTextIcon = createConsistentLucideIcon(LucideWrapText);
export const AlertCircleIcon = createConsistentLucideIcon(LucideAlertCircle);
export const AtSignIcon = createConsistentLucideIcon(LucideAtSign);
export const HashIcon = createConsistentLucideIcon(LucideHash);
export const DecimalsArrowRightIcon = createConsistentLucideIcon(LucideDecimalsArrowRight);
export const PhoneIcon = createConsistentLucideIcon(LucidePhone);
export const LeftChevronIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Left chevron from Figma system-flat (node 25408:9024) */}
    <path
      transform="translate(10.5 13.5) rotate(180)"
      d="M0.146446 0.146446C0.341708 -0.0488156 0.658215 -0.0488153 0.853477 0.146446L5.85348 5.14645C6.04874 5.34171 6.04874 5.65822 5.85348 5.85348L0.853477 10.8535C0.658215 11.0487 0.341708 11.0487 0.146446 10.8535C-0.0488154 10.6582 -0.0488154 10.3417 0.146446 10.1464L4.79293 5.49996L0.146446 0.853478C-0.0488154 0.658216 -0.0488154 0.341708 0.146446 0.146446Z"
      fill="currentColor"
    />
  </svg>
);
export const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Play from Figma system-flat (node 26017:5673) */}
    <path
      opacity="0.12"
      d="M4.75 3.74213C4.75 3.01376 4.75 2.64958 4.90187 2.44882C5.03417 2.27393 5.23639 2.1657 5.4553 2.15263C5.70658 2.13763 6.0096 2.33964 6.61564 2.74367L14.5023 8.00145C15.0031 8.3353 15.2535 8.50222 15.3407 8.71261C15.417 8.89655 15.417 9.10328 15.3407 9.28722C15.2535 9.49761 15.0031 9.66453 14.5023 9.99837L6.61564 15.2562C6.0096 15.6602 5.70658 15.8622 5.4553 15.8472C5.23639 15.8341 5.03417 15.7259 4.90187 15.551C4.75 15.3503 4.75 14.9861 4.75 14.2577V3.74213Z"
      fill="currentColor"
    />
    <path
      d="M4.75 3.74213C4.75 3.01376 4.75 2.64958 4.90187 2.44882C5.03417 2.27393 5.23639 2.1657 5.4553 2.15263C5.70658 2.13763 6.0096 2.33964 6.61564 2.74367L14.5023 8.00145C15.0031 8.3353 15.2535 8.50222 15.3407 8.71261C15.417 8.89655 15.417 9.10328 15.3407 9.28722C15.2535 9.49761 15.0031 9.66453 14.5023 9.99837L6.61564 15.2562C6.0096 15.6602 5.70658 15.8622 5.4553 15.8472C5.23639 15.8341 5.03417 15.7259 4.90187 15.551C4.75 15.3503 4.75 14.9861 4.75 14.2577V3.74213Z"
      stroke="currentColor"
      strokeWidth="var(--stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const SquareCheckIcon = createConsistentLucideIcon(LucideSquareCheck);
export const CheckCheckIcon = createConsistentLucideIcon(LucideCheckCheck);
export const ChevronsUpDownIcon = createConsistentLucideIcon(LucideChevronsUpDown);
