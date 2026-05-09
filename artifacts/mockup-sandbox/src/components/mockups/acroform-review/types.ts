export type ConfidenceTier = "high" | "medium" | "low";
export type FieldStatus = "confirmed" | "needs-review" | "deferred" | "blank";
export type EdgeCase = "off-page" | "duplicate" | "checkbox-group" | "signature" | "prefilled";

export interface LibraryField {
  id: string;
  label: string;
  key: string;
  category: string;
}

export interface ReviewField {
  id: string;
  pdfName: string;
  pdfType: "text" | "checkbox" | "radio" | "signature" | "select";
  page: number;
  confidence: ConfidenceTier;
  suggestedMatch: LibraryField | null;
  selectedMatch: LibraryField | null;
  status: FieldStatus;
  edgeCases: EdgeCase[];
  touched: boolean;
  prefilledValue?: string;
}

export const LIBRARY_FIELDS: LibraryField[] = [
  { id: "applicant_ssn",       label: "Applicant SSN",                  key: "applicant_ssn",       category: "Applicant" },
  { id: "applicant_dob",       label: "Date of Birth",                  key: "applicant_dob",       category: "Applicant" },
  { id: "applicant_title",     label: "Applicant Title (Mr/Ms/Dr)",     key: "applicant_title",     category: "Applicant" },
  { id: "applicant_legal_name",label: "Legal Name",                     key: "applicant_legal_name",category: "Applicant" },
  { id: "applicant_printed_name", label: "Printed Name",               key: "applicant_printed_name", category: "Applicant" },
  { id: "marital_status",      label: "Marital Status",                 key: "marital_status",      category: "Applicant" },
  { id: "email",               label: "Email Address",                  key: "email",               category: "Contact" },
  { id: "phone_home",          label: "Home Phone",                     key: "phone_home",          category: "Contact" },
  { id: "phone_cell",          label: "Cell Phone",                     key: "phone_cell",          category: "Contact" },
  { id: "fax",                 label: "Fax Number",                     key: "fax",                 category: "Contact" },
  { id: "address_physical",    label: "Physical Address",               key: "address_physical",    category: "Contact" },
  { id: "address_mailing",     label: "Mailing Address",                key: "address_mailing",     category: "Contact" },
  { id: "city",                label: "City",                           key: "city",                category: "Contact" },
  { id: "state",               label: "State",                          key: "state",               category: "Contact" },
  { id: "zip",                 label: "ZIP Code",                       key: "zip",                 category: "Contact" },
  { id: "account_type",        label: "Account Type (IRA/HSA)",         key: "account_type",        category: "Account" },
  { id: "funding_method",      label: "Funding Method",                 key: "funding_method",      category: "Account" },
  { id: "contribution_year",   label: "Contribution Year",              key: "contribution_year",   category: "Account" },
  { id: "employer_name",       label: "Employer Name",                  key: "employer_name",       category: "Account" },
  { id: "cc_type",             label: "Credit Card Type",               key: "cc_type",             category: "Payment" },
  { id: "cc_number",           label: "Card Number",                    key: "cc_number",           category: "Payment" },
  { id: "cc_expiration",       label: "Card Expiration Date",           key: "cc_expiration",       category: "Payment" },
  { id: "cc_name",             label: "Name on Card",                   key: "cc_name",             category: "Payment" },
  { id: "cc_cvv",              label: "Card Security Code (CVV)",       key: "cc_cvv",              category: "Payment" },
  { id: "payment_method",      label: "Payment Method",                 key: "payment_method",      category: "Payment" },
  { id: "ben1_name",           label: "Beneficiary 1 — Name",          key: "ben1_name",           category: "Beneficiary" },
  { id: "ben1_type",           label: "Beneficiary 1 — Primary / Contingent", key: "ben1_type",   category: "Beneficiary" },
  { id: "ben1_relationship",   label: "Beneficiary 1 — Relationship",  key: "ben1_relationship",   category: "Beneficiary" },
  { id: "ben1_ssn",            label: "Beneficiary 1 — SSN",           key: "ben1_ssn",            category: "Beneficiary" },
  { id: "ben1_dob",            label: "Beneficiary 1 — Date of Birth", key: "ben1_dob",            category: "Beneficiary" },
  { id: "ben1_share",          label: "Beneficiary 1 — Share %",       key: "ben1_share",          category: "Beneficiary" },
  { id: "advisor_name",        label: "Advisor / Agent Name",           key: "advisor_name",        category: "Advisor" },
  { id: "referral_source",     label: "Referral Source",                key: "referral_source",     category: "Advisor" },
  { id: "coupon_code",         label: "Coupon Code",                    key: "coupon_code",         category: "Advisor" },
  { id: "date_signed",         label: "Date Signed",                    key: "date_signed",         category: "Signatures" },
  { id: "applicant_signature", label: "Applicant Signature",            key: "applicant_signature", category: "Signatures" },
  { id: "spouse_name",         label: "Spouse Name (Consent)",          key: "spouse_name",         category: "Signatures" },
  { id: "spouse_signature",    label: "Spouse Signature",               key: "spouse_signature",    category: "Signatures" },
  { id: "email_notifications", label: "Email Notifications Preference", key: "email_notifications", category: "Communication" },
];

const lf = (id: string) => LIBRARY_FIELDS.find(f => f.id === id)!;

