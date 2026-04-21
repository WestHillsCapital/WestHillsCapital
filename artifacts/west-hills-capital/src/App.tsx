import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Public layout
import { Layout } from "@/components/layout/Layout";

// Internal layout + auth
import { InternalLayout } from "@/components/layout/InternalLayout";
import { InternalAuthProvider, useInternalAuth } from "@/hooks/useInternalAuth";
import InternalLogin from "@/pages/internal/InternalLogin";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location]);
  return null;
}

// ── Public pages (lazy-loaded — split into their own chunks) ──────────────────
const Home          = lazy(() => import("@/pages/Home"));
const LivePricing   = lazy(() => import("@/pages/LivePricing"));
const Schedule      = lazy(() => import("@/pages/Schedule"));
const IRA           = lazy(() => import("@/pages/IRA"));
const About         = lazy(() => import("@/pages/About"));
const Disclosures   = lazy(() => import("@/pages/Disclosures"));
const Terms         = lazy(() => import("@/pages/Terms"));
const Privacy       = lazy(() => import("@/pages/Privacy"));
const Insights      = lazy(() => import("@/pages/Insights"));
const InsightArticle = lazy(() => import("@/pages/InsightArticle"));
const FAQ           = lazy(() => import("@/pages/FAQ"));
const NotFound      = lazy(() => import("@/pages/not-found"));

// ── Internal pages (lazy-loaded — never sent to public visitors) ──────────────
const InternalLeads        = lazy(() => import("@/pages/internal/Leads"));
const InternalAppointments = lazy(() => import("@/pages/internal/Appointments"));
const DealBuilder          = lazy(() => import("@/pages/internal/DealBuilder"));
const ContentEngine        = lazy(() => import("@/pages/internal/ContentEngine"));
const DocuFill             = lazy(() => import("@/pages/internal/DocuFill"));

// ── Shared fallback spinner ───────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <div className="w-7 h-7 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Renders internal pages only when the user is signed in
function InternalRouter() {
  const { user, isLoading } = useInternalAuth();

  if (isLoading) return <PageSpinner />;

  if (!user) {
    return <InternalLogin />;
  }

  return (
    <InternalLayout>
      <Switch>
        <Route path="/internal/leads"        component={InternalLeads}        />
        <Route path="/internal/appointments"  component={InternalAppointments} />
        <Route path="/internal/deal-builder"  component={DealBuilder}          />
        <Route path="/internal/content"       component={ContentEngine}        />
        <Route path="/internal/docufill"      component={DocuFill}             />
        <Route>
          <Redirect to="/internal/leads" />
        </Route>
      </Switch>
    </InternalLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isInternal = location.startsWith("/internal");

  if (isInternal) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<PageSpinner />}>
          <InternalRouter />
        </Suspense>
      </>
    );
  }

  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Switch>
          <Route path="/"                component={Home}          />
          <Route path="/pricing"         component={LivePricing}   />
          <Route path="/schedule"        component={Schedule}       />
          <Route path="/ira"             component={IRA}            />
          <Route path="/about"           component={About}          />
          <Route path="/disclosures"     component={Disclosures}    />
          <Route path="/terms"           component={Terms}          />
          <Route path="/privacy"         component={Privacy}        />
          <Route path="/insights"        component={Insights}       />
          <Route path="/insights/:slug"  component={InsightArticle} />
          <Route path="/faq"             component={FAQ}            />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <InternalAuthProvider>
              <Router />
            </InternalAuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
