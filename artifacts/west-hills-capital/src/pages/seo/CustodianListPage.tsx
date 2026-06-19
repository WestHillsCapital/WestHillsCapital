import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { CUSTODIANS } from "@/data/seo/custodians";
import { getVerifiedCustodianFees, getActiveCustodianFees, CustodianFees } from "@/data/seo/custodian-fees";
import { ArrowRight, CheckCircle, AlertCircle, Phone, ShieldCheck } from "lucide-react";

function formatAnnualFee(fees: CustodianFees): string {
  const { annualFee } = fees;
  if (annualFee.structure === "flat" && annualFee.flatAmount != null) {
    return `$${annualFee.flatAmount}/yr`;
  }
  if (annualFee.structure === "asset-based" && annualFee.tiers?.length) {
    const low = annualFee.tiers[0].fee;
    const high = annualFee.tiers[annualFee.tiers.length - 1].fee;
    return `$${low.toLocaleString()}–$${high.toLocaleString()}/yr`;
  }
  if (annualFee.structure === "tiered" && annualFee.tiers?.length) {
    const low = annualFee.tiers[0].fee;
    const high = annualFee.tiers[annualFee.tiers.length - 1].fee;
    return `$${low.toLocaleString()}–$${high.toLocaleString()}/yr`;
  }
  if (annualFee.structure === "per-asset" && annualFee.flatAmount != null) {
    return `$${annualFee.flatAmount}/yr per asset`;
  }
  return "Contact custodian";
}

function formatStorage(fees: CustodianFees, type: "commingled" | "segregated"): string {
  const match = fees.storageFees.find((s) => s.type === type);
  if (!match) return "—";
  if (match.annualRate == null) return "Varies";
  return `$${match.annualRate}/yr`;
}

function formatBuySell(fees: CustodianFees): string {
  if (fees.transactionFee === 0) return "Free";
  if (fees.transactionFee == null) return fees.transactionFeeNotes ? "See notes" : "—";
  return `$${fees.transactionFee}`;
}

function VerifiedBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> Verified
      </span>
    );
  }
  if (status === "call-required") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" /> Verifying
      </span>
    );
  }
  return null;
}

