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
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top nav bar */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/internal/leads" className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold tracking-widest text-amber-500 uppercase">WHC</span>
            <span className="text-sm text-gray-400 font-medium">Internal</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label }) => {
              const active = location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                    active
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800",
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
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Public site
            </a>

            {user && (
              <div className="flex items-center gap-2">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full border border-gray-700 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-gray-400 hidden sm:block max-w-[140px] truncate">
                  {user.name}
                </span>
                <button
                  onClick={signOut}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
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
