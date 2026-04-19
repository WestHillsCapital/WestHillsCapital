import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAvailableSlots,
  useBookAppointment,
  submitPrequalLead,
} from "@/hooks/use-scheduling";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  PhoneCall,
  AlertCircle,
} from "lucide-react";

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

const prequalSchema = z.object({
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Valid phone required"),
  state: z.string().min(2, "State required"),
  allocationType: z.enum(["physical_delivery", "ira_rollover", "not_sure"]),
  allocationRange: z.enum(["under_50k", "50k_150k", "150k_500k", "500k_plus"]),
  timeline: z.enum(["ready", "within_30_days", "researching"]),
});

type PrequalFormValues = z.infer<typeof prequalSchema>;

function SchedulingUnavailable({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-amber-500" />
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">
          {message ?? "Scheduling is temporarily unavailable."}
        </p>
        <p className="text-foreground/60 text-sm">
          Please call us directly at{" "}
          <a href="tel:8008676768" className="text-primary font-semibold">
            (800) 867-6768
          </a>{" "}
          to schedule your call.
        </p>
      </div>
    </div>
  );
}

export default function Schedule() {
  usePageMeta({
    title: "Schedule a Consultation | West Hills Capital",
    description: "Book a free, no-pressure conversation with a West Hills Capital specialist. We'll answer your questions about physical gold, silver, and IRA rollovers — on your schedule.",
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<PrequalFormValues | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: slotsData, isLoading: loadingSlots, error: slotsError } = useAvailableSlots();
  const bookMutation = useBookAppointment();

  const form = useForm<PrequalFormValues>({
    resolver: zodResolver(prequalSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      state: "",
      allocationType: undefined,
      allocationRange: undefined,
      timeline: undefined,
    },
  });

  const onSubmitPrequal = async (data: PrequalFormValues) => {
    setSubmitting(true);
    setLeadError(null);
    const result = await submitPrequalLead(data);
    setSubmitting(false);
    if (!result.ok) {
      setLeadError(result.message);
    }
    setFormData(data);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSlotSelection = async (slotId: string) => {
    if (!formData) return;
    try {
      await bookMutation.mutateAsync({ slotId, ...formData });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // bookMutation.error holds the message; UI renders it below the slot grid
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-200px)] bg-background pt-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-semibold mb-4">Schedule a Call to Review Your Purchase</h1>
          <p className="text-foreground/65 text-lg mb-3">
            Tell us a bit about your intended purchase, then choose a time that works. We will call you to review pricing, answer questions, and confirm next steps.
          </p>
          <p className="text-sm font-medium text-foreground/55 border border-border/50 bg-white/70 inline-block px-4 py-2 rounded-lg">
            We will call you from <strong className="text-foreground/80">(800) 867-6768</strong>
          </p>
        </div>

        {/* REASSURANCE QUOTE — shown on step 1 only */}
        {step === 1 && (
          <div className="mb-8 border-l-[3px] border-primary/40 pl-5 py-1">
            <p className="text-[15px] text-foreground/65 leading-relaxed italic mb-2">
              "The 'no hassle &amp; no pressure' is what thrills me the most. They advise, they explain, and make sure you are satisfied. Unlike the previous company that badgered me with calls trying to constantly change my position so they could get a commission. I trust WHC and I don't dread their calls."
            </p>
            <p className="text-xs font-semibold text-foreground/45">— Donna S., verified client · Google review</p>
          </div>
        )}

        {/* PROGRESS INDICATOR */}
        {step < 3 && (
          <div className="flex items-center justify-center mb-12">
            <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? "border-primary bg-primary/10" : "border-muted"}`}>1</div>
              <span className="font-medium text-sm hidden sm:block">Intake</span>
            </div>
            <div className={`w-16 h-1 mx-4 rounded ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? "border-primary bg-primary/10" : "border-muted"}`}>2</div>
              <span className="font-medium text-sm hidden sm:block">Select Time</span>
            </div>
          </div>
        )}

        {/* STEP 1: PREQUAL FORM */}
        {step === 1 && (
          <Card className="p-6 md:p-10 animate-fade-in">
            <form onSubmit={form.handleSubmit(onSubmitPrequal)} className="space-y-8">

              <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b border-border pb-2">About Your Interest</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Intended Structure</label>
                    <Select {...form.register("allocationType")}>
                      <option value="" disabled hidden>Select type...</option>
                      <option value="physical_delivery">Physical Home/Vault Delivery</option>
                      <option value="ira_rollover">IRA Rollover / Transfer</option>
                      <option value="not_sure">Not sure yet</option>
                    </Select>
                    {form.formState.errors.allocationType && (
                      <span className="text-destructive text-xs">{form.formState.errors.allocationType.message}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Approximate Investment</label>
                    <Select {...form.register("allocationRange")}>
                      <option value="" disabled hidden>Select range...</option>
                      <option value="under_50k">Under $50,000</option>
                      <option value="50k_150k">$50,000 - $150,000</option>
                      <option value="150k_500k">$150,000 - $500,000</option>
                      <option value="500k_plus">$500,000+</option>
                    </Select>
                    {form.formState.errors.allocationRange && (
                      <span className="text-destructive text-xs">{form.formState.errors.allocationRange.message}</span>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Timeline</label>
                    <Select {...form.register("timeline")}>
                      <option value="" disabled hidden>Select timeline...</option>
                      <option value="ready">Ready to move forward now</option>
                      <option value="within_30_days">Planning within next 30 days</option>
                      <option value="researching">Just researching options</option>
                    </Select>
                    {form.formState.errors.timeline && (
                      <span className="text-destructive text-xs">{form.formState.errors.timeline.message}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b border-border pb-2">Contact Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <Input {...form.register("firstName")} placeholder="John" />
                    {form.formState.errors.firstName && (
                      <span className="text-destructive text-xs">{form.formState.errors.firstName.message}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input {...form.register("lastName")} placeholder="Smith" />
                    {form.formState.errors.lastName && (
                      <span className="text-destructive text-xs">{form.formState.errors.lastName.message}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <Input type="email" {...form.register("email")} placeholder="john@example.com" />
                    {form.formState.errors.email && (
                      <span className="text-destructive text-xs">{form.formState.errors.email.message}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input type="tel" {...form.register("phone")} placeholder="(555) 123-4567" />
                    {form.formState.errors.phone && (
                      <span className="text-destructive text-xs">{form.formState.errors.phone.message}</span>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">State of Residence</label>
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
              </div>

              <Button type="submit" disabled={submitting} className="w-full h-14 text-lg">
                {submitting ? "Saving…" : "Find Available Times"}
              </Button>
            </form>
          </Card>
        )}

        {/* STEP 2: SLOT SELECTION */}
        {step === 2 && (
          <div className="animate-fade-in space-y-8">
            {leadError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Could not save your information</p>
                  <p className="text-red-700 text-sm mt-0.5">{leadError}</p>
                  <p className="text-red-600 text-sm mt-1">
                    Please call us at{" "}
                    <a href="tel:8008676768" className="font-semibold underline">(800) 867-6768</a>{" "}
                    if this problem persists.
                  </p>
                </div>
              </div>
            )}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 mb-8 text-center">
              <PhoneCall className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">We will call you</h3>
              <p className="text-foreground/70">
                A West Hills Capital advisor will call you at the selected time at{" "}
                <strong>{formData?.phone}</strong>.
              </p>
            </div>

            {loadingSlots ? (
              <div className="text-center py-12 text-foreground/50">Loading available times...</div>
            ) : slotsError ? (
              <SchedulingUnavailable message={(slotsError as Error).message} />
            ) : !slotsData?.slots.length ? (
              <SchedulingUnavailable message="No available times found. Please call us to arrange a time." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slotsData.slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotSelection(slot.id)}
                    disabled={bookMutation.isPending}
                    className="flex flex-col items-center justify-center p-6 border-2 border-border/60 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left bg-card disabled:opacity-50"
                  >
                    <CalendarIcon className="w-6 h-6 text-primary mb-3" />
                    <span className="font-semibold text-lg mb-1">{slot.dayLabel}</span>
                    <span className="text-foreground/60">{slot.timeLabel}</span>
                  </button>
                ))}
              </div>
            )}

            {bookMutation.isPending && (
              <div className="text-center py-4 text-foreground/60 text-sm">Confirming your appointment…</div>
            )}

            {bookMutation.isError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Booking failed</p>
                  <p className="text-red-700 text-sm mt-0.5">
                    {bookMutation.error?.message ?? "An unexpected error occurred."}
                  </p>
                  <p className="text-red-600 text-sm mt-1">
                    Please try again or call us at{" "}
                    <a href="tel:8008676768" className="font-semibold underline">
                      (800) 867-6768
                    </a>.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center mt-8">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-foreground/50 hover:text-foreground underline underline-offset-4"
              >
                ← Back to edit information
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION */}
        {step === 3 && bookMutation.data && (
          <Card className="p-10 text-center animate-slide-up border-green-100 bg-green-50/30">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-serif font-semibold mb-4 text-foreground">Call Confirmed</h2>

            <div className="bg-white rounded-lg p-6 mb-8 inline-block shadow-sm border border-border/50">
              <div className="flex items-center justify-center gap-3 text-lg font-medium text-foreground mb-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                {bookMutation.data.dayLabel}
              </div>
              <div className="flex items-center justify-center gap-3 text-lg font-medium text-foreground">
                <Clock className="w-5 h-5 text-primary" />
                {bookMutation.data.timeLabel}
              </div>
            </div>

            <div className="space-y-4 text-foreground/80 max-w-lg mx-auto">
              <p>Your Confirmation ID: <strong className="text-foreground">{bookMutation.data.confirmationId}</strong></p>
              <p className="text-sm text-foreground/60">A confirmation has been sent to your email address.</p>
              <p className="border-t border-border pt-4">
                During the call, we will review your goals, confirm current pricing, and discuss next steps.
              </p>
              <p className="font-semibold text-foreground">
                Reminder: Trades are executed only after verbal confirmation and receipt of cleared funds. We will call you from (800) 867-6768.
              </p>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
