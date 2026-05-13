import { createContext, useContext, type ReactNode } from "react";

export interface DocupleteConfig {
  apiPath: string;
  getAuthHeaders: () => HeadersInit;
  isAdmin?: boolean;
}

const DocupleteConfigContext = createContext<DocupleteConfig | null>(null);

export function DocupleteConfigProvider({
  config,
  children,
}: {
  config: DocupleteConfig;
  children: ReactNode;
}) {
  return (
    <DocupleteConfigContext.Provider value={config}>
      {children}
    </DocupleteConfigContext.Provider>
  );
}

export function useDocupleteConfig(): DocupleteConfig | null {
  return useContext(DocupleteConfigContext);
}
