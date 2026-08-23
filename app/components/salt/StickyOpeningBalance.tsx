"use client";

import { useEffect, useRef, useState } from "react";
import OpeningBalanceCard from "./OpeningBalanceCard";

export default function StickyOpeningBalance({
  refreshTrigger = 0,
}: {
  refreshTrigger?: number;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => setBarHeight(bar.offsetHeight);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [pinned]);

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />

      {pinned && barHeight > 0 ? (
        <div style={{ height: barHeight }} className="shrink-0" aria-hidden />
      ) : null}

      <div
        ref={barRef}
        className={
          pinned
            ? "fixed inset-x-0 top-0 z-40 border-b border-[#D6E6F5] bg-[#F4F8FC] pt-[env(safe-area-inset-top)] shadow-lg"
            : "relative z-10"
        }
      >
        <div className="mx-auto max-w-md px-4 py-2">
          <OpeningBalanceCard refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </>
  );
}
