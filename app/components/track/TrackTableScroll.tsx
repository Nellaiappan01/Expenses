"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STATUS_COL_PX = 112;

export default function TrackTableScroll({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setPaneWidth(w > 0 ? w + STATUS_COL_PX : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="track-table-scroll"
      style={{
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        maxWidth: "100%",
      }}
    >
      <div
        className="track-table-pane"
        style={{
          width: paneWidth || "100%",
          minWidth: paneWidth || "32rem",
        }}
      >
        {children}
      </div>
    </div>
  );
}
