// web/src/features/liang/CandidateContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addCandidateBasketItem,
  clearCandidateBasket,
  fetchCandidateBasket,
  removeCandidateBasketItem,
} from "./api";
import type { Listing } from "./types";

interface CandidateState {
  candidates: Listing[];
  add: (listing: Listing) => Promise<void>;
  remove: (id: number) => Promise<void>;
  has: (id: number) => boolean;
  clear: () => Promise<void>;
}

const CandidateContext = createContext<CandidateState | null>(null);

export function CandidateProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<Listing[]>([]);

  useEffect(() => {
    fetchCandidateBasket().then(setCandidates).catch(() => {});
  }, []);

  const add = useCallback(async (listing: Listing) => {
    const items = await addCandidateBasketItem(listing.id);
    setCandidates(items);
  }, []);

  const remove = useCallback(async (id: number) => {
    const items = await removeCandidateBasketItem(id);
    setCandidates(items);
  }, []);

  const has = useCallback(
    (id: number) => candidates.some((c) => c.id === id),
    [candidates],
  );

  const clear = useCallback(async () => {
    await clearCandidateBasket();
    setCandidates([]);
  }, []);

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
