import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { useOrgSettings } from "@/hooks/useOrgSettings";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface InternalLayoutProps {
  children: React.ReactNode;
}

export function InternalLayout({ children }: InternalLayoutProps) {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  const { user, signOut } = useInternalAuth();
  const org = useOrgSettings();

  const navLinks = [
    { href: "/internal/prospecting-pipeline", label: "Prospecting Pipeline" },
    { href: "/internal/scheduled-calls",      label: "Scheduled Calls" },
    { href: "/internal/deal-builder",         label: "Deal Builder" },
    { href: "/internal/docufill",             label: "DocuFill" },
    { href: "/internal/content",              label: "Content" },
    { href: "/internal/settings",             label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F1C3F] flex flex-col">
      {/* Top nav bar */}
      <header className="bg-white" style={{ borderBottom: "1px solid #DDD5C4", boxShadow: "0 1px 3px 0 rgba(15,28,63,0.06)" }}>
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-6">
          <Link href="/internal/prospecting-pipeline" className="flex items-center gap-2 shrink-0">
            {org?.logo_url ? (
              <img
                src={`${API_BASE}${org.logo_url}`}
                alt={org.name}
                className="h-6 w-auto max-w-[80px] object-contain"
              />
            ) : (
              <span className="font-serif text-base font-semibold tracking-widest text-[#C49A38] uppercase leading-none">
                {org ? org.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 4) : "WHC"}
              </span>
            )}
            <span className="w-px h-4 bg-[#C49A38]/25 hidden sm:block" />
            <span className="text-xs text-[#4A5B7A] font-medium tracking-wide uppercase hidden sm:block">Internal</span>
          </Link>

          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {navLinks.map(({ href, label }) => {
              const active = location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "px-2.5 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                    active
                      ? "bg-[#C49A38]/15 text-[#C49A38]"
                      : "text-[#4A5B7A] hover:text-[#0F1C3F] hover:bg-white",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-4 shrink-0">
            <a
              href="/"
              className="text-xs text-[#8A9BB8] hover:text-[#4A5B7A] transition-colors hidden sm:block"
            >
              ← Public site
            </a>

            {user && (
              <div className="flex items-center gap-2">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full border border-[#D4C9B5] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#C49A38]/20 border border-[#C49A38]/30 flex items-center justify-center text-[#C49A38] text-xs font-semibold shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="text-xs text-[#8A9BB8] hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
