import React from 'react';
import { Check } from 'lucide-react';

/**
 * Stepper — Multi-step workflow component (Enrolment wizard, Exeat lifecycle, Exam publication).
 */
export default function Stepper({
  steps = [], // [{ id: 'personal', label: 'Personal Info' }, ...]
  currentStep = 0,
  onStepClick = null,
  className = ''
}) {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isUpcoming = idx > currentStep;
          const isClickable = Boolean(onStepClick && (isCompleted || isCurrent));

          return (
            <li
              key={step.id || idx}
              className={`relative flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                onClick={() => isClickable && onStepClick(idx)}
                role={isClickable ? 'button' : undefined}
                className={`group flex items-center gap-2.5 text-xs font-semibold select-none ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold transition-all ${
                    isCompleted
                      ? 'bg-brand-700 text-white'
                      : isCurrent
                        ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
                        : 'bg-line text-muted'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : idx + 1}
                </span>

                <span
                  className={`hidden sm:inline-block font-sans whitespace-nowrap ${
                    isCurrent
                      ? 'text-ink font-bold'
                      : isCompleted
                        ? 'text-ink font-medium'
                        : 'text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 mx-3 h-0.5 rounded transition-colors ${
                    idx < currentStep ? 'bg-brand-700' : 'bg-line'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
