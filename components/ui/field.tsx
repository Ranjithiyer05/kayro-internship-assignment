import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-muted/70 transition-colors hover:border-forest/40 focus:border-forest focus:outline-none focus:ring-3 focus:ring-forest/15 aria-[invalid=true]:border-noshow aria-[invalid=true]:ring-noshow/15";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

// Label, input, hint and error wired together for screen readers.
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
        className={inputClass}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-noshow">
          {error}
        </p>
      )}
    </div>
  );
});
