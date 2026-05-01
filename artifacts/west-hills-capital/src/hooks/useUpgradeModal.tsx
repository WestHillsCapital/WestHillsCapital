import { createContext, useContext, useState, type ReactNode } from "react";

export interface UpgradeModalState {
  feature?: string;
  featureLabel?: string;
  requiredPlan?: "pro" | "enterprise";
  limitType?: "packages" | "submissions" | "seats";
  message?: string;
}

interface UpgradeModalContextValue {
  isOpen: boolean;
  state: UpgradeModalState;
  show: (s: UpgradeModalState) => void;
  hide: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<UpgradeModalState>({});

  function show(s: UpgradeModalState) {
    setState(s);
    setIsOpen(true);
  }

  function hide() {
    setIsOpen(false);
  }

  return (
    <UpgradeModalContext.Provider value={{ isOpen, state, show, hide }}>
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be used inside UpgradeModalProvider");
  return ctx;
}
