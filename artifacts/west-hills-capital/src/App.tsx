import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Layout
import { Layout } from "@/components/layout/Layout";

// Pages
import Home from "@/pages/Home";
import LivePricing from "@/pages/LivePricing";
import Schedule from "@/pages/Schedule";
import IRA from "@/pages/IRA";
import About from "@/pages/About";
import Disclosures from "@/pages/Disclosures";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/pricing" component={LivePricing} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/ira" component={IRA} />
        <Route path="/about" component={About} />
        <Route path="/disclosures" component={Disclosures} />
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
