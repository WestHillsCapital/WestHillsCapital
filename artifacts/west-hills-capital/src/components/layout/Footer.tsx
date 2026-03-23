import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-white/80 border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          <div className="col-span-1 lg:col-span-1">
            <h3 className="font-serif text-2xl text-white mb-6">West Hills Capital</h3>
            <p className="text-sm leading-relaxed text-white/60 mb-6">
              Physical Gold and Silver — As True as Time. Transparent pricing, disciplined execution, and guided allocation support for long-term investors.
            </p>
            <p className="text-sm font-medium text-white bg-white/5 inline-block px-4 py-2 rounded-lg border border-white/10">
              We will call you from <strong className="text-primary tracking-wider ml-1">800-867-6768</strong>
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Navigation</h4>
            <ul className="space-y-4">
              <li><Link href="/" className="hover:text-primary transition-colors text-sm">Home</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors text-sm">Live Pricing</Link></li>
              <li><Link href="/schedule" className="hover:text-primary transition-colors text-sm">Schedule Call</Link></li>
              <li><Link href="/ira" className="hover:text-primary transition-colors text-sm">IRA Allocation</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors text-sm">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Disclosures</h4>
            <ul className="space-y-4">
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Legal Disclosures</Link></li>
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <a href="tel:8008676768" className="text-white hover:text-primary transition-colors block">800-867-6768</a>
                  <span className="text-xs text-white/50">Mon-Fri, 9am - 5pm CT</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <a href="mailto:info@westhillscapital.com" className="hover:text-primary transition-colors text-sm">
                  info@westhillscapital.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <address className="not-italic text-sm text-white/70">
                  West Hills Capital<br/>
                  123 Financial District Blvd<br/>
                  Suite 400<br/>
                  Dallas, TX 75201
                </address>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} West Hills Capital. All rights reserved.</p>
          <p className="text-center md:text-right max-w-xl">
            Precious metals markets carry inherent risk. West Hills Capital provides physical precious metals allocation and execution services. We do not provide investment, legal, or tax advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
