import { type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";

const APP_NAME = "DocuPak";

export function AppLayout({ children }: { children: ReactNode }) {
  const { account, signOut } = useProductAuth();
  const [location, navigate] = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
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
              <Link
                href="/app/settings"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  location.startsWith("/app/settings")
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {account?.email && (
              <span className="text-sm text-gray-400 hidden sm:block">{account.email}</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
