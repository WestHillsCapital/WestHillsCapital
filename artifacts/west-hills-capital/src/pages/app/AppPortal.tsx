import { Suspense } from "react";
import { Redirect } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";
import { DocuFillConfigProvider } from "@/hooks/useDocuFillConfig";
import { InternalAuthProvider } from "@/hooks/useInternalAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import AppOnboard from "./AppOnboard";
import DocuFill from "@/pages/internal/DocuFill";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DocuFillWrapper() {
  const { getAuthHeaders } = useProductAuth();

  return (
    <InternalAuthProvider>
      <DocuFillConfigProvider
        config={{
          apiPath: "/api/product/docufill",
          getAuthHeaders,
        }}
      >
        <Suspense fallback={<Spinner />}>
          <DocuFill />
        </Suspense>
      </DocuFillConfigProvider>
    </InternalAuthProvider>
  );
}

export default function AppPortal() {
  const { isLoaded, isSignedIn, accountLoading, needsOnboard } = useProductAuth();

  if (!isLoaded || (isSignedIn && accountLoading)) {
    return <Spinner />;
  }

  if (!isSignedIn) {
    return <Redirect to="/app/sign-in" />;
  }

  if (needsOnboard) {
    return <AppOnboard />;
  }

  return (
    <AppLayout>
      <DocuFillWrapper />
    </AppLayout>
  );
}
