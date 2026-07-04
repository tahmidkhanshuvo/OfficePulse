import { useCallback, useEffect, useState } from "react";
import type { OfficeSnapshot } from "../../../../packages/contracts/src";
import { getBootstrap } from "../lib/api";

export function useOfficeSnapshot() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getBootstrap();
      setSnapshot(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load office data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}
