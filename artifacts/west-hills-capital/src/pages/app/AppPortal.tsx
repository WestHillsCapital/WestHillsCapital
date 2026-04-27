import { lazy, Suspense } from "react";
import { Redirect, Switch, Route } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";
import { DocuFillConfigProvider } from "@/hooks/useDocuFillConfig";
import { InternalAuthProvider } from "@/hooks/useInternalAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import AppOnboard from "./AppOnboard";
import DocuFill from "@/pages/internal/DocuFill";

const AppSettings = lazy(() => import("./AppSettings"));

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
          apiPath: "/api/v1/product/docufill",
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
  const { isLoaded, isSignedIn, account, accountLoading, needsOnboard } = useProductAuth();

  // Show spinner until account state is fully resolved.
  // The extra (!account && !needsOnboard) guard covers a race where Clerk
  // briefly reports isSignedIn=false then true, which resets accountLoading
  // before the /me fetch completes — causing a flash of the main app with no account.
  if (!isLoaded || (isSignedIn && (accountLoading || (!account && !needsOnboard)))) {
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
      <Suspense fallback={<Spinner />}>
        <Switch>
          <Route path="/app/settings" component={AppSettings} />
          <Route component={DocuFillWrapper} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}
