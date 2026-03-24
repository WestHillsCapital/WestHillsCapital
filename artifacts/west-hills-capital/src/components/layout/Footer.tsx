import { Link } from "wouter";
import { Phone, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-white/75 border-t border-white/10 pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

          <div className="col-span-1 lg:col-span-1">
            <h3 className="font-serif text-xl text-white mb-5">West Hills Capital</h3>
            <p className="text-sm leading-relaxed text-white/55 mb-5">
              Physical gold and silver allocation — transparent pricing, disciplined execution, and guided support for long-term investors.
            </p>
            <p className="text-sm font-medium text-white bg-white/5 inline-block px-4 py-2 rounded-lg border border-white/10">
              We will call you from{" "}
              <strong className="text-primary tracking-wide ml-1">800-867-6768</strong>
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Navigation</h4>
            <ul className="space-y-3">
              <li><Link href="/" className="hover:text-primary transition-colors text-sm">Home</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors text-sm">Live Pricing</Link></li>
              <li><Link href="/schedule" className="hover:text-primary transition-colors text-sm">Schedule Call</Link></li>
              <li><Link href="/ira" className="hover:text-primary transition-colors text-sm">IRA Allocation</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors text-sm">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Disclosures</h4>
            <ul className="space-y-3">
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Legal Disclosures</Link></li>
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <a href="tel:8008676768" className="text-white hover:text-primary transition-colors block text-sm">
                    800-867-6768
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-xs text-white/50 leading-snug">Monday – Friday<br />9:00 AM – 5:00 PM CT</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <a href="mailto:info@westhillscapital.com" className="hover:text-primary transition-colors text-sm">
                  info@westhillscapital.com
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-white/35">
          <p>&copy; {new Date().getFullYear()} West Hills Capital. All rights reserved.</p>
          <p className="text-left md:text-right max-w-xl leading-relaxed">
            Precious metals markets carry inherent risk. West Hills Capital provides physical precious metals allocation and execution services. We do not provide investment, legal, or tax advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
