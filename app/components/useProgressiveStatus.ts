import { useEffect, useRef, useState } from "react";

export function useProgressiveStatus(
  active: boolean,
  stages: Array<[label: string, atMs: number]>
): string | null {
  const [label, setLabel] = useState<string | null>(active ? stages[0]?.[0] ?? null : null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the timer-driven label when the timer stops
      setLabel(null);
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    setLabel(stages[0]?.[0] ?? null);

    const interval = setInterval(() => {
      if (startRef.current === null) return;
      const elapsed = Date.now() - startRef.current;
      let current = stages[0]?.[0] ?? null;
      for (const [stageLabel, atMs] of stages) {
        if (elapsed >= atMs) current = stageLabel;
      }
      setLabel(current);
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return active ? label : null;
}
