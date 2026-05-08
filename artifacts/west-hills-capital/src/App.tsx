import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ClerkProvider, useUser } from "@clerk/react";
import * as Sentry from "@sentry/react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { UpgradeModalProvider } from "@/hooks/useUpgradeModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
const NotFound       = lazy(() => import("@/pages/not-found"));
const Gone           = lazy(() => import("@/pages/Gone"));
const AffiliateApply = lazy(() => import("@/pages/AffiliateApply"));
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
const SandboxLanding              = lazy(() => import("@/pages/Sandbox"));

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
        <Route path="/internal/deal-builder">
          <ErrorBoundary inline label="Deal Builder">
            <DealBuilder />
          </ErrorBoundary>
        </Route>
        <Route path="/internal/content"              component={ContentEngine}               />
        <Route path="/internal/docufill">
          <ErrorBoundary inline label="DocuFill mapper">
            <DocuFillInternal />
          </ErrorBoundary>
        </Route>
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
  const isCustomerForm = location.startsWith("/docuplete/public/");
  const isSandboxPage  = location === "/sandbox";
  const isApp         = location.startsWith("/app");

  // Capture referral code from ?ref= URL param and persist to localStorage
  // so it survives navigation before the user reaches the checkout flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem("docuplete_referral_code", ref.trim().toUpperCase());
    }
  }, [location]);

  if (isInternal) {
    return (
      <div className="docuplete-app">
        <ScrollToTop />
        <ErrorBoundary label="internal portal">
          <Suspense fallback={<PageSpinner />}>
            <InternalRouter />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (isCustomerForm) {
    return (
      <div className="docuplete-app">
        <ScrollToTop />
        <ErrorBoundary label="signing form" inline>
          <Suspense fallback={<PageSpinner />}>
            <Switch>
              <Route path="/docuplete/public/:token" component={DocuFillCustomer} />
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (isSandboxPage) {
    return (
      <div className="docuplete-app">
        <ScrollToTop />
        <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/sandbox" component={SandboxLanding} />
          </Switch>
        </Suspense>
      </div>
    );
  }

  if (isApp) {
    return (
      <div className="docuplete-app">
        <ScrollToTop />
        <ErrorBoundary label="app portal">
          <Suspense fallback={<PageSpinner />}>
            <Switch>
              <Route path="/app/sign-in/*?" component={AppSignIn} />
              <Route path="/app/sign-up/*?" component={AppSignUp} />
              <Route path="/app/*?"         component={AppPortal} />
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </div>
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
          <Route path="/become-an-affiliate" component={AffiliateApply} />
          <Route path="/ira/rollovers"            component={IraRolloversHubPage} />
          <Route path="/ira/rollover/:accountType" component={IraRolloverPage} />
          <Route path="/ira/custodians"            component={CustodiansHubPage} />
          <Route path="/ira/custodians/:custodianSlug" component={CustodianPage} />
          <Route path="/ira/depositories"          component={DepositoriesHubPage} />
          <Route path="/ira/depositories/:depositorySlug" component={DepositoryPage} />
          {/* 410 Gone — old WordPress site paths */}
          <Route path="/contact"                component={Gone} />
          <Route path="/home"                   component={Gone} />
          <Route path="/retirement-options"     component={Gone} />
          <Route path="/retirement"             component={Gone} />
          <Route path="/privacy-policy"         component={Gone} />
          <Route path="/new-to-whc"             component={Gone} />
          <Route path="/free-shipping"          component={Gone} />
          <Route path="/m/new-to-whc"           component={Gone} />
          <Route path="/cart"                   component={Gone} />
          <Route path="/my-account"             component={Gone} />
          <Route path="/new-to-precious-metals" component={Gone} />
          <Route path="/new-home-page"          component={Gone} />
          <Route path="/terms-and-conditions"   component={Gone} />
          <Route path="/product/:rest*"         component={Gone} />
          <Route path="/product-category/:rest*" component={Gone} />
          <Route path="/_2016/:rest*"           component={Gone} />
          <Route path="/author/:rest*"          component={Gone} />

          {/* 410 Gone — products not sold (must be before /products/:coinSlug) */}
          <Route path="/products/australian-gold-kangaroo"       component={Gone} />
          <Route path="/products/australian-gold-kangaroo/:year" component={Gone} />
          <Route path="/products/austrian-gold-philharmonic"       component={Gone} />
          <Route path="/products/austrian-gold-philharmonic/:year" component={Gone} />
          <Route path="/products/canadian-gold-maple-leaf"       component={Gone} />
          <Route path="/products/canadian-gold-maple-leaf/:year" component={Gone} />
          <Route path="/products/canadian-silver-maple-leaf"       component={Gone} />
          <Route path="/products/canadian-silver-maple-leaf/:year" component={Gone} />
          <Route path="/products/south-african-krugerrand"       component={Gone} />
          <Route path="/products/south-african-krugerrand/:year" component={Gone} />

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

// Syncs the signed-in Clerk user to Sentry so error reports include user context.
function ClerkSentrySync() {
  const { user, isSignedIn } = useUser();
  useEffect(() => {
    if (isSignedIn && user) {
      // Use only the opaque Clerk user ID — never pass email or other PII to
      // a third-party service (SOC 2 CC6.1 / sendDefaultPii: false policy).
      Sentry.setUser({ id: user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [isSignedIn, user]);
  return null;
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
      <ClerkSentrySync />
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
