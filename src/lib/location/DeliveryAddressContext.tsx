// Shared delivery-address state (Home top bar + location picker).
// Provided once at the root layout; loads from AsyncStorage on mount.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addRecent,
  type DeliveryAddress,
  loadDeliveryState,
  saveDeliveryState,
} from "./deliveryAddress";

type DeliveryAddressValue = {
  active: DeliveryAddress | null;
  recents: DeliveryAddress[];
  // False until storage has been read.
  ready: boolean;
  // Sets the active address and moves it to the front of recents.
  confirmAddress: (address: DeliveryAddress) => Promise<void>;
  // Adds an address to the front of recents without changing `active`.
  rememberAddress: (address: DeliveryAddress) => Promise<void>;
};

const DeliveryAddressContext = createContext<DeliveryAddressValue | null>(null);

export function DeliveryAddressProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<DeliveryAddress | null>(null);
  const [recents, setRecents] = useState<DeliveryAddress[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDeliveryState().then((state) => {
      if (cancelled) return;
      setActive(state.active);
      setRecents(state.recents);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmAddress = useCallback(
    async (address: DeliveryAddress) => {
      const next = addRecent(recents, address);
      setActive(address);
      setRecents(next);
      try {
        await saveDeliveryState(address, next);
      } catch {
        // Storage failure: the choice still applies for this session.
      }
    },
    [recents],
  );

  const rememberAddress = useCallback(
    async (address: DeliveryAddress) => {
      const next = addRecent(recents, address);
      setRecents(next);
      try {
        await saveDeliveryState(active, next);
      } catch {
        // Storage failure: still listed for this session.
      }
    },
    [active, recents],
  );

  const value = useMemo(
    () => ({ active, recents, ready, confirmAddress, rememberAddress }),
    [active, recents, ready, confirmAddress, rememberAddress],
  );

  return (
    <DeliveryAddressContext.Provider value={value}>
      {children}
    </DeliveryAddressContext.Provider>
  );
}

export function useDeliveryAddress(): DeliveryAddressValue {
  const value = useContext(DeliveryAddressContext);
  if (!value) {
    throw new Error("useDeliveryAddress must be used inside DeliveryAddressProvider");
  }
  return value;
}