export const INITIAL_FIELDS: ReviewField[] = [
  // ── HIGH CONFIDENCE ──────────────────────────────────────────────
  { id: "f1",  pdfName: "Social Security Number",                         pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("applicant_ssn"),          selectedMatch: lf("applicant_ssn"),          status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f2",  pdfName: "Date of Birth MMDDYYYY",                         pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("applicant_dob"),          selectedMatch: lf("applicant_dob"),          status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f3",  pdfName: "Email Address",                                   pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("email"),                  selectedMatch: lf("email"),                  status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f4",  pdfName: "Physical Address",                                pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("address_physical"),       selectedMatch: lf("address_physical"),       status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f5",  pdfName: "Home Phone Number",                               pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("phone_home"),             selectedMatch: lf("phone_home"),             status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f6",  pdfName: "Cell Phone",                                      pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("phone_cell"),             selectedMatch: lf("phone_cell"),             status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f7",  pdfName: "Card Number",                                     pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("cc_number"),              selectedMatch: lf("cc_number"),              status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f8",  pdfName: "Exp Date",                                        pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("cc_expiration"),          selectedMatch: lf("cc_expiration"),          status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f9",  pdfName: "3 Digit Security Code",                           pdfType: "text",  page: 1, confidence: "high",   suggestedMatch: lf("cc_cvv"),                 selectedMatch: lf("cc_cvv"),                 status: "confirmed",    edgeCases: [],                         touched: true  },
  { id: "f10", pdfName: "Printed Name",                                    pdfType: "text",  page: 2, confidence: "high",   suggestedMatch: lf("applicant_printed_name"), selectedMatch: lf("applicant_printed_name"), status: "confirmed",    edgeCases: [],                         touched: true  },
  // ── MEDIUM CONFIDENCE ─────────────────────────────────────────────
  { id: "f11", pdfName: "Date",                                            pdfType: "text",  page: 1, confidence: "medium", suggestedMatch: lf("date_signed"),            selectedMatch: lf("date_signed"),            status: "needs-review", edgeCases: ["duplicate"],              touched: false },
  { id: "f12", pdfName: "Exact Name on Card",                              pdfType: "text",  page: 1, confidence: "medium", suggestedMatch: lf("cc_name"),                selectedMatch: lf("cc_name"),                status: "needs-review", edgeCases: ["prefilled"],              touched: false, prefilledValue: "West Hills Capital" },
  { id: "f13", pdfName: "Mailing Address If different from Physical Address", pdfType: "text", page: 1, confidence: "medium", suggestedMatch: lf("address_mailing"),     selectedMatch: lf("address_mailing"),        status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f14", pdfName: "Account Type",                                    pdfType: "radio", page: 1, confidence: "medium", suggestedMatch: lf("account_type"),           selectedMatch: lf("account_type"),           status: "needs-review", edgeCases: ["checkbox-group"],         touched: false },
  { id: "f15", pdfName: "Fund How",                                        pdfType: "radio", page: 1, confidence: "medium", suggestedMatch: lf("funding_method"),         selectedMatch: lf("funding_method"),         status: "needs-review", edgeCases: ["checkbox-group","prefilled"], touched: false, prefilledValue: "Transfer" },
  { id: "f16", pdfName: "Contribution Year",                               pdfType: "text",  page: 1, confidence: "medium", suggestedMatch: lf("contribution_year"),      selectedMatch: lf("contribution_year"),      status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f17", pdfName: "SingleorMarried",                                 pdfType: "radio", page: 1, confidence: "medium", suggestedMatch: lf("marital_status"),         selectedMatch: lf("marital_status"),         status: "needs-review", edgeCases: ["checkbox-group"],         touched: false },
  { id: "f18", pdfName: "Name",                                            pdfType: "text",  page: 2, confidence: "medium", suggestedMatch: lf("ben1_name"),              selectedMatch: lf("ben1_name"),              status: "needs-review", edgeCases: ["duplicate"],              touched: false },
  { id: "f19", pdfName: "Relationship",                                    pdfType: "text",  page: 2, confidence: "medium", suggestedMatch: lf("ben1_relationship"),      selectedMatch: lf("ben1_relationship"),      status: "needs-review", edgeCases: ["duplicate"],              touched: false },
  { id: "f20", pdfName: "Beneficiary Group 1",                             pdfType: "radio", page: 2, confidence: "medium", suggestedMatch: lf("ben1_type"),              selectedMatch: lf("ben1_type"),              status: "needs-review", edgeCases: ["checkbox-group"],         touched: false },
  { id: "f21", pdfName: "Date_2",                                          pdfType: "text",  page: 2, confidence: "medium", suggestedMatch: lf("date_signed"),            selectedMatch: lf("date_signed"),            status: "needs-review", edgeCases: ["duplicate"],              touched: false },
  // ── LOW CONFIDENCE ────────────────────────────────────────────────
  { id: "f22", pdfName: "undefined",                                       pdfType: "text",  page: 1, confidence: "low",    suggestedMatch: null,                         selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f23", pdfName: "undefined_2",                                     pdfType: "text",  page: 1, confidence: "low",    suggestedMatch: null,                         selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f24", pdfName: "Email Notifications with Account Changes Yes No", pdfType: "text",  page: 1, confidence: "low",    suggestedMatch: lf("email_notifications"),    selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f25", pdfName: "Married Not Married",                             pdfType: "text",  page: 1, confidence: "low",    suggestedMatch: lf("marital_status"),         selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f26", pdfName: "By",                                              pdfType: "text",  page: 2, confidence: "low",    suggestedMatch: null,                         selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f27", pdfName: "I",                                               pdfType: "text",  page: 2, confidence: "low",    suggestedMatch: null,                         selectedMatch: null,                         status: "needs-review", edgeCases: [],                         touched: false },
  { id: "f28", pdfName: "undefined_9",                                     pdfType: "text",  page: 3, confidence: "low",    suggestedMatch: lf("advisor_name"),           selectedMatch: null,                         status: "needs-review", edgeCases: ["prefilled"],              touched: false, prefilledValue: "West Hills Capital" },
];
