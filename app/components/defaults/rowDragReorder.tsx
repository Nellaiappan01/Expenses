"use client";

import { useRef, type PointerEvent } from "react";

export function GripIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="7" r="1.4" />
      <circle cx="15" cy="7" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17" r="1.4" />
      <circle cx="15" cy="17" r="1.4" />
    </svg>
  );
}

export function useRowDragReorder(onMove: (from: number, to: number) => void, count: number) {
  const fromRef = useRef<number | null>(null);
  const lastY = useRef(0);

  function dragHandleProps(index: number) {
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        fromRef.current = index;
        lastY.current = e.clientY;
      },
      onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
        const from = fromRef.current;
        if (from == null) return;
        const dy = e.clientY - lastY.current;
        if (Math.abs(dy) < 26) return;
        const to = from + (dy > 0 ? 1 : -1);
        lastY.current = e.clientY;
        if (to < 0 || to >= count) return;
        onMove(from, to);
        fromRef.current = to;
      },
      onPointerUp: () => {
        fromRef.current = null;
      },
      onPointerCancel: () => {
        fromRef.current = null;
      },
    };
  }

  return { dragHandleProps };
}
