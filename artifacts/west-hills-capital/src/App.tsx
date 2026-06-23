import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { UpgradeModalProvider } from "@/hooks/useUpgradeModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { InternalLayout } from "@/components/layout/InternalLayout";
import { InternalAuthProvider, useInternalAuth } from "@/hooks/useInternalAuth";
import InternalLogin from "@/pages/internal/InternalLogin";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [location]);
  return null;
}

const NotFound           = lazy(() => import("@/pages/not-found"));
const Verify             = lazy(() => import("@/pages/Verify"));
const DocupleteInternal  = lazy(() => import("@/pages/internal/Docuplete"));
const SettingsInternal   = lazy(() => import("@/pages/internal/Settings"));
const SuperAdminInternal = lazy(() => import("@/pages/internal/SuperAdmin"));
const DocupleteCustomer  = lazy(() => import("@/pages/DocupleteCustomer"));
const SandboxLanding     = lazy(() => import("@/pages/Sandbox"));
const CustodianListPage  = lazy(() => import("@/pages/seo/CustodianListPage"));
const CustodianDetailPage = lazy(() => import("@/pages/seo/CustodianDetailPage"));

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="w-7 h-7 border-2 border-[#1B4FD8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, retry: 1 } },
});

function InternalRouter() {
  const { user, isLoading } = useInternalAuth();
  if (isLoading) return <PageSpinner />;
  if (!user) return <InternalLogin />;
  return (
    <InternalLayout>
      <Switch>
        <Route path="/internal/docuplete">
          <ErrorBoundary inline label="Docuplete">
            <DocupleteInternal />
          </ErrorBoundary>
        </Route>
        <Route path="/internal/settings"    component={SettingsInternal}   />
        <Route path="/internal/super-admin" component={SuperAdminInternal} />
        <Route><Redirect to="/internal/docuplete" /></Route>
      </Switch>
    </InternalLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isInternal     = location.startsWith("/internal");
  const isCustomerForm = location.startsWith("/docuplete/public/");
  const isSandbox      = location === "/sandbox";
  const isVerify       = location === "/verify";
  const isPublicSeo    = location.startsWith("/ira/custodians");

  if (isInternal) return (
    <div className="docuplete-app">
      <ScrollToTop />
      <ErrorBoundary label="internal portal">
        <Suspense fallback={<PageSpinner />}><InternalRouter /></Suspense>
      </ErrorBoundary>
    </div>
  );

  if (isCustomerForm) return (
    <div className="docuplete-app">
      <ScrollToTop />
      <ErrorBoundary label="signing form" inline>
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/docuplete/public/:token" component={DocupleteCustomer} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </div>
  );

  if (isSandbox) return (
    <div className="docuplete-app">
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Switch><Route path="/sandbox" component={SandboxLanding} /></Switch>
      </Suspense>
    </div>
  );

  if (isVerify) return (
    <div className="docuplete-app">
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Switch><Route path="/verify" component={Verify} /></Switch>
      </Suspense>
    </div>
  );

  if (isPublicSeo) return (
    <div className="west-hills-public">
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Switch>
          <Route path="/ira/custodians/:slug" component={CustodianDetailPage} />
          <Route path="/ira/custodians" component={CustodianListPage} />
        </Switch>
      </Suspense>
    </div>
  );

  return (
    <Suspense fallback={<PageSpinner />}>
      <Switch><Route component={NotFound} /></Switch>
    </Suspense>
  );
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        <WouterRouter base={basePath}>
          <InternalAuthProvider>
            <UpgradeModalProvider>
              <Router />
              <UpgradeModal />
            </UpgradeModalProvider>
          </InternalAuthProvider>
        </WouterRouter>
        <Toaster />
        <CookieConsentBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
