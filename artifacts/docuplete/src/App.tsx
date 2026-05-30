import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Affiliates from "@/pages/Affiliates";
import SsoLogin from "@/pages/SsoLogin";
import SsoSettings from "@/pages/SsoSettings";
import IpAllowlistSettings from "@/pages/IpAllowlistSettings";
import ScimSettings from "@/pages/ScimSettings";
import StatusPage from "@/pages/StatusPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/affiliates" component={Affiliates} />
      <Route path="/sso" component={SsoLogin} />
      <Route path="/settings/sso" component={SsoSettings} />
      <Route path="/settings/ip-allowlist" component={IpAllowlistSettings} />
      <Route path="/settings/scim" component={ScimSettings} />
      <Route path="/status" component={StatusPage} />
      <Route component={NotFound} />
    </Switch>
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
