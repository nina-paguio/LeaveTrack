"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { controlClass } from "@/components/ui/form-field";
import { filterEmployees } from "@/lib/leave/employee-search";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  id: string;
  /** Name of the hidden input that carries the chosen value in a form. The typed text is never sent. */
  name: string;
  options: ComboboxOption[];
  /** The chosen option's value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A single-select combobox: type to narrow the list, pick one option. Follows the WAI-ARIA combobox
 * pattern (focus stays on the input; the highlighted option is named by aria-activedescendant).
 * It only narrows what is shown; typed text that is not picked from the list is not a selection.
 */
export function Combobox({
  id,
  name,
  options,
  value,
  onChange,
  placeholder,
  invalid,
  "aria-describedby": describedBy,
  inputRef,
}: ComboboxProps) {
  const listId = `${useId()}-list`;
  const [open, setOpen] = useState(false);
  // null: not typing, so the input shows the chosen option's label.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLLIElement | null>(null);

  const selected = options.find((o) => o.value === value);
  const shown = filterEmployees(
    options.map((o) => ({ ...o, name: o.label })),
    query ?? "",
  );
  const activeIndex = shown.length ? Math.min(active, shown.length - 1) : -1;

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (open) return;
    const at = shown.findIndex((o) => o.value === value);
    setActive(at >= 0 ? at : 0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActive(shown.length ? (activeIndex + 1) % shown.length : 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActive(shown.length ? (activeIndex - 1 + shown.length) % shown.length : 0);
        break;
      case "Home":
        if (open && shown.length) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && shown.length) {
          event.preventDefault();
          setActive(shown.length - 1);
        }
        break;
      case "Enter":
        // Only swallow Enter while choosing; with the list closed it submits the form as usual.
        if (open) {
          event.preventDefault();
          const option = shown[activeIndex];
          if (option) choose(option);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={query ?? selected?.label ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          // Emptying the box clears the choice, so an old employee is never left selected unseen.
          if (!e.target.value.trim() && value) onChange("");
        }}
        onClick={openList}
        onFocus={openList}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={cn(controlClass(invalid), "pr-10")}
      />
      <IconChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Employees"
        hidden={!open}
        className="mt-1 max-h-48 w-full overflow-auto sm:absolute sm:z-20 sm:max-h-60 rounded-md border border-border bg-surface py-1 shadow-md"
      >
        {shown.map((option, i) => {
          const isActive = i === activeIndex;
          const isSelected = option.value === value;
          return (
            <li
              key={option.value}
              id={`${id}-opt-${i}`}
              ref={isActive ? activeRef : undefined}
              role="option"
              aria-selected={isSelected}
              // mousedown would blur the input (closing the list) before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-base sm:text-sm pointer-coarse:text-base",
                isActive && "bg-primary-soft",
                isSelected && "font-medium",
              )}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {isSelected ? <IconCheck size={16} aria-hidden="true" className="shrink-0" /> : null}
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li role="presentation" className="px-3 py-3 text-sm text-muted">
            No employees match.
          </li>
        ) : null}
      </ul>
      <div role="status" aria-live="polite" className="sr-only">
        {open ? (shown.length ? `${shown.length} employees` : "No employees match") : ""}
      </div>
    </div>
  );
}
