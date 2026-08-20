import React, { useEffect, useMemo, useRef, useState } from "react";
import CastPortrait from "./CastPortrait";
import {
  describeCastMember,
  filterCastOptions,
  summariseCastMember,
  type CastOption,
} from "../src/utils/castProfiles";

interface CastPickerProps {
  options: CastOption[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Names already used elsewhere, flagged rather than hidden so the clash is visible. */
  takenNames?: string[];
  className?: string;
  id?: string;
}

const Avatar: React.FC<{ name: string; portraitUrl?: string | null; fallback?: string }> = ({
  name,
  portraitUrl,
  fallback,
}) => {
  return (
    <span className="avatar-ring premium-avatar-xs rounded-full overflow-hidden border border-transparent bg-black/20 flex items-center justify-center flex-shrink-0">
      <CastPortrait
        name={name}
        portraitUrl={portraitUrl}
        imgClassName="h-full w-full object-cover"
        fallback={
          <span className="text-xs font-semibold text-[color:var(--text)]">
            {name ? name.charAt(0) : fallback ?? "?"}
          </span>
        }
      />
    </span>
  );
};

/**
 * Cast selector showing who each person actually is.
 *
 * A plain <select> of names worked when the cast were celebrities and the name
 * carried its own recognition. With an all-civilian cast it asks players to
 * choose between twenty-two strangers, so this surfaces age, occupation and
 * hometown, and lets you search on any of them.
 */
const CastPicker: React.FC<CastPickerProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Choose player...",
  takenNames = [],
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.name === value),
    [options, value]
  );

  const visible = useMemo(() => filterCastOptions(options, query), [options, query]);
  const taken = useMemo(() => new Set(takenNames), [takenNames]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Focus after paint so the list is mounted and the caret lands correctly.
      const raf = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const commit = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[activeIndex];
      if (option && !option.isEliminated) commit(option.name);
    }
  };

  const summary = selected ? summariseCastMember(selected) : "";

  return (
    <div ref={rootRef} className={`premium-cast-picker ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="premium-cast-picker-trigger field-soft w-full text-left px-3 py-2 text-sm disabled:opacity-60"
      >
        {selected ? (
          <span className="flex flex-col leading-tight min-w-0">
            <span className="truncate font-medium">{selected.name}</span>
            {summary && (
              <span className="truncate text-[11px] opacity-65">{summary}</span>
            )}
          </span>
        ) : (
          <span className="opacity-60">{placeholder}</span>
        )}
      </button>

      {isOpen && !disabled && (
        <div className="premium-cast-picker-popover" role="dialog">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search name, job, or hometown"
            className="field-soft w-full px-3 py-2 text-sm"
            aria-label="Search cast"
          />

          <ul className="premium-cast-picker-list" role="listbox">
            {visible.length === 0 && (
              <li className="px-3 py-3 text-[12px] opacity-60">
                Nobody matches &ldquo;{query}&rdquo;.
              </li>
            )}

            {visible.map((option, index) => {
              const isSelected = option.name === value;
              const isTaken = taken.has(option.name) && !isSelected;
              const detail = describeCastMember(option);

              return (
                <li key={option.name} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    disabled={option.isEliminated}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option.name)}
                    className={`premium-cast-picker-option ${
                      index === activeIndex ? "is-active" : ""
                    } ${isSelected ? "is-selected" : ""} ${
                      option.isEliminated ? "is-eliminated" : ""
                    }`}
                  >
                    <Avatar name={option.name} portraitUrl={option.portraitUrl} />
                    <span className="flex flex-col min-w-0 text-left">
                      <span className="truncate text-sm font-medium">
                        {option.name}
                        {option.isEliminated && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide opacity-60">
                            Out
                          </span>
                        )}
                        {isTaken && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide opacity-60">
                            Already picked
                          </span>
                        )}
                      </span>
                      {detail && (
                        <span className="truncate text-[11px] opacity-65">{detail}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CastPicker;
