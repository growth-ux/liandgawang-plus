import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SpotPrice } from "../zhan/types";

export default function MarketRegionSelect({
  spots,
  value,
  onChange,
}: {
  spots: SpotPrice[];
  value: string;
  onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = spots.findIndex((spot) => spot.spot_code === value);
  const current = spots[selected];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function choose(index: number) {
    const spot = spots[index];
    if (!spot) return;
    setOpen(false);
    if (spot.spot_code !== value) onChange(spot.spot_code);
    trigger.current?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(spots.length - 1);
      else if (!open) setActive(Math.max(0, selected));
      else setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + spots.length) % spots.length);
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div className="pw-region-select" ref={root}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={trigger} type="button" className="pw-region-trigger" role="combobox"
        aria-label="行情地区" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={!spots.length} onKeyDown={handleKey}
        onClick={() => { setActive(Math.max(0, selected)); setOpen(!open); }}>
        <span>{current?.region_name ?? "山东区域"}</span>
        <span className="pw-region-price-kind">成交价</span>
        <i className="pw-region-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="pw-region-options" id={listId} role="listbox" aria-label="行情地区">
          {spots.map((spot, index) => (
            <div key={spot.spot_code} id={`${listId}-${index}`} role="option"
              aria-selected={spot.spot_code === value} data-active={active === index}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}>
              <span>{spot.region_name}</span>
              <span className="pw-region-price-kind">成交价</span>
              <span className="pw-region-check" aria-hidden="true">{spot.spot_code === value ? "✓" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
