import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ClerkProvider } from "@clerk/react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { UpgradeModalProvider } from "@/hooks/useUpgradeModal";
import { UpgradeModal } from "@/components/UpgradeModal";

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
      window.scrollTo(0, 0);
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
const Verify        = lazy(() => import("@/pages/Verify"));

// ── Programmatic SEO pages (lazy-loaded) ──────────────────────────────────────
const IraRolloversHubPage = lazy(() => import("@/pages/seo/IraRolloversHubPage"));
const CustodiansHubPage   = lazy(() => import("@/pages/seo/CustodiansHubPage"));
const CoinsHubPage        = lazy(() => import("@/pages/seo/CoinsHubPage"));
const StatesHubPage       = lazy(() => import("@/pages/seo/StatesHubPage"));
const IraRolloverPage     = lazy(() => import("@/pages/seo/IraRolloverPage"));
const CoinYearPage        = lazy(() => import("@/pages/seo/CoinYearPage"));
const StateGoldIraPage    = lazy(() => import("@/pages/seo/StateGoldIraPage"));
const CustodianPage       = lazy(() => import("@/pages/seo/CustodianPage"));
const ComparisonPage        = lazy(() => import("@/pages/seo/ComparisonPage"));
const LearnHubPage          = lazy(() => import("@/pages/seo/LearnHubPage"));
const DepositoriesHubPage   = lazy(() => import("@/pages/seo/DepositoriesHubPage"));
const DepositoryPage        = lazy(() => import("@/pages/seo/DepositoryPage"));

// ── Internal pages (lazy-loaded — never sent to public visitors) ──────────────
const InternalProspectingPipeline = lazy(() => import("@/pages/internal/Leads"));
const InternalScheduledCalls      = lazy(() => import("@/pages/internal/Appointments"));
const DealBuilder                 = lazy(() => import("@/pages/internal/DealBuilder"));
const ContentEngine               = lazy(() => import("@/pages/internal/ContentEngine"));
const DocuFillInternal            = lazy(() => import("@/pages/internal/DocuFill"));
const SettingsInternal            = lazy(() => import("@/pages/internal/Settings"));
const SuperAdminInternal          = lazy(() => import("@/pages/internal/SuperAdmin"));
const DocuFillCustomer            = lazy(() => import("@/pages/DocuFillCustomer"));

// ── Product portal pages (Clerk-auth, lazy-loaded) ────────────────────────────
const AppPortal  = lazy(() => import("@/pages/app/AppPortal"));
const AppSignIn  = lazy(() => import("@/pages/app/AppSignIn"));
const AppSignUp  = lazy(() => import("@/pages/app/AppSignUp"));

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
        <Route path="/internal/prospecting-pipeline" component={InternalProspectingPipeline} />
        <Route path="/internal/scheduled-calls"      component={InternalScheduledCalls}      />
        <Route path="/internal/leads">
          <Redirect to="/internal/prospecting-pipeline" />
        </Route>
        <Route path="/internal/appointments">
          <Redirect to="/internal/scheduled-calls" />
        </Route>
        <Route path="/internal/deal-builder"         component={DealBuilder}                 />
        <Route path="/internal/content"              component={ContentEngine}               />
        <Route path="/internal/docufill"             component={DocuFillInternal}            />
        <Route path="/internal/settings"             component={SettingsInternal}            />
        <Route path="/internal/super-admin"          component={SuperAdminInternal}          />
        <Route>
          <Redirect to="/internal/prospecting-pipeline" />
        </Route>
      </Switch>
    </InternalLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isInternal    = location.startsWith("/internal");
  const isCustomerForm = location.startsWith("/docufill/public/");
  const isApp         = location.startsWith("/app");

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

  if (isCustomerForm) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/docufill/public/:token" component={DocuFillCustomer} />
          </Switch>
        </Suspense>
      </>
    );
  }

  if (isApp) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/app/sign-in/*?" component={AppSignIn} />
            <Route path="/app/sign-up/*?" component={AppSignUp} />
            <Route path="/app/*?"         component={AppPortal} />
          </Switch>
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
          <Route path="/verify"          component={Verify}         />
          <Route path="/ira/rollovers"            component={IraRolloversHubPage} />
          <Route path="/ira/rollover/:accountType" component={IraRolloverPage} />
          <Route path="/ira/custodians"            component={CustodiansHubPage} />
          <Route path="/ira/custodians/:custodianSlug" component={CustodianPage} />
          <Route path="/ira/depositories"          component={DepositoriesHubPage} />
          <Route path="/ira/depositories/:depositorySlug" component={DepositoryPage} />
          <Route path="/products"                  component={CoinsHubPage} />
          <Route path="/products/:coinSlug/:year"  component={CoinYearPage} />
          <Route path="/products/:coinSlug"        component={CoinYearPage} />
          <Route path="/gold-ira"                  component={StatesHubPage} />
          <Route path="/gold-ira/:stateSlug"       component={StateGoldIraPage} />
          <Route path="/learn"                     component={LearnHubPage} />
          <Route path="/learn/:comparisonSlug"     component={ComparisonPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

const GOOGLE_CLIENT_ID  = (import.meta.env.VITE_GOOGLE_CLIENT_ID  as string | undefined) ?? "";
const CLERK_PUB_KEY     = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";
const CLERK_PROXY_URL   = (import.meta.env.VITE_CLERK_PROXY_URL   as string | undefined) ?? undefined;
const basePath          = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkProviderWithRouter({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={CLERK_PUB_KEY}
      proxyUrl={CLERK_PROXY_URL}
      signInUrl={`${basePath}/app/sign-in`}
      signUpUrl={`${basePath}/app/sign-up`}
      afterSignOutUrl={`${basePath}/app/sign-in`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={400}>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRouter>
              <UpgradeModalProvider>
                <InternalAuthProvider>
                  <Router />
                </InternalAuthProvider>
                <UpgradeModal />
              </UpgradeModalProvider>
            </ClerkProviderWithRouter>
          </WouterRouter>
          <Toaster />
          <CookieConsentBanner />
        </TooltipProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
