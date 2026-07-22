import { useEffect, useRef, useState } from 'react';

// Reusable searchable dropdown for the Pile No. / Station / BS pickers.
// options: [{ value, label, secondary? }]. trailingOption (optional): an
// always-visible extra row appended after the filtered list (e.g. the
// "+ Add new station" action), unaffected by the search filter.
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  trailingOption = null,
  emptyText = 'No matches · ไม่พบ',
  error = false,
}) {
  const [query, setQuery] = useState(null); // null = show selected label; string = actively searching
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  useEffect(() => {
    setQuery(null);
    setOpen(false);
  }, [value]);

  const selected = options.find((o) => o.value === value) ?? null;
  const displayText = query !== null ? query : (selected?.label ?? '');

  const filtered = (query ?? '').trim() === ''
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const list = trailingOption ? [...filtered, trailingOption] : filtered;

  useEffect(() => {
    if (activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function selectOption(opt) {
    onChange(opt.value);
    setQuery(null);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function handleFocus() {
    setOpen(true);
    setQuery('');
    setActiveIndex(-1);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
    setActiveIndex(0);
  }

  function handleBlur() {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && list[activeIndex]) {
        e.preventDefault();
        selectOption(list[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(null);
        setActiveIndex(-1);
      }
    }
  }

  return (
    <div className="search-select">
      <input
        ref={inputRef}
        type="text"
        className={error ? 'input-error' : undefined}
        value={displayText}
        onFocus={handleFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul className="search-select-list" role="listbox">
          {list.length === 0 && <li className="search-select-empty">{emptyText}</li>}
          {list.map((opt, i) => (
            <li
              key={opt.value}
              ref={(el) => { optionRefs.current[i] = el; }}
              role="option"
              aria-selected={opt.value === value}
              className={`search-select-option${i === activeIndex ? ' active' : ''}${opt.value === value ? ' selected' : ''}${opt.action ? ' action' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="ss-label">{opt.label}</span>
              {opt.secondary && <span className="ss-secondary">{opt.secondary}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
