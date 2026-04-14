import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

// Public layout
import { Layout } from "@/components/layout/Layout";

// Internal layout
import { InternalLayout } from "@/components/layout/InternalLayout";

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

function InternalRouter() {
  return (
    <InternalLayout>
      <Switch>
        <Route path="/internal/leads"        component={InternalLeads}        />
        <Route path="/internal/appointments"  component={InternalAppointments} />
        <Route path="/internal/deal-builder"  component={DealBuilder}          />
        <Route component={NotFound} />
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
        <Route path="/insights"        component={Insights}       />
        <Route path="/insights/:slug"  component={InsightArticle} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
