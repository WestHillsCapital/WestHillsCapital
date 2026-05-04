import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import logoSrc from "@/assets/logo.webp";

interface NavDropdownItem {
  label: string;
  href: string;
  description?: string;
}

interface NavLink {
  label: string;
  href: string;
  dropdown?: NavDropdownItem[];
}

function DropdownMenu({ items, visible }: { items: NavDropdownItem[]; visible: boolean }) {
  return (
    <div
      className={cn(
        "absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-lg border border-border/50 py-1.5 z-50 transition-all duration-150",
        visible ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
      )}
    >
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <div className="px-4 py-2.5 hover:bg-primary/5 transition-colors cursor-pointer group">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {item.label}
            </p>
            {item.description && (
              <p className="text-xs text-foreground/50 mt-0.5 leading-snug">{item.description}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileExpanded(null);
  }, [location]);

  const navLinks: NavLink[] = [
    { label: "Home", href: "/" },
    { label: "Live Pricing", href: "/pricing" },
    {
      label: "IRA Allocation",
      href: "/ira",
      dropdown: [
        { label: "IRA Overview", href: "/ira", description: "How a Precious Metals IRA works" },
        { label: "Rollover Guides", href: "/ira/rollovers", description: "401(k), Traditional, Roth, TSP & more" },
        { label: "Custodians", href: "/ira/custodians", description: "Approved self-directed IRA custodians" },
        { label: "Depositories", href: "/ira/depositories", description: "Where IRA metals are stored" },
        { label: "Gold IRA by State", href: "/gold-ira", description: "State-specific guides for all 50 states" },
      ],
    },
    { label: "Learn", href: "/learn" },
    { label: "Insights", href: "/insights" },
    { label: "FAQ", href: "/faq" },
    { label: "About", href: "/about" },
  ];

  function isActive(link: NavLink) {
    if (link.href === "/") return location === "/";
    return location.startsWith(link.href);
  }

  function handleMouseEnter(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(label);
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 120);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-border/50"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 lg:h-24">

          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <img
              src={logoSrc}
              alt="West Hills Capital"
              className="h-10 lg:h-12 w-auto object-contain transition-opacity group-hover:opacity-80"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <div
                key={link.href}
                className="relative"
                onMouseEnter={() => link.dropdown ? handleMouseEnter(link.label) : undefined}
                onMouseLeave={link.dropdown ? handleMouseLeave : undefined}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full",
                    isActive(link)
                      ? "text-primary after:w-full"
                      : "text-foreground/80"
                  )}
                >
                  {link.label}
                  {link.dropdown && (
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-150",
                        openDropdown === link.label ? "rotate-180" : ""
                      )}
                    />
                  )}
                </Link>
                {link.dropdown && (
                  <DropdownMenu
                    items={link.dropdown}
                    visible={openDropdown === link.label}
                  />
                )}
              </div>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <a href="tel:8008676768" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors text-sm font-medium">
              <Phone className="w-4 h-4" />
              <span>(800) 867-6768</span>
            </a>
            <Link href="/schedule">
              <Button>Schedule Your Call</Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 -mr-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-border shadow-xl animate-fade-in">
          <div className="flex flex-col px-4 pt-4 pb-8 space-y-1">
            {navLinks.map((link) => (
              <div key={link.href}>
                {link.dropdown ? (
                  <>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === link.label ? null : link.label)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium",
                        isActive(link) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-gray-50"
                      )}
                    >
                      {link.label}
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-150",
                          mobileExpanded === link.label ? "rotate-180" : ""
                        )}
                      />
                    </button>
                    {mobileExpanded === link.label && (
                      <div className="mt-1 ml-4 flex flex-col space-y-1">
                        {link.dropdown.map((item) => (
                          <Link key={item.href} href={item.href}>
                            <div className="px-4 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                              <p className="text-sm font-medium text-foreground/80">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-foreground/45 mt-0.5">{item.description}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={link.href}
                    className={cn(
                      "block px-4 py-3 rounded-lg text-base font-medium",
                      isActive(link) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="h-px w-full bg-border my-2" />
            <a href="tel:8008676768" className="flex items-center justify-center gap-2 px-4 py-3 text-foreground font-medium bg-gray-50 rounded-lg">
              <Phone className="w-5 h-5 text-primary" />
              (800) 867-6768
            </a>
            <Link href="/schedule" className="w-full">
              <Button className="w-full h-12 text-base">Schedule Your Call</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
