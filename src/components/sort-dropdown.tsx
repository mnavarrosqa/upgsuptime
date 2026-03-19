"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";

interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  options: SortOption[];
  value: string;
  direction: "asc" | "desc";
  onChange: (value: string, direction: "asc" | "desc") => void;
  label?: string;
}

export function SortDropdown({
  options,
  value,
  direction,
  onChange,
  label = "Sort",
}: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentOption = options.find((opt) => opt.value === value);
  const displayLabel = currentOption?.label || label;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex].value);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  function handleSelect(optionValue: string) {
    if (optionValue === value) {
      // Toggle direction if clicking the same option
      onChange(optionValue, direction === "asc" ? "desc" : "asc");
    } else {
      // Select new option with default ascending direction
      onChange(optionValue, "asc");
    }
    setOpen(false);
  }

  function toggleDirection() {
    onChange(value, direction === "asc" ? "desc" : "asc");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-text-muted hover:bg-bg-page hover:text-text-primary"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${label} by ${displayLabel}, ${direction === "asc" ? "ascending" : "descending"}`}
      >
        <span>{label}:</span>
        <span className="font-medium text-text-primary">{displayLabel}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
        {direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-bg-card py-1 shadow-lg"
          role="menu"
          aria-label="Sort options"
        >
          {options.map((option, index) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-bg-page ${
                  index === highlightedIndex ? "bg-bg-page" : ""
                } ${isActive ? "font-medium text-text-primary" : "text-text-muted"}`}
                onClick={() => handleSelect(option.value)}
                aria-current={isActive}
              >
                <span>{option.label}</span>
                {isActive && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    {direction === "asc" ? (
                      <ChevronUp className="h-3 w-3" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3 w-3" aria-hidden />
                    )}
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-page"
            onClick={toggleDirection}
          >
            {direction === "asc" ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                <span>Ascending</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                <span>Descending</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
