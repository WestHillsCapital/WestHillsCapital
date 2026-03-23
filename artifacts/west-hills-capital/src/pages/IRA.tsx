import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitLeadIntake } from "@/hooks/use-leads";
import { Card, CardContent } from "@/components/ui/card";
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
      firstName: "", lastName: "", email: "", phone: "", state: "", currentCustodian: ""
    }
  });

  const onSubmit = (data: IraFormValues) => {
    mutation.mutate({
      formType: "ira",
      ...data
    });
  };

  return (
    <div className="w-full bg-background min-h-screen">
      {/* HEADER */}
      <section className="bg-foreground text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-6">Precious Metals IRA Allocation</h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transitioning retirement assets into physical gold and silver is a procedural matter requiring accuracy and proper custodial alignment. We guide you through the structural mechanics without the sales pressure.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* CONTENT */}
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-serif font-semibold mb-6">The Allocation Process</h2>
                <p className="text-foreground/70 mb-8 leading-relaxed">
                  The IRS strictly regulates which physical precious metals are eligible for inclusion in an IRA, and requires those metals to be held by an approved custodian in a registered depository. Our role is to ensure compliant acquisition and coordinate the logistics between your custodian and the vault.
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">1. Custodial Setup & Funding</h3>
                      <p className="text-foreground/70">Establish an account with a directed IRA custodian and initiate a tax-free rollover or transfer of funds from your existing retirement account.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">2. Trade Confirmation</h3>
                      <p className="text-foreground/70">Once funds have cleared at the custodian, we execute a verbal trade confirmation for IRA-eligible physical metals at live wholesale pricing.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">3. Depository Delivery</h3>
                      <p className="text-foreground/70">Metals are securely shipped directly to the institutional depository designated by your custodian, where they remain safely vaulted under your account.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM */}
            <div>
              <Card className="p-8 shadow-xl border-t-4 border-t-primary">
                {mutation.isSuccess ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
                    <h3 className="text-2xl font-serif font-semibold mb-4">Request Received</h3>
                    <p className="text-foreground/70">
                      Our IRA specialists have received your information. We will call you shortly to discuss the rollover process and answer any structural questions.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h3 className="text-2xl font-serif font-semibold mb-2">Request IRA Information</h3>
                      <p className="text-foreground/60 text-sm">Submit your details below to receive guidance on eligible accounts and the rollover process.</p>
                    </div>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">First Name</label>
                          <Input {...form.register("firstName")} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Last Name</label>
                          <Input {...form.register("lastName")} />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Email Address</label>
                        <Input type="email" {...form.register("email")} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Phone</label>
                          <Input type="tel" {...form.register("phone")} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">State</label>
                          <Input {...form.register("state")} placeholder="TX" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Current Retirement Custodian (e.g., Fidelity, Vanguard)</label>
                        <Input {...form.register("currentCustodian")} />
                      </div>

                      <Button type="submit" disabled={mutation.isPending} className="w-full h-12 mt-4">
                        {mutation.isPending ? "Submitting..." : "Request Call"}
                      </Button>
                      <p className="text-center text-xs text-foreground/40 mt-4">
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
