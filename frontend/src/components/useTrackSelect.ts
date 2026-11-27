"use client";

import { useRef, useState } from "react";

/** Vertical distance (px) the pointer may stray from the track before the press is cancelled. */
const CANCEL_SLOP = 32;

/**
 * Press-and-drag selection over a row of equal-width slots (iOS segmented control, iOS 26 tab bar).
 *
 * - Responds on pointer-down: the selection previews the slot under the pointer immediately.
 * - Tracks the pointer while held, slot by slot; commits on release (touch-up), not on down.
 * - Dragging well off the track cancels and the selection springs back to where it was.
 * - Vertical scroll stays with the browser (touch-action: pan-y), which cancels the press.
 *
 * `onClickCapture` must go on each slot: it swallows only the click that follows a press handled
 * here, so keyboard, assistive-technology and modified clicks (open in new tab) behave natively.
 * `index` may be -1 (nothing selected); then a press on any slot commits.
 */
export function useTrackSelect(count: number, index: number, onCommit: (i: number) => void) {
  const [preview, setPreview] = useState<number | null>(null);
  const pointer = useRef<number | null>(null);
  /** Set when a handled press ends, so the click the browser sends next is not acted on twice. */
  const handled = useRef(false);

  const slotAt = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientY < r.top - CANCEL_SLOP || e.clientY > r.bottom + CANCEL_SLOP) return null;
    const i = Math.floor(((e.clientX - r.left) / r.width) * count);
    return Math.min(count - 1, Math.max(0, i));
  };
  const end = () => {
    pointer.current = null;
    setPreview(null);
  };

  const track = {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      pointer.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPreview(slotAt(e));
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (pointer.current === e.pointerId) setPreview(slotAt(e));
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      if (pointer.current !== e.pointerId) return;
      const i = slotAt(e);
      end();
      handled.current = true;
      window.setTimeout(() => (handled.current = false), 0);
      if (i != null && i !== index) onCommit(i);
    },
    onPointerCancel: end,
    onLostPointerCapture: end,
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!handled.current) return;
    handled.current = false;
    e.preventDefault(); // no link navigation
    e.stopPropagation(); // no onClick either: the release already committed the slot it ended on
  };

  /** Arrow keys move the selection (roving focus within a radiogroup / tablist). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + count) % count;
    onCommit(next);
    e.currentTarget.querySelectorAll<HTMLElement>("[data-slot]")[next]?.focus();
  };

  const shown = preview ?? index;
  return { shown, pressed: preview != null, track, onClickCapture, onKeyDown };
}
