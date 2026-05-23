import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { NAV, type NavItem } from "@/lib/nav";
import { searchIndex, type SearchEntry } from "@/lib/search-index";

const DOCS_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4h18l6 6v22H6V4z" fill="white" fillOpacity="0.28" stroke="white" strokeOpacity="0.35" strokeWidth="0.75" />
        <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
        <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.7" />
        <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.7" />
        <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.7" />
        <circle cx="26" cy="28" r="5" fill="#C49A38" />
        <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-base font-bold tracking-tight text-white">Docuplete</span>
      <span className="text-xs font-medium text-white/40 bg-white/10 px-1.5 py-0.5 rounded ml-0.5">Docs</span>
    </div>
  );
}

function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const found = searchIndex(query);
    setResults(found);
    setOpen(found.length > 0);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (slug: string) => {
    setQuery("");
    setOpen(false);
    navigate(`/${slug}`);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          placeholder="Search docs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white/8 border border-white/10 text-white/80 placeholder-white/30 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#1B4FD8] focus:bg-white/10 transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#111827] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => handleSelect(r.slug)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <div>
                <div className="text-sm text-white/80">{r.title}</div>
                <div className="text-xs text-white/35">{r.section}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavSection({ section, depth = 0 }: { section: NavItem; depth?: number }) {
  const [location] = useLocation();
  const isChildActive = section.children?.some((c) => location === `/${c.slug}` || location.startsWith(`/${c.slug}/`));
  const [expanded, setExpanded] = useState(isChildActive ?? false);

  useEffect(() => {
    if (isChildActive) setExpanded(true);
  }, [isChildActive]);

  if (!section.children) {
    const isActive = location === `/${section.slug}` || location.startsWith(`/${section.slug}/`);
    return (
      <Link
        href={`/${section.slug}`}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-[#1B4FD8]/20 text-[#5B8DEF] font-medium"
            : "text-white/50 hover:text-white/75 hover:bg-white/5"
        }`}
      >
        {section.title}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          isChildActive ? "text-white/90" : "text-white/55 hover:text-white/75"
        }`}
      >
        <span>{section.title}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/8 pl-3">
          {section.children.map((child) => {
            const isActive = location === `/${child.slug}` || location.startsWith(`/${child.slug}/`);
            return (
              <Link
                key={child.slug}
                href={`/${child.slug}`}
                className={`flex items-center py-1.5 px-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "text-[#5B8DEF] font-medium bg-[#1B4FD8]/10"
                    : "text-white/45 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="min-h-screen bg-[#080E1A] flex flex-col">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-40 bg-[#080E1A]/95 backdrop-blur border-b border-white/6 h-14 flex items-center">
        <div className="max-w-[1400px] mx-auto w-full px-4 flex items-center gap-4">
          <button
            className="lg:hidden p-1.5 text-white/50 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <a href={`${DOCS_BASE}/`} className="shrink-0">
            <Logo />
          </a>
          <div className="hidden lg:block w-64" />
          <div className="flex-1 max-w-sm">
            <SearchBar />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://app.docuplete.com/signup"
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#1B4FD8] text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[#1740B8] transition-colors"
            >
              Start free trial
            </a>
            <a
              href="https://docuplete.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              docuplete.com
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 bg-[#0B1220] border-r border-white/8 overflow-y-auto">
            <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
              <Logo />
              <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white/70 p-1 rounded">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="px-3 py-4 space-y-0.5">
              {NAV.map((section) => (
                <NavSection key={section.slug} section={section} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-1 pt-14 max-w-[1400px] mx-auto w-full">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 fixed top-14 bottom-0 overflow-y-auto border-r border-white/6 bg-[#0A1120]/50">
          <nav className="px-3 py-5 space-y-0.5">
            {NAV.map((section) => (
              <NavSection key={section.slug} section={section} />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 lg:ml-64">
          <div className="max-w-3xl mx-auto px-6 py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
