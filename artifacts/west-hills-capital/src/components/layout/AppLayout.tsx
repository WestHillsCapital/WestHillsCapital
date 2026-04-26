import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";

const APP_NAME = "DocuPak";

function UserAvatar({ imageUrl, name, email }: { imageUrl?: string | null; name?: string | null; email?: string | null }) {
  const initials = name
    ? name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : email
    ? email[0].toUpperCase()
    : "?";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ?? "Profile"}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ring-2 ring-white">
      <span className="text-xs font-semibold text-gray-600">{initials}</span>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { account, user, signOut } = useProductAuth();
  const [location, navigate] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.fullName ?? account?.email ?? "";
  const displayEmail = account?.email ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const imageUrl = user?.imageUrl;

  const handleSignOut = () => {
    setDropdownOpen(false);
    signOut();
    navigate("/app");
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">

          {/* Left: app name + org name + nav */}
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-gray-900">{APP_NAME}</span>
            {account && (
              <span className="text-sm text-gray-400 border-l border-gray-200 pl-4 hidden sm:block">
                {account.accountName}
              </span>
            )}
            <nav className="flex items-center gap-1 ml-2">
              <Link
                href="/app"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  location === "/app" || location === "/app/"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                DocuFill
              </Link>
            </nav>
          </div>

          {/* Right: profile avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Open profile menu"
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
            >
              <UserAvatar imageUrl={imageUrl} name={displayName} email={displayEmail} />
            </button>

            {dropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-lg ring-1 ring-black/5 z-50 overflow-hidden"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName || displayEmail}</p>
                  {displayName && displayEmail && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{displayEmail}</p>
                  )}
                  {account?.accountName && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{account.accountName}</p>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    href="/app/settings"
                    onClick={() => setDropdownOpen(false)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      location.startsWith("/app/settings")
                        ? "bg-gray-50 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                </div>

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
