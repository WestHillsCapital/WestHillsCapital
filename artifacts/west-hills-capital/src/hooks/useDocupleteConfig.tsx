import { createContext, useContext, type ReactNode } from "react";

export interface DocupleteConfig {
  apiPath: string;
  getAuthHeaders: () => HeadersInit;
  isAdmin?: boolean;
  /** Base path used when navigating to a newly created session, e.g. "/app" or "/internal/docuplete". */
  interviewBasePath?: string;
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
