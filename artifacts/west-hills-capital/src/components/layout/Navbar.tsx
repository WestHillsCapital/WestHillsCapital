import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Live Pricing", href: "/pricing" },
    { label: "IRA Allocation", href: "/ira" },
    { label: "Insights", href: "/insights" },
    { label: "FAQ", href: "/faq" },
    { label: "About", href: "/about" },
  ];

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
              src="/images/logo.png"
              alt="West Hills Capital"
              className="h-10 lg:h-12 w-auto object-contain transition-opacity group-hover:opacity-80"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full",
                  (link.href === "/" ? location === "/" : location.startsWith(link.href))
                    ? "text-primary after:w-full"
                    : "text-foreground/80"
                )}
              >
                {link.label}
              </Link>
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
          <div className="flex flex-col px-4 pt-4 pb-8 space-y-4">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "px-4 py-3 rounded-lg text-base font-medium",
                  (link.href === "/" ? location === "/" : location.startsWith(link.href))
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-gray-50"
                )}
              >
                {link.label}
              </Link>
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
