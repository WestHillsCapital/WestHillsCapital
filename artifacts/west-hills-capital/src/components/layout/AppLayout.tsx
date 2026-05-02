import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useProductAuth } from "@/hooks/useProductAuth";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { MerlinWidget } from "@/components/MerlinWidget";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;

interface UserProfileData {
  display_name: string | null;
  avatar_url: string | null;
}

function useScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
}

const APP_NAME = "Docuplete";

function UserAvatar({ imageUrl, name, email }: { imageUrl?: string | null; name?: string | null; email?: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);

  const initials = name
    ? name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : email
    ? email[0].toUpperCase()
    : "?";

  if (imageUrl && !imgFailed) {
    return (
      <img
        src={imageUrl}
        alt={name ?? "Profile"}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white"
        onError={() => setImgFailed(true)}
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
  useScrollToTop();
  const { account, user, signOut, getAuthHeaders, token } = useProductAuth();
  const [location] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  const [orgBrandColor, setOrgBrandColor] = useState<string>("#111827");

  const fetchProfile = useRef(() => {
    fetch(`${SETTINGS_BASE}/profile`, { headers: getAuthHeadersRef.current() })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { profile?: UserProfileData };
        if (data.profile) setProfileData(data.profile);
      })
      .catch(() => {});
    fetch(`${SETTINGS_BASE}/org`, { headers: getAuthHeadersRef.current() })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { org?: { brand_color?: string } };
        if (data.org?.brand_color) setOrgBrandColor(data.org.brand_color);
      })
      .catch(() => {});
  });

  useEffect(() => {
    if (!token) return;
    fetchProfile.current();
  }, [token]);

  useEffect(() => {
    const handler = () => { fetchProfile.current(); };
    window.addEventListener("docuplete:profile-updated", handler);
    return () => window.removeEventListener("docuplete:profile-updated", handler);
  }, []);

  // Prefer app profile data over Clerk; fall back gracefully.
  const displayName = profileData?.display_name || user?.fullName || "";
  const displayEmail = account?.email ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const imageUrl = profileData?.avatar_url
    ? `${API_BASE}${profileData.avatar_url}`
    : (user?.imageUrl ?? null);

  const basePath = (import.meta.env.BASE_URL as string ?? "").replace(/\/$/, "");

  const handleSignOut = () => {
    setDropdownOpen(false);
    signOut({ redirectUrl: `${basePath}/app/sign-in` });
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

          {/* Left: Docuplete brand + org logo (or org name if no logo) */}
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors shrink-0">
              {APP_NAME}
            </Link>
            {account && (
              <span className="border-l border-gray-200 pl-3 hidden sm:flex items-center">
                {account.orgLogoUrl ? (
                  <img
                    src={account.orgLogoUrl}
                    alt={account.accountName}
                    className="h-7 max-w-[140px] object-contain"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = "none";
                      const sib = img.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.removeProperty("display");
                    }}
                  />
                ) : null}
                <span
                  className="text-sm text-gray-500"
                  style={account.orgLogoUrl ? { display: "none" } : undefined}
                >
                  {account.accountName}
                </span>
              </span>
            )}
          </div>

          {/* Right: user display name + profile avatar + dropdown */}
          <div className="flex items-center gap-3">
            {(displayName || displayEmail) && (
              <span className="hidden sm:block text-sm text-gray-400 max-w-[160px] truncate">
                {displayName || displayEmail}
              </span>
            )}
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
                    href="/app/sessions"
                    onClick={() => setDropdownOpen(false)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      location.startsWith("/app/sessions")
                        ? "bg-gray-50 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Sessions
                  </Link>
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
                    Profile settings
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
            </div>{/* relative dropdown */}
          </div>{/* flex items-center gap-3 */}
        </div>{/* max-w-7xl */}
      </header>

      <OnboardingChecklist getAuthHeaders={getAuthHeaders} />

      <main className="flex-1">
        {children}
      </main>

      <MerlinWidget getAuthHeaders={getAuthHeaders} brandColor={orgBrandColor} />
    </div>
  );
}
