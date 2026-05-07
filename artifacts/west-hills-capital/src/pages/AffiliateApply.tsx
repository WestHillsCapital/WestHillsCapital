import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function AffiliateApply() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/affiliates/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Hero */}
      <div className="bg-[#0F1C3F] text-white py-20 px-6 text-center">
        <p className="text-[#C49A38] text-sm font-semibold uppercase tracking-widest mb-4">Affiliate Program</p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
          Partner with Docuplete
        </h1>
        <p className="text-gray-300 max-w-xl mx-auto text-lg leading-relaxed">
          Earn 20% recurring commission for 12 months on every client you refer.
          Paid monthly via direct bank transfer — no minimums, no hassle.
        </p>
      </div>

      {/* Highlights */}
      <div className="max-w-4xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { value: "20%", label: "Commission rate" },
            { value: "12 months", label: "Earning period per referral" },
            { value: "Monthly", label: "Payout schedule" },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 text-center">
              <p className="text-3xl font-bold text-[#C49A38]">{value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-3xl mx-auto px-6 mt-16">
        <h2 className="text-2xl font-bold text-[#0F1C3F] text-center mb-8">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { step: "1", title: "Apply below", desc: "Tell us a bit about yourself and your audience. We review applications within 2 business days." },
            { step: "2", title: "Get your link", desc: "Once approved, you'll receive a unique referral link and access to your commission dashboard." },
            { step: "3", title: "Earn monthly", desc: "Every active subscription you refer pays 20% commission monthly for up to 12 months." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C49A38] text-white text-sm font-bold flex items-center justify-center shadow">
                {step}
              </div>
              <p className="font-semibold text-[#0F1C3F]">{title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Application form */}
      <div className="max-w-xl mx-auto px-6 mt-16 mb-24">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {success ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#0F1C3F] mb-2">Application received!</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Thanks for applying to the Docuplete affiliate program. We'll review your application
                and follow up via email within 2 business days.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-[#0F1C3F] mb-1">Apply to partner with us</h2>
              <p className="text-sm text-gray-500 mb-6">All fields marked * are required.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 focus:border-[#C49A38]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 focus:border-[#C49A38]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company / organization</label>
                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 focus:border-[#C49A38]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                    placeholder="https://yoursite.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 focus:border-[#C49A38]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tell us about yourself and your audience <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Who are you, who do you serve, and how do you plan to promote Docuplete?"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 focus:border-[#C49A38] resize-none"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#C49A38] hover:bg-[#b08830] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions? Email us at{" "}
          <a href="mailto:affiliates@docuplete.com" className="text-[#C49A38] hover:underline">
            affiliates@docuplete.com
          </a>
        </p>
      </div>
    </div>
  );
}