export default function CustodianListPage() {
  const verifiedFees = getVerifiedCustodianFees();
  const activeFees = getActiveCustodianFees();

  const activeCustodians = CUSTODIANS.filter((c) =>
    activeFees.some((f) => f.slug === c.slug)
  );

  return (
    <Layout>
      <div className="min-h-screen bg-white">

        {/* Breadcrumb */}
        <div className="border-b border-border/40 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-foreground/50">
              <Link href="/ira" className="hover:text-primary transition-colors">IRA Allocation</Link>
              <span>/</span>
              <span className="text-foreground/80 font-medium">Custodians</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-b from-foreground/[0.03] to-white border-b border-border/30 py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">Self-Directed IRA</p>
            <h1 className="font-serif text-4xl lg:text-5xl text-foreground mb-5 leading-tight">
              IRA Custodians We Work With
            </h1>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto leading-relaxed">
              To hold physical gold or silver in an IRA, you need a self-directed IRA custodian — a specialized trust company
              that administers the account under IRS rules. We've worked with the firms below and can coordinate your
              purchase once your account is established.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-white border border-border/60 rounded-xl px-5 py-3 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-foreground/70">
                <strong className="text-foreground">We don't accept referral fees from custodians.</strong>{" "}
                These are firms we've worked with — listed for transparency.
              </p>
            </div>
          </div>
        </div>

        {/* Fee Comparison Table */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h2 className="font-serif text-2xl lg:text-3xl text-foreground mb-2">Fee Comparison</h2>
            <p className="text-foreground/55 text-sm">
              All figures from verified fee schedules.{" "}
              {verifiedFees.length < activeFees.length && "One custodian is awaiting verification."}
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border/50 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-foreground text-white">
                  <th className="text-left px-6 py-4 font-semibold w-44">Custodian</th>
                  <th className="text-center px-4 py-4 font-semibold">Setup Fee</th>
                  <th className="text-center px-4 py-4 font-semibold">Annual Fee</th>
                  <th className="text-center px-4 py-4 font-semibold">Commingled Storage</th>
                  <th className="text-center px-4 py-4 font-semibold">Segregated Storage</th>
                  <th className="text-center px-4 py-4 font-semibold">Buy / Sell</th>
                  <th className="text-center px-4 py-4 font-semibold">Wire Out</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {activeFees.map((fees, i) => {
                  const custodian = CUSTODIANS.find((c) => c.slug === fees.slug);
                  const isVerified = fees.verificationStatus === "verified";
                  return (
                    <tr key={fees.slug} className={`border-t border-border/30 ${i % 2 === 0 ? "bg-white" : "bg-foreground/[0.015]"}`}>
                      <td className="px-6 py-5">
                        <div className="font-semibold text-foreground leading-snug">
                          {custodian?.shortName ?? fees.name}
                        </div>
                        <div className="mt-1">
                          <VerifiedBadge status={fees.verificationStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center text-foreground/80">
                        {isVerified ? (fees.setupFee != null ? `$${fees.setupFee}` : "—") : "—"}
                      </td>
                      <td className="px-4 py-5 text-center text-foreground/80 font-medium">
                        {isVerified ? formatAnnualFee(fees) : "—"}
                      </td>
                      <td className="px-4 py-5 text-center text-foreground/80">
                        {isVerified ? formatStorage(fees, "commingled") : "—"}
                      </td>
                      <td className="px-4 py-5 text-center text-foreground/80">
                        {isVerified ? formatStorage(fees, "segregated") : "—"}
                      </td>
                      <td className="px-4 py-5 text-center font-medium">
                        {isVerified ? (
                          <span className={fees.transactionFee === 0 ? "text-emerald-700" : "text-foreground/80"}>
                            {formatBuySell(fees)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-5 text-center text-foreground/80">
                        {isVerified ? (fees.wireTransferFee != null ? `$${fees.wireTransferFee}` : "—") : "—"}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <Link href={`/ira/custodians/${fees.slug}`}>
                          <span className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1">
                            Details <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked fee cards */}
          <div className="lg:hidden space-y-4">
            {activeFees.map((fees) => {
              const custodian = CUSTODIANS.find((c) => c.slug === fees.slug);
              const isVerified = fees.verificationStatus === "verified";
              return (
                <div key={fees.slug} className="border border-border/50 rounded-2xl p-5 bg-white shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{custodian?.shortName ?? fees.name}</h3>
                      {custodian?.location && (
                        <p className="text-xs text-foreground/50 mt-0.5">{custodian.location}</p>
                      )}
                    </div>
                    <VerifiedBadge status={fees.verificationStatus} />
                  </div>
                  {isVerified ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Setup</dt>
                        <dd className="font-medium text-foreground">{fees.setupFee != null ? `$${fees.setupFee}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Annual</dt>
                        <dd className="font-medium text-foreground">{formatAnnualFee(fees)}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Commingled</dt>
                        <dd className="font-medium text-foreground">{formatStorage(fees, "commingled")}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Segregated</dt>
                        <dd className="font-medium text-foreground">{formatStorage(fees, "segregated")}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Buy / Sell</dt>
                        <dd className={`font-medium ${fees.transactionFee === 0 ? "text-emerald-700" : "text-foreground"}`}>
                          {formatBuySell(fees)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-foreground/45 text-xs uppercase tracking-wide mb-0.5">Wire Out</dt>
                        <dd className="font-medium text-foreground">{fees.wireTransferFee != null ? `$${fees.wireTransferFee}` : "—"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-foreground/50 italic">Fee verification in progress.</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <Link href={`/ira/custodians/${fees.slug}`}>
                      <span className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1">
                        View full details <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-foreground/40">
            Fees verified from published schedules. Storage fees are billed by the depository, not the custodian, unless
            noted otherwise. Schedules are subject to change — confirm directly with the custodian before opening an account.
          </p>
        </div>

        {/* Custodian Cards */}
        <div className="bg-foreground/[0.02] border-t border-border/30 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-2xl lg:text-3xl text-foreground mb-10">About Each Custodian</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeCustodians.map((custodian) => {
                const fees = activeFees.find((f) => f.slug === custodian.slug);
                return (
                  <div key={custodian.slug} className="bg-white border border-border/50 rounded-2xl p-7 shadow-sm flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-serif text-xl text-foreground">{custodian.name}</h3>
                        <p className="text-sm text-foreground/50 mt-0.5">
                          {custodian.location}
                          {custodian.founded ? ` · Est. ${custodian.founded}` : ""}
                        </p>
                      </div>
                      {fees && <VerifiedBadge status={fees.verificationStatus} />}
                    </div>
                    <p className="text-sm text-foreground/65 leading-relaxed flex-1 mb-5">{custodian.description}</p>
                    {custodian.accountTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {custodian.accountTypes.slice(0, 4).map((type) => (
                          <span
                            key={type}
                            className="text-xs bg-primary/8 text-primary/80 border border-primary/15 px-2.5 py-1 rounded-full"
                          >
                            {type}
                          </span>
                        ))}
                        {custodian.accountTypes.length > 4 && (
                          <span className="text-xs text-foreground/40 px-2 py-1">
                            +{custodian.accountTypes.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                    <Link href={`/ira/custodians/${custodian.slug}`}>
                      <button className="w-full h-10 rounded-lg border border-primary/30 text-primary text-sm font-semibold hover:bg-primary hover:text-white transition-all duration-150 flex items-center justify-center gap-1.5">
                        View Details <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* What West Hills Does */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl lg:text-3xl text-foreground mb-3">Our Role in the Process</h2>
            <p className="text-foreground/55 max-w-xl mx-auto">
              West Hills Capital handles the metals side — sourcing, pricing, and delivery. The custodian handles the
              administrative and legal side. Here's how the two roles fit together.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "You open the IRA",
                body: "You choose a custodian and open a self-directed IRA account directly with them. We are not involved in the account setup.",
              },
              {
                step: "02",
                title: "Funds transfer in",
                body: "You roll over or transfer funds from your existing retirement account. The custodian coordinates the incoming transfer.",
              },
              {
                step: "03",
                title: "We execute the purchase",
                body: "Once funds are cleared, the custodian issues a buy direction to us. We confirm pricing with you and ship metal directly to your depository.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center p-6 bg-foreground/[0.02] rounded-2xl border border-border/30">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-foreground/55 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-foreground py-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="font-serif text-3xl text-white mb-4">Questions about custodians?</h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              We're happy to walk through the differences and help you think through which custodian fits your situation.
              No pressure — just a conversation.
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
