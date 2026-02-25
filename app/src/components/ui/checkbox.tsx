"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, indeterminate, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    const Icon = indeterminate ? Minus : Check;
    const isActive = checked || indeterminate;

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-border",
            "peer-focus-visible:ring-1 peer-focus-visible:ring-ring",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            isActive && "bg-primary border-primary",
            "flex items-center justify-center transition-colors",
            className
          )}
        >
          {isActive && <Icon className="h-3 w-3 text-primary-foreground" />}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
