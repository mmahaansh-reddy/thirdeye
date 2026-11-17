"use client";

import { useEffect, useState } from "react";

/** Current time in ms, refreshed on an interval, so "time in stage" labels stay live without a reload. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
