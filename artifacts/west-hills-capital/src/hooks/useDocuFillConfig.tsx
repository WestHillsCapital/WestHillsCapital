import { createContext, useContext, type ReactNode } from "react";

export interface DocuFillConfig {
  apiPath: string;
  getAuthHeaders: () => HeadersInit;
}

const DocuFillConfigContext = createContext<DocuFillConfig | null>(null);

export function DocuFillConfigProvider({
  config,
  children,
}: {
  config: DocuFillConfig;
  children: ReactNode;
}) {
  return (
    <DocuFillConfigContext.Provider value={config}>
      {children}
    </DocuFillConfigContext.Provider>
  );
}

export function useDocuFillConfig(): DocuFillConfig | null {
  return useContext(DocuFillConfigContext);
}
