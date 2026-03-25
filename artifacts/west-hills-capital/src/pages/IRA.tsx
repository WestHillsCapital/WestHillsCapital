import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitLeadIntake } from "@/hooks/use-leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Building2, FileText, CheckCircle2 } from "lucide-react";

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
          src={`${import.meta.env.BASE_URL}images/ira-banner.jpg`}
          alt=""
          aria-hidden="true"
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
                          <Input {...form.register("state")} placeholder="TX" />
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
