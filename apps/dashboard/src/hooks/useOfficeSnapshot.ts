import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { OfficeSnapshot } from "../../../../packages/contracts/src";
import { getBootstrap } from "../lib/api";

type OfficeSnapshotState = {
  snapshot: OfficeSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OfficeSnapshotContext = createContext<OfficeSnapshotState | null>(null);

function useOfficeSnapshotState(): OfficeSnapshotState {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedSnapshot = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getBootstrap();
      hasLoadedSnapshot.current = true;
      setSnapshot(next);
    } catch (cause) {
      if (!hasLoadedSnapshot.current) {
        setError(cause instanceof Error ? cause.message : "Unable to load office data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}

export function OfficeSnapshotProvider({ children }: { children: ReactNode }) {
  const value = useOfficeSnapshotState();
  return createElement(OfficeSnapshotContext.Provider, { value }, children);
}

export function useOfficeSnapshot() {
  const context = useContext(OfficeSnapshotContext);
  if (!context) {
    throw new Error("useOfficeSnapshot must be used within OfficeSnapshotProvider.");
  }
  return context;
}
