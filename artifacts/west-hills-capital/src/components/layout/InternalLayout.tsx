import { Link, useLocation } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";

interface InternalLayoutProps {
  children: React.ReactNode;
}

export function InternalLayout({ children }: InternalLayoutProps) {
  const [location] = useLocation();
  const { user, signOut } = useInternalAuth();

  const navLinks = [
    { href: "/internal/leads",        label: "Leads" },
    { href: "/internal/appointments", label: "Appointments" },
    { href: "/internal/deal-builder", label: "Deal Builder" },
  ];

  return (
    <div className="min-h-screen bg-[#07101f] text-white flex flex-col">
      {/* Top nav bar */}
      <header className="bg-[#0d1728]" style={{ borderBottom: "1px solid #1a2640", boxShadow: "0 1px 0 0 rgba(196,154,56,0.12)" }}>
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/internal/leads" className="flex items-center gap-2.5 shrink-0">
            <span className="font-serif text-base font-semibold tracking-widest text-[#C49A38] uppercase leading-none">WHC</span>
            <span className="w-px h-4 bg-[#C49A38]/25" />
            <span className="text-xs text-[#8fa3c0] font-medium tracking-wide uppercase">Internal</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {navLinks.map(({ href, label }) => {
              const active = location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                    active
                      ? "bg-[#C49A38]/15 text-[#C49A38]"
                      : "text-[#8fa3c0] hover:text-white hover:bg-[#162038]",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <a
              href="/"
              className="text-xs text-[#4a6080] hover:text-[#8fa3c0] transition-colors"
            >
              ← Public site
            </a>

            {user && (
              <div className="flex items-center gap-2">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full border border-[#243355] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#C49A38]/20 border border-[#C49A38]/30 flex items-center justify-center text-[#C49A38] text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-[#8fa3c0] hidden sm:block max-w-[140px] truncate">
                  {user.name}
                </span>
                <button
                  onClick={signOut}
                  className="text-xs text-[#4a6080] hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
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
