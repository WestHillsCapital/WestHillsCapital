import { Link } from "wouter";
import { useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { getCustodianBySlug } from "@/data/seo/custodians";
import { getCustodianFeesBySlug, CustodianFees, AnnualFee } from "@/data/seo/custodian-fees";
import {
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

function VerifiedBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
        <CheckCircle className="w-3.5 h-3.5" /> Fees Verified
      </span>
    );
  }
  if (status === "call-required") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
        <AlertCircle className="w-3.5 h-3.5" /> Verification Pending
      </span>
    );
  }
  return null;
}

function formatAnnualFeeLabel(annualFee: AnnualFee): string {
  if (annualFee.structure === "flat" && annualFee.flatAmount != null) {
    return `$${annualFee.flatAmount}/yr`;
  }
  if ((annualFee.structure === "asset-based" || annualFee.structure === "tiered") && annualFee.tiers?.length) {
    const low = annualFee.tiers[0].fee;
    const high = annualFee.tiers[annualFee.tiers.length - 1].fee;
    return `$${low.toLocaleString()}–$${high.toLocaleString()}/yr`;
  }
  if (annualFee.structure === "per-asset" && annualFee.flatAmount != null) {
    return `$${annualFee.flatAmount}/yr per asset`;
  }
  return "Contact custodian";
}

