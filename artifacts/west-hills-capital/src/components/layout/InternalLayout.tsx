import { Link, useLocation } from "wouter";

interface InternalLayoutProps {
  children: React.ReactNode;
}

export function InternalLayout({ children }: InternalLayoutProps) {
  const [location] = useLocation();

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

          <div className="ml-auto">
            <a
              href="/"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Public site
            </a>
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
