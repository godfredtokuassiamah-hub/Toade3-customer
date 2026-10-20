// Shared favourites state (Home grid, Favourites screen, future product
// page). Provided once at the root layout; loads from AsyncStorage on mount
// and persists on every change. See ./favouritesStore.ts for the pure
// helpers and persistence.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { loadFavourites, saveFavourites, toggleFavourite } from "./favouritesStore";

type FavouritesValue = {
  // Ordered ids (most recent first) and a Set for O(1) membership checks.
  ids: string[];
  set: Set<string>;
  // False until storage has been read.
  ready: boolean;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

const FavouritesContext = createContext<FavouritesValue | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadFavourites().then((list) => {
      if (cancelled) return;
      setIds(list);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Functional update keeps this a stable callback and always toggles the
  // latest list; persistence runs on the computed next list.
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = toggleFavourite(prev, id);
      void saveFavourites(next);
      return next;
    });
  }, []);

  const set = useMemo(() => new Set(ids), [ids]);
  const has = useCallback((id: string) => set.has(id), [set]);

  const value = useMemo<FavouritesValue>(
    () => ({ ids, set, ready, toggle, has }),
    [ids, set, ready, toggle, has],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): FavouritesValue {
  const value = useContext(FavouritesContext);
  if (!value) {
    throw new Error("useFavourites must be used inside FavouritesProvider");
  }
  return value;
}
