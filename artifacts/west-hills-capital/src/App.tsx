import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
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

// Public pages
import Home from "@/pages/Home";
import LivePricing from "@/pages/LivePricing";
import Schedule from "@/pages/Schedule";
import IRA from "@/pages/IRA";
import About from "@/pages/About";
import Disclosures from "@/pages/Disclosures";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Insights from "@/pages/Insights";
import InsightArticle from "@/pages/InsightArticle";
import NotFound from "@/pages/not-found";

// Internal pages
import InternalLeads from "@/pages/internal/Leads";
import InternalAppointments from "@/pages/internal/Appointments";
import DealBuilder from "@/pages/internal/DealBuilder";

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <InternalLogin />;
  }

  return (
    <InternalLayout>
      <Switch>
        <Route path="/internal/leads"        component={InternalLeads}        />
        <Route path="/internal/appointments"  component={InternalAppointments} />
        <Route path="/internal/deal-builder"  component={DealBuilder}          />
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
        <InternalRouter />
      </>
    );
  }

  return (
    <Layout>
      <ScrollToTop />
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
        <Route component={NotFound} />
      </Switch>
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
