import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";

const APP_NAME = "DocuFill"; // TODO: replace with final product name

export function AppLayout({ children }: { children: ReactNode }) {
  const { account, signOut } = useProductAuth();
  const [, navigate] = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold text-gray-900">{APP_NAME}</span>
            {account && (
              <span className="text-sm text-gray-500 border-l border-gray-200 pl-3">
                {account.accountName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {account?.email && (
              <span className="text-sm text-gray-500 hidden sm:block">{account.email}</span>
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
