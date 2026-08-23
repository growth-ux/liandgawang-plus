// web/src/features/liang/CandidateContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Listing } from "./types";

interface CandidateState {
  candidates: Listing[];
  add: (listing: Listing) => void;
  remove: (id: number) => void;
  has: (id: number) => boolean;
  clear: () => void;
}

const CandidateContext = createContext<CandidateState | null>(null);

export function CandidateProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<Listing[]>([]);

  const add = useCallback((listing: Listing) => {
    setCandidates((prev) =>
      prev.some((c) => c.id === listing.id) ? prev : [...prev, listing],
    );
  }, []);

  const remove = useCallback((id: number) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const has = useCallback(
    (id: number) => candidates.some((c) => c.id === id),
    [candidates],
  );

  const clear = useCallback(() => setCandidates([]), []);

  const value = useMemo(
    () => ({ candidates, add, remove, has, clear }),
    [candidates, add, remove, has, clear],
  );

  return (
    <CandidateContext.Provider value={value}>{children}</CandidateContext.Provider>
  );
}

export function useCandidates(): CandidateState {
  const ctx = useContext(CandidateContext);
  if (!ctx) throw new Error("useCandidates 必须在 CandidateProvider 内使用");
  return ctx;
}
