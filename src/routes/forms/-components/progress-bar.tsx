interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export const ProgressBar = ({ currentStep, totalSteps }: ProgressBarProps) => {
  // Calculate progress as percentage (1-indexed for display)
  const percentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Form progress"
    >
      <div
        className="h-full transition-[width] duration-300 ease-out"
        // Always a colored bar: use the form's accent (--bf-primary, set inside .bf-themed) and fall
        // back to the brand blue when the form has no theme — instead of bg-primary, which collapses
        // to the app's monochrome primary (black in light / white in dark) on unthemed forms.
        style={{ width: `${percentage}%`, backgroundColor: "var(--bf-primary, #2563eb)" }}
      />
    </div>
  );
};
