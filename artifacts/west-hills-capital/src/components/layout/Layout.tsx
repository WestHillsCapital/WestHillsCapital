import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { SpotTicker } from "./SpotTicker";
import { ArrowRight, Phone } from "lucide-react";

function StickyMobileCTA() {
  const [location] = useLocation();
  // Hide on the schedule page (the action is already there) and on all internal pages
  if (location === "/schedule" || location.startsWith("/internal")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      <div className="bg-white border-t border-border/40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3">
        <a
          href="tel:8008676768"
          className="flex items-center justify-center gap-2 flex-1 h-11 rounded-lg border border-border/50 text-sm font-semibold text-foreground/70 hover:text-primary hover:border-primary/30 transition-colors"
        >
          <Phone className="w-4 h-4" />
          (800) 867-6768
        </a>
        <Link href="/schedule" className="flex-[1.4]">
          <button className="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
            Schedule Call
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
      {/* iOS safe area */}
      <div className="h-safe-b bg-white" />
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <SpotTicker />
      <Navbar />
      <main className="flex-1 w-full pb-[72px] sm:pb-0">
        {children}
      </main>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
