import { useEffect, useRef, useState } from 'react';

export interface SelectOption<T extends string | number = number> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange?: (value: T) => void;
  isDarkMode: boolean;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function Select<T extends string | number = number>({
  value,
  options,
  onChange,
  isDarkMode,
  ariaLabel,
  title,
  disabled = false,
  readOnly = false,
  className = '',
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (readOnly) {
    return (
      <span
        aria-label={ariaLabel}
        title={title}
        className={`flex flex-shrink-0 items-center gap-1 text-xs rounded px-1.5 py-0.5 cursor-not-allowed opacity-60 ${
          isDarkMode
            ? 'bg-slate-600 text-gray-200 border border-slate-500'
            : 'bg-white text-gray-700 border border-gray-300'
        }`}
      >
        <span className="tabular-nums">{selected ? selected.label : value}</span>
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={title}
        className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-indigo-400 ${
          isDarkMode
            ? 'bg-slate-600 text-gray-200 border border-slate-500 hover:border-slate-400'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
        } ${disabled ? 'cursor-not-allowed opacity-60 hover:border-slate-500' : ''} ${className}`}
      >
        <span className="tabular-nums whitespace-nowrap">{selected ? selected.label : value}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 top-full mt-1 z-50 min-w-full rounded-md border py-1 shadow-lg ${
            isDarkMode ? 'bg-slate-700 border-slate-500' : 'bg-white border-gray-200'
          }`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange?.(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-2.5 py-1 text-xs tabular-nums text-left whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'text-indigo-500 font-semibold'
                    : isDarkMode
                      ? 'text-gray-200'
                      : 'text-gray-700'
                } ${isDarkMode ? 'hover:bg-slate-600' : 'hover:bg-gray-100'}`}
              >
                {option.label}
                {isSelected && (
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
