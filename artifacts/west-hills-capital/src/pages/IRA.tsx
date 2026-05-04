import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitLeadIntake } from "@/hooks/use-leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Building2, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

const iraSchema = z.object({
  firstName: z.string().min(2, "Required"),
  lastName: z.string().min(2, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Required"),
  state: z.string().min(2, "Required"),
  currentCustodian: z.string().min(2, "Required"),
});

type IraFormValues = z.infer<typeof iraSchema>;

export default function IRA() {
  usePageMeta({
    title: "Precious Metals IRA | West Hills Capital",
    description: "Roll over or transfer an existing IRA into a self-directed account holding American Gold Eagles, Gold Buffalos, or Silver Eagles. West Hills Capital walks through every step. Call (800) 867-6768.",
    ogTitle: "Precious Metals IRA | West Hills Capital",
    ogDescription: "Hold physical gold and silver in a self-directed IRA. Same coins, same transparent pricing — held at an approved depository. Call (800) 867-6768.",
    ogImage: "https://westhillscapital.com/og-ira.jpg",
    canonical: "https://westhillscapital.com/ira",
  });

  const mutation = useSubmitLeadIntake();

  const form = useForm<IraFormValues>({
    resolver: zodResolver(iraSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      state: "",
      currentCustodian: "",
    },
  });

  const onSubmit = (data: IraFormValues) => {
    mutation.mutate({ formType: "ira", ...data });
  };

  return (
    <div className="w-full bg-background min-h-screen">
      {/* HEADER */}
      <section className="relative bg-foreground text-white py-24 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/ira-banner.webp`}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-foreground/80" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5 text-primary">
            Precious Metals IRA Allocation
          </h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            IRA allocations require proper custodial coordination. We guide you through the process step-by-step — from rollover or transfer to depository delivery — without the sales pressure.
          </p>
        </div>
      </section>

      {/* ROLLOVER FROM YOUR ACCOUNT TYPE */}
      <section className="py-16 bg-white border-t border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl lg:text-3xl font-serif font-semibold mb-3">Rollover From Your Account Type</h2>
            <p className="text-foreground/60 max-w-xl mx-auto">
              Different account types have different rules. Select yours to learn what applies.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mb-6">
            {[
              { label: "401(k)", slug: "401k" },
              { label: "Roth IRA", slug: "roth-ira" },
              { label: "SEP IRA", slug: "sep-ira" },
              { label: "403(b)", slug: "403b" },
              { label: "TSP", slug: "tsp" },
              { label: "457(b)", slug: "457b" },
              { label: "SIMPLE IRA", slug: "simple-ira" },
              { label: "Pension", slug: "pension" },
            ].map((item) => (
              <Link key={item.slug} href={`/ira/rollover/${item.slug}`}>
                <div className="group bg-background border border-border/40 rounded-xl p-3.5 text-center hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <p className="text-sm font-semibold text-foreground/70 group-hover:text-primary transition-colors">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-foreground/40 mt-0.5">Rollover guide →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CHOOSE YOUR CUSTODIAN */}
      <section className="py-16 bg-background border-t border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl lg:text-3xl font-serif font-semibold mb-3">Choose Your Custodian</h2>
            <p className="text-foreground/60 max-w-xl mx-auto">
              West Hills Capital coordinates with any IRS-approved self-directed IRA custodian. We have worked with all of the following.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-6">
            {[
              { name: "Equity Trust", slug: "equity-trust" },
              { name: "Strata Trust", slug: "strata-trust" },
              { name: "Kingdom Trust", slug: "kingdom-trust" },
              { name: "GoldStar Trust", slug: "goldstar-trust" },
              { name: "Midland IRA", slug: "midland-ira" },
            ].map((c) => (
              <Link key={c.slug} href={`/ira/custodians/${c.slug}`}>
                <div className="group bg-white border border-border/40 rounded-xl p-4 text-center hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <p className="text-sm font-semibold text-foreground/75 group-hover:text-primary transition-colors">
                    {c.name}
                  </p>
                  <p className="text-[10px] text-foreground/40 mt-0.5">Learn how we work together →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEO — Norm vs Tom */}
      <section className="py-14 bg-white border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] text-primary font-semibold uppercase tracking-[0.18em] mb-3">See It In Action</p>
          <h2 className="text-2xl font-serif font-semibold mb-3">Same Salary. Different Choice. Wildly Different Retirement.</h2>
          <p className="text-[14.5px] text-foreground/60 leading-relaxed mb-8 max-w-xl mx-auto">
            Two men. Same salary, same start date, same savings rate. One put his savings in gold — the other in CDs. Watch what happened over 40 years.
          </p>
          <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg max-w-2xl mx-auto">
            <iframe
              src="https://www.youtube.com/embed/zrNAPJCKNog"
              title="Same Salary. Same Start. Why Is Norm Rich and Tom Broke in Retirement?"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            {/* CONTENT */}
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-serif font-semibold mb-5">How the Process Works</h2>
                <p className="text-foreground/65 mb-8 leading-relaxed">
                  The IRS specifies which physical metals qualify for IRA inclusion, and requires those metals to be held by an approved custodian at a registered depository. Our role is to source compliant metals at wholesale pricing and coordinate logistics between your custodian and the vault.
                </p>

                <div className="space-y-7">
                  <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1.5">1. Custodial Setup & Funding</h3>
                      <p className="text-foreground/65 text-sm leading-relaxed">
                        Establish an account with a directed IRA custodian, then initiate a tax-free rollover or transfer from your existing retirement account. We can refer you to custodians familiar with physical metals if needed.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1.5">2. Trade Confirmation</h3>
                      <p className="text-foreground/65 text-sm leading-relaxed">
                        Once your funds have cleared at the custodian, we confirm the trade verbally at current wholesale pricing. No trade is executed before funds are fully settled.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1.5">3. Depository Delivery</h3>
                      <p className="text-foreground/65 text-sm leading-relaxed">
                        Metals are shipped directly to the institutional depository designated by your custodian, where they are held securely under your account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-border/50 bg-muted/30">
                <p className="text-sm text-foreground/65 leading-relaxed">
                  <strong className="text-foreground">Important:</strong> IRA allocations execute only after funds are received and cleared by the custodian. Physical metals vaulted under your IRA remain yours — they are held in your name at a registered depository and are not commingled with other accounts.
                </p>
              </div>
            </div>

            {/* FORM */}
            <div>
              <Card className="p-8 shadow-md border-t-4 border-t-primary">
                {mutation.isSuccess ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-5" />
                    <h3 className="text-2xl font-serif font-semibold mb-4">Request Received</h3>
                    <p className="text-foreground/65 leading-relaxed">
                      Our team has received your information. We will call you shortly to discuss the rollover or transfer process and answer any questions about IRA-eligible metals.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-7">
                      <h3 className="text-2xl font-serif font-semibold mb-2">Request IRA Information</h3>
                      <p className="text-foreground/55 text-sm">
                        Submit your details and we will call you to walk through your options.
                      </p>
                    </div>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">First Name</label>
                          <Input {...form.register("firstName")} />
                          {form.formState.errors.firstName && (
                            <span className="text-destructive text-xs">{form.formState.errors.firstName.message}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Last Name</label>
                          <Input {...form.register("lastName")} />
                          {form.formState.errors.lastName && (
                            <span className="text-destructive text-xs">{form.formState.errors.lastName.message}</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Email Address</label>
                        <Input type="email" {...form.register("email")} />
                        {form.formState.errors.email && (
                          <span className="text-destructive text-xs">{form.formState.errors.email.message}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Phone</label>
                          <Input type="tel" {...form.register("phone")} />
                          {form.formState.errors.phone && (
                            <span className="text-destructive text-xs">{form.formState.errors.phone.message}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">State</label>
                          <select
                            {...form.register("state")}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select state…</option>
                            {US_STATES.map(([abbr, name]) => (
                              <option key={abbr} value={abbr}>{name}</option>
                            ))}
                          </select>
                          {form.formState.errors.state && (
                            <span className="text-destructive text-xs">{form.formState.errors.state.message}</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">
                          Current Retirement Custodian (e.g., Fidelity, Vanguard, Schwab)
                        </label>
                        <Input {...form.register("currentCustodian")} />
                        {form.formState.errors.currentCustodian && (
                          <span className="text-destructive text-xs">{form.formState.errors.currentCustodian.message}</span>
                        )}
                      </div>

                      <Button type="submit" disabled={mutation.isPending} className="w-full h-12 mt-2">
                        {mutation.isPending ? "Submitting..." : "Request Call"}
                      </Button>
                      <p className="text-center text-xs text-foreground/40">
                        By submitting, you agree to be contacted by West Hills Capital at the number provided.
                      </p>
                    </form>
                  </>
                )}
              </Card>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