function FeeCard({ fees }: { fees: CustodianFees }) {
  const isVerified = fees.verificationStatus === "verified";

  const storageCommingled = fees.storageFees.find((s) => s.type === "commingled");
  const storageSegregated = fees.storageFees.find((s) => s.type === "segregated");
  const storageFlat = fees.storageFees.find((s) => s.type === "flat");

  return (
    <div className="bg-foreground rounded-2xl p-6 text-white sticky top-28">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-white">Fee Summary</h3>
        <VerifiedBadge status={fees.verificationStatus} />
      </div>

      {isVerified ? (
        <div className="space-y-4">
          <FeeRow label="Account setup" value={fees.setupFee != null ? `$${fees.setupFee}` : "—"} />
          <FeeRow
            label="Annual maintenance"
            value={formatAnnualFeeLabel(fees.annualFee)}
            sub={fees.annualFee.structure !== "flat" ? fees.annualFee.structure.replace("-", " ") : undefined}
          />

          {storageCommingled && (
            <FeeRow
              label="Commingled storage"
              value={storageCommingled.annualRate != null ? `$${storageCommingled.annualRate}/yr` : "Varies"}
            />
          )}
          {storageSegregated && (
            <FeeRow
              label="Segregated storage"
              value={storageSegregated.annualRate != null ? `$${storageSegregated.annualRate}+ /yr` : "Varies"}
            />
          )}
          {storageFlat && !storageCommingled && !storageSegregated && (
            <FeeRow
              label="Storage"
              value={storageFlat.annualRate != null ? `$${storageFlat.annualRate}/yr` : "Varies"}
            />
          )}

          <FeeRow
            label="Buy / sell metals"
            value={fees.transactionFee === 0 ? "Free" : fees.transactionFee != null ? `$${fees.transactionFee}` : "See notes"}
            highlight={fees.transactionFee === 0}
          />
          {fees.wireTransferFee != null && (
            <FeeRow label="Outgoing wire" value={`$${fees.wireTransferFee}`} />
          )}

          {fees.annualFee.structure !== "flat" && fees.annualFee.tiers && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Annual fee tiers</p>
              {fees.annualFee.tiers.map((tier, i) => (
                <div key={i} className="flex justify-between text-xs py-1">
                  <span className="text-white/55">
                    {i === 0
                      ? `Under $${(tier.upTo! + 1).toLocaleString()}`
                      : tier.upTo == null
                      ? `Over $${fees.annualFee.tiers![i - 1].upTo!.toLocaleString()}`
                      : `$${(fees.annualFee.tiers![i - 1].upTo! + 1).toLocaleString()} – $${tier.upTo.toLocaleString()}`}
                  </span>
                  <span className="text-white font-medium">${tier.fee.toLocaleString()}/yr</span>
                </div>
              ))}
            </div>
          )}

          {fees.summaryNotes && (
            <p className="text-xs text-white/35 leading-relaxed pt-2 border-t border-white/10">
              {fees.summaryNotes}
            </p>
          )}

          {fees.feesUrl && (
            <a
              href={fees.feesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors mt-1"
            >
              View official fee schedule <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-white/60 leading-relaxed">
            Fee verification is in progress for this custodian. Contact us for current details.
          </p>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-white/10">
        <p className="text-xs text-white/35 mb-4">
          Fees are from published schedules and subject to change. Confirm directly before opening an account.
        </p>
        <Link href="/schedule">
          <button className="w-full h-10 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
            Get Started <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}

function FeeRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-white/8">
      <span className="text-sm text-white/55">{label}</span>
      <div className="text-right ml-4">
        <span className={`text-sm font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</span>
        {sub && <p className="text-xs text-white/30 capitalize">{sub}</p>}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        className="w-full flex items-start justify-between text-left py-5 gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-foreground text-sm leading-snug">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-foreground/40 shrink-0 mt-0.5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="text-sm text-foreground/60 leading-relaxed pb-5">{a}</p>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-3xl text-foreground mb-3">Custodian Not Found</h1>
          <p className="text-foreground/55 mb-6 text-sm">
            We couldn't find a custodian page for that URL.
          </p>
          <Link href="/ira/custodians">
            <button className="h-10 px-6 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              View All Custodians
            </button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}

export default function CustodianDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const custodian = getCustodianBySlug(slug);
  const fees = getCustodianFeesBySlug(slug);

  if (!custodian || !fees || fees.verificationStatus === "retired") {
    return <NotFound />;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">

        {/* Breadcrumb */}
        <div className="border-b border-border/40 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-foreground/50">
              <Link href="/ira" className="hover:text-primary transition-colors">IRA Allocation</Link>
              <span>/</span>
              <Link href="/ira/custodians" className="hover:text-primary transition-colors">Custodians</Link>
              <span>/</span>
              <span className="text-foreground/80 font-medium">{custodian.shortName}</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-b from-foreground/[0.03] to-white border-b border-border/30 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-2">
                  Self-Directed IRA Custodian
                </p>
                <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-3">{custodian.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-foreground/55">
                  {custodian.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary/60" />
                      {custodian.location}
                    </span>
                  )}
                  {custodian.founded && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary/60" />
                      Est. {custodian.founded}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <VerifiedBadge status={fees.verificationStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Main content + sidebar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Left: main content */}
            <div className="lg:col-span-2 space-y-12">

              {/* About */}
              <section>
                <h2 className="font-serif text-2xl text-foreground mb-4">About {custodian.shortName}</h2>
                <p className="text-foreground/65 leading-relaxed">{custodian.description}</p>
              </section>

              {/* Account Types */}
              {custodian.accountTypes.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl text-foreground mb-4">Account Types</h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {custodian.accountTypes.map((type) => (
                      <li key={type} className="flex items-center gap-2.5 text-sm text-foreground/70">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        {type}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* How We Work */}
              <section className="bg-primary/[0.04] border border-primary/15 rounded-2xl p-7">
                <h2 className="font-serif text-2xl text-foreground mb-3">
                  How West Hills Capital Works with {custodian.shortName}
                </h2>
                <p className="text-foreground/65 leading-relaxed">{custodian.howWeWork}</p>
              </section>

              {/* Fee Detail (expanded, mobile-only — desktop sees sidebar) */}
              {fees.verificationStatus === "verified" && (
                <section className="lg:hidden">
                  <h2 className="font-serif text-2xl text-foreground mb-5">Fee Details</h2>
                  <FeeCard fees={fees} />
                </section>
              )}

              {/* Setup Steps */}
              {custodian.setupSteps.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl text-foreground mb-6">How to Get Started</h2>
                  <ol className="space-y-6">
                    {custodian.setupSteps.map((s) => (
                      <li key={s.step} className="flex gap-5">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-foreground text-white flex items-center justify-center text-sm font-bold">
                          {s.step}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                          <p className="text-sm text-foreground/60 leading-relaxed">{s.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* FAQs */}
              {custodian.faqs.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl text-foreground mb-2">
                    Frequently Asked Questions
                  </h2>
                  <div className="mt-4">
                    {custodian.faqs.map((faq) => (
                      <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                    ))}
                  </div>
                </section>
              )}

            </div>

            {/* Right: fee sidebar (desktop) */}
            <div className="hidden lg:block">
              <FeeCard fees={fees} />
            </div>

          </div>
        </div>

        {/* Compare link */}
        <div className="border-t border-border/30 py-6 bg-foreground/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-foreground/55">
              Comparing multiple custodians?
            </p>
            <Link href="/ira/custodians">
              <span className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                View the full comparison table <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-foreground py-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="font-serif text-3xl text-white mb-4">
              Ready to open an account with {custodian.shortName}?
            </h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              We can walk you through the process — custodian setup, funding, and executing your first purchase.
              Call us or schedule a conversation at a time that works for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/schedule">
                <button className="h-12 px-8 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2">
                  Schedule a Call <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a href="tel:8008676768" className="h-12 px-8 border border-white/20 text-white rounded-lg font-semibold text-sm hover:border-white/40 transition-colors flex items-center gap-2">
                <Phone className="w-4 h-4" />
                (800) 867-6768
              </a>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
