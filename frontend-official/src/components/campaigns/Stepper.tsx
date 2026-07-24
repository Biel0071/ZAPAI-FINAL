import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface StepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  className?: string;
}

/**
 * Clickable numeric stepper (−  value  +) for campaign cadence controls.
 * Clamps to [min, max]; the value is also editable by typing.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  hint,
  className,
}: StepperProps) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  const set = (next: number) => {
    if (Number.isFinite(next)) onChange(clamp(next));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/40 p-1">
        <button
          type="button"
          aria-label="Diminuir"
          onClick={() => set(value - step)}
          disabled={value <= min}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        >
          <Minus className="h-4 w-4" weight="bold" />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => set(Number(event.target.value))}
            className="w-full min-w-0 bg-transparent text-center font-display text-base font-bold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix && <span className="flex-shrink-0 text-xs text-muted-foreground">{suffix}</span>}
        </div>
        <button
          type="button"
          aria-label="Aumentar"
          onClick={() => set(value + step)}
          disabled={value >= max}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        >
          <Plus className="h-4 w-4" weight="bold" />
        </button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export default Stepper;
