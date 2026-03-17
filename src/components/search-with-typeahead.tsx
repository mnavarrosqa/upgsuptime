"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type MonitorSearchItem = { id: string; name: string; url: string };

type SearchWithTypeaheadProps = {
  monitors: MonitorSearchItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

function matchMonitor(m: MonitorSearchItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)
  );
}

export function SearchWithTypeahead({
  monitors,
  value,
  onChange,
  placeholder = "Search monitors…",
  "aria-label": ariaLabel = "Search monitors by name or URL",
}: SearchWithTypeaheadProps) {
  const [focused, setFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = value.trim()
    ? monitors.filter((m) => matchMonitor(m, value))
    : monitors;
  const showDropdown = focused && matches.length > 0;
  const limitedMatches = matches.slice(0, 10);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const option = listRef.current.children[highlightedIndex];
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) {
      if (e.key === "Escape") inputRef.current?.blur();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < limitedMatches.length - 1 ? i + 1 : i
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
        break;
      case "Escape":
        setHighlightedIndex(-1);
        setFocused(false);
        inputRef.current?.blur();
        break;
      case "Enter":
        if (highlightedIndex >= 0 && limitedMatches[highlightedIndex]) {
          e.preventDefault();
          onChange(limitedMatches[highlightedIndex].name);
          setFocused(false);
          setHighlightedIndex(-1);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() =>
          setTimeout(() => setFocused(false), 150)
        }
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="search-typeahead-list"
        aria-activedescendant={
          highlightedIndex >= 0 && limitedMatches[highlightedIndex]
            ? `search-option-${limitedMatches[highlightedIndex].id}`
            : undefined
        }
        className="w-full rounded-md border border-input-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus"
      />
      {showDropdown && (
        <ul
          id="search-typeahead-list"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-bg-card py-1 shadow-lg"
        >
          {limitedMatches.map((m, i) => (
            <li
              key={m.id}
              id={`search-option-${m.id}`}
              role="option"
              aria-selected={highlightedIndex === i}
              className="group"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-sm text-text-primary hover:text-text-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(m.name);
                    setHighlightedIndex(-1);
                  }}
                >
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {m.url}
                  </span>
                </button>
                <Link
                  href={`/monitors/${m.id}`}
                  className="shrink-0 text-xs text-text-muted hover:text-text-primary"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function filterMonitorsBySearch<T extends MonitorSearchItem>(
  monitors: T[],
  query: string
): T[] {
  if (!query.trim()) return monitors;
  const q = query.trim().toLowerCase();
  return monitors.filter(
    (m) =>
      m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)
  );
}
