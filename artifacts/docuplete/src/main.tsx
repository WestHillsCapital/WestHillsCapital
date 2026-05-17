import { ClerkProvider } from "@clerk/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const CLERK_PUB_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const CLERK_PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUB_KEY} proxyUrl={CLERK_PROXY_URL}>
    <App />
  </ClerkProvider>,
);
