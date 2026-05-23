import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";
import { useProductRole } from "@/hooks/useProductRole";
import { DocupleteConfigProvider } from "@/hooks/useDocupleteConfig";
import { InternalAuthProvider } from "@/hooks/useInternalAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { TwoFAGate } from "@/components/auth/TwoFAGate";
import AppOnboard from "./AppOnboard";
import Docuplete from "@/pages/internal/Docuplete";

const AppSettings = lazy(() => import("./AppSettings"));
const AppSessionsPage = lazy(() => import("./AppSessions"));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SignInRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const t = setTimeout(() => setLocation("/app/sign-in"), 2000);
    return () => clearTimeout(t);
  }, [setLocation]);
  return <Spinner />;
}

function DocupleteWrapper({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  const { isAdmin } = useProductRole(getAuthHeaders);
  return (
    <InternalAuthProvider>
      <DocupleteConfigProvider
        config={{
          apiPath: "/api/v1/product/docuplete",
          interviewBasePath: "/app",
          getAuthHeaders,
          isAdmin,
        }}
      >
        <Suspense fallback={<Spinner />}>
          <Docuplete />
        </Suspense>
      </DocupleteConfigProvider>
    </InternalAuthProvider>
  );
}

export default function AppPortal() {
  const {
    isLoaded,
    isSignedIn,
    user,
    token,
    account,
    accountLoading,
    needsOnboard,
    needs2FA,
    authError,
    signOut,
    refreshAccount,
    verify2FA,
    getAuthHeaders,
  } = useProductAuth();

  // Wait for Clerk to load. Once loaded, if we're signed in we wait until
  // the /me fetch completes (accountLoading) OR we know the outcome
  // (account, needsOnboard, authError, needs2FA) before rendering anything.
  if (!isLoaded || (isSignedIn && accountLoading && !account && !needsOnboard && !authError && !needs2FA)) {
    return <Spinner />;
  }

  // Not signed in — redirect to sign-in after a short delay so Clerk can
  // route first; fall back to an explicit redirect after 2 s.
  if (!isSignedIn) {
    return <SignInRedirect />;
  }

  if (needs2FA) {
    return (
      <TwoFAGate
        verify2FA={verify2FA}
        onVerified={() => refreshAccount()}
        onSignOut={() => signOut({ redirectUrl: "/app/sign-in" })}
      />
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-sm text-gray-600">{authError}</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => refreshAccount()}
              className="text-sm underline text-gray-700 hover:text-gray-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/app/sign-in" })}
              className="text-sm underline text-gray-500 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (needsOnboard) {
    // Pass AppPortal's own refreshAccount so that when onboarding completes,
    // the state update happens in this hook instance (not a separate one in
    // AppOnboard), causing AppPortal to immediately re-render into the main app.
    return (
      <AppOnboard
        user={user}
        token={token}
        onComplete={refreshAccount}
      />
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<Spinner />}>
        <Switch>
          <Route path="/settings" component={AppSettings} />
          <Route path="/sessions">
            <AppSessionsPage getAuthHeaders={getAuthHeaders} />
          </Route>
          <Route>
            <DocupleteWrapper getAuthHeaders={getAuthHeaders} />
          </Route>
        </Switch>
      </Suspense>
    </AppLayout>
  );
}
