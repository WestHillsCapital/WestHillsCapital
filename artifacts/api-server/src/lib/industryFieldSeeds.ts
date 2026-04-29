import type { Pool } from "pg";
import { logger } from "./logger";

export type IndustryKey =
  | "financial_services"
  | "insurance"
  | "real_estate"
  | "legal"
  | "healthcare"
  | "general";

type SeedField = {
  id: string;
  label: string;
  category: string;
  field_type: "text" | "date" | "dropdown" | "checkbox" | "number";
  source: string;
  sensitive: boolean;
  required: boolean;
  validation_type: string;
  validation_pattern?: string;
  validation_message?: string;
  options: string[];
  sort_order: number;
};

const FINANCIAL_SERVICES_FIELDS: SeedField[] = [
  { id: "fs_investment_account_number",    label: "Investment account number",        category: "Investment account",  field_type: "text",     source: "investmentAccountNumber",    sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 200 },
  { id: "fs_account_type",                 label: "Account type",                     category: "Investment account",  field_type: "dropdown", source: "accountType",                sensitive: false, required: true,  validation_type: "none",  options: ["Individual", "Joint", "Traditional IRA", "Roth IRA", "SEP IRA", "Trust"], sort_order: 210 },
  { id: "fs_portfolio_value",              label: "Portfolio value ($)",               category: "Financial profile",   field_type: "text",     source: "portfolioValue",             sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 220 },
  { id: "fs_annual_income",                label: "Annual income ($)",                 category: "Financial profile",   field_type: "text",     source: "annualIncome",               sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 230 },
  { id: "fs_net_worth",                    label: "Net worth ($)",                     category: "Financial profile",   field_type: "text",     source: "netWorth",                   sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 240 },
  { id: "fs_liquid_net_worth",             label: "Liquid net worth ($)",              category: "Financial profile",   field_type: "text",     source: "liquidNetWorth",             sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 250 },
  { id: "fs_tax_bracket",                  label: "Tax bracket",                       category: "Financial profile",   field_type: "dropdown", source: "taxBracket",                 sensitive: false, required: false, validation_type: "none",  options: ["10%", "12%", "22%", "24%", "32%", "35%", "37%"], sort_order: 260 },
  { id: "fs_risk_tolerance",               label: "Risk tolerance",                    category: "Investment profile",  field_type: "dropdown", source: "riskTolerance",              sensitive: false, required: true,  validation_type: "none",  options: ["Conservative", "Moderately Conservative", "Moderate", "Moderately Aggressive", "Aggressive"], sort_order: 270 },
  { id: "fs_investment_objective",         label: "Investment objective",              category: "Investment profile",  field_type: "dropdown", source: "investmentObjective",        sensitive: false, required: true,  validation_type: "none",  options: ["Capital preservation", "Income", "Growth and income", "Growth", "Speculation"], sort_order: 280 },
  { id: "fs_time_horizon",                 label: "Investment time horizon",           category: "Investment profile",  field_type: "dropdown", source: "timeHorizon",                sensitive: false, required: false, validation_type: "none",  options: ["Short-term (< 3 years)", "Medium-term (3–7 years)", "Long-term (7+ years)"], sort_order: 290 },
  { id: "fs_investment_experience",        label: "Investment experience",             category: "Investment profile",  field_type: "dropdown", source: "investmentExperience",       sensitive: false, required: false, validation_type: "none",  options: ["None", "Limited (< 1 year)", "Some (1–3 years)", "Experienced (3–10 years)", "Extensive (10+ years)"], sort_order: 300 },
  { id: "fs_dividend_reinvestment",        label: "Reinvest dividends?",               category: "Investment profile",  field_type: "dropdown", source: "dividendReinvestment",       sensitive: false, required: false, validation_type: "none",  options: ["Yes — reinvest", "No — pay to cash"], sort_order: 310 },
  { id: "fs_employer_name",                label: "Employer name",                     category: "Employment",          field_type: "text",     source: "employerName",               sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 320 },
  { id: "fs_occupation",                   label: "Occupation",                        category: "Employment",          field_type: "text",     source: "occupation",                 sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 330 },
  { id: "fs_joint_account_holder_name",    label: "Joint account holder full name",    category: "Joint account",       field_type: "text",     source: "jointAccountHolderName",     sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 340 },
  { id: "fs_joint_holder_ssn",             label: "Joint account holder SSN",          category: "Joint account",       field_type: "text",     source: "jointHolderSsn",             sensitive: true,  required: false, validation_type: "ssn",   options: [], sort_order: 350 },
  { id: "fs_trusted_contact_name",         label: "Trusted contact full name",         category: "Trusted contact",     field_type: "text",     source: "trustedContactName",         sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 360 },
  { id: "fs_trusted_contact_phone",        label: "Trusted contact phone",             category: "Trusted contact",     field_type: "text",     source: "trustedContactPhone",        sensitive: false, required: false, validation_type: "phone", options: [], sort_order: 370 },
  { id: "fs_trusted_contact_relationship", label: "Trusted contact relationship",      category: "Trusted contact",     field_type: "text",     source: "trustedContactRelationship", sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 380 },
  { id: "fs_bank_name",                    label: "Bank name",                         category: "Banking",             field_type: "text",     source: "bankName",                   sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 390 },
  { id: "fs_bank_routing_number",          label: "Bank routing number",               category: "Banking",             field_type: "text",     source: "bankRoutingNumber",          sensitive: true,  required: false, validation_type: "custom", validation_pattern: "^\\d{9}$", validation_message: "Enter a valid 9-digit routing number.", options: [], sort_order: 400 },
  { id: "fs_bank_account_number",          label: "Bank account number",               category: "Banking",             field_type: "text",     source: "bankAccountNumber",          sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 410 },
  { id: "fs_contribution_amount",          label: "Contribution amount ($)",           category: "Transaction",         field_type: "text",     source: "contributionAmount",         sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 420 },
  { id: "fs_withdrawal_amount",            label: "Withdrawal amount ($)",             category: "Transaction",         field_type: "text",     source: "withdrawalAmount",           sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 430 },
  { id: "fs_spousal_consent",              label: "Spousal consent obtained?",         category: "Compliance",          field_type: "dropdown", source: "spousalConsent",             sensitive: false, required: false, validation_type: "none",  options: ["Yes", "No", "Not applicable"], sort_order: 440 },
];

const INSURANCE_FIELDS: SeedField[] = [
  { id: "ins_policy_number",               label: "Policy number",                     category: "Policy",              field_type: "text",     source: "policyNumber",               sensitive: false, required: true,  validation_type: "none",  options: [], sort_order: 200 },
  { id: "ins_coverage_type",               label: "Coverage type",                     category: "Policy",              field_type: "dropdown", source: "coverageType",               sensitive: false, required: true,  validation_type: "none",  options: ["Term life", "Whole life", "Universal life", "Variable life", "Auto", "Homeowners", "Health", "Disability", "Umbrella"], sort_order: 210 },
  { id: "ins_coverage_amount",             label: "Coverage amount ($)",               category: "Policy",              field_type: "text",     source: "coverageAmount",             sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 220 },
  { id: "ins_premium_amount",              label: "Premium amount ($)",                category: "Policy",              field_type: "text",     source: "premiumAmount",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 230 },
  { id: "ins_premium_frequency",           label: "Premium payment frequency",         category: "Policy",              field_type: "dropdown", source: "premiumFrequency",           sensitive: false, required: false, validation_type: "none",  options: ["Monthly", "Quarterly", "Semi-annually", "Annually"], sort_order: 240 },
  { id: "ins_policy_effective_date",       label: "Policy effective date",             category: "Policy",              field_type: "date",     source: "policyEffectiveDate",        sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 250 },
  { id: "ins_policy_expiration_date",      label: "Policy expiration date",            category: "Policy",              field_type: "date",     source: "policyExpirationDate",       sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 260 },
  { id: "ins_insured_full_name",           label: "Insured full name",                 category: "Insured",             field_type: "text",     source: "insuredFullName",            sensitive: false, required: true,  validation_type: "name",  options: [], sort_order: 270 },
  { id: "ins_insured_dob",                 label: "Insured date of birth",             category: "Insured",             field_type: "date",     source: "insuredDob",                 sensitive: true,  required: false, validation_type: "date",  options: [], sort_order: 280 },
  { id: "ins_insured_ssn",                 label: "Insured SSN",                       category: "Insured",             field_type: "text",     source: "insuredSsn",                 sensitive: true,  required: false, validation_type: "ssn",   options: [], sort_order: 290 },
  { id: "ins_smoker_status",               label: "Tobacco / smoker status",           category: "Underwriting",        field_type: "dropdown", source: "smokerStatus",               sensitive: false, required: false, validation_type: "none",  options: ["Non-smoker", "Smoker", "Former smoker"], sort_order: 300 },
  { id: "ins_height",                      label: "Height (ft / in)",                  category: "Underwriting",        field_type: "text",     source: "height",                     sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 310 },
  { id: "ins_weight",                      label: "Weight (lbs)",                      category: "Underwriting",        field_type: "text",     source: "weight",                     sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 320 },
  { id: "ins_pre_existing_conditions",     label: "Pre-existing medical conditions",   category: "Underwriting",        field_type: "text",     source: "preExistingConditions",      sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 330 },
  { id: "ins_primary_beneficiary_pct",     label: "Primary beneficiary percentage (%)", category: "Beneficiary",       field_type: "text",     source: "primaryBeneficiaryPct",      sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 340 },
  { id: "ins_contingent_beneficiary_name", label: "Contingent beneficiary full name",  category: "Beneficiary",        field_type: "text",     source: "contingentBeneficiaryName",  sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 350 },
  { id: "ins_contingent_beneficiary_pct",  label: "Contingent beneficiary percentage (%)", category: "Beneficiary",   field_type: "text",     source: "contingentBeneficiaryPct",   sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 360 },
  { id: "ins_agent_name",                  label: "Agent full name",                   category: "Agent",               field_type: "text",     source: "agentName",                  sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 370 },
  { id: "ins_agent_license_number",        label: "Agent license number",              category: "Agent",               field_type: "text",     source: "agentLicenseNumber",         sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 380 },
  { id: "ins_group_number",                label: "Group number",                      category: "Health coverage",     field_type: "text",     source: "groupNumber",                sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 390 },
  { id: "ins_member_id",                   label: "Member ID",                         category: "Health coverage",     field_type: "text",     source: "memberId",                   sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 400 },
  { id: "ins_deductible_amount",           label: "Deductible amount ($)",             category: "Health coverage",     field_type: "text",     source: "deductibleAmount",           sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 410 },
  { id: "ins_employer_address",            label: "Employer address",                  category: "Employment",          field_type: "text",     source: "employerAddress",            sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 420 },
  { id: "ins_underwriter_name",            label: "Underwriter name",                  category: "Underwriting",        field_type: "text",     source: "underwriterName",            sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 430 },
  { id: "ins_medical_history_declaration", label: "Medical history declaration",       category: "Underwriting",        field_type: "text",     source: "medicalHistoryDeclaration",  sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 440 },
];

const REAL_ESTATE_FIELDS: SeedField[] = [
  { id: "re_property_address",             label: "Property street address",           category: "Property",            field_type: "text",     source: "propertyAddress",            sensitive: false, required: true,  validation_type: "none",  options: [], sort_order: 200 },
  { id: "re_property_city",                label: "Property city",                     category: "Property",            field_type: "text",     source: "propertyCity",               sensitive: false, required: true,  validation_type: "none",  options: [], sort_order: 210 },
  { id: "re_property_state",               label: "Property state",                    category: "Property",            field_type: "text",     source: "propertyState",              sensitive: false, required: true,  validation_type: "none",  options: [], sort_order: 220 },
  { id: "re_property_zip",                 label: "Property ZIP code",                 category: "Property",            field_type: "text",     source: "propertyZip",                sensitive: false, required: true,  validation_type: "custom", validation_pattern: "^\\d{5}(-\\d{4})?$", validation_message: "Enter a valid ZIP code.", options: [], sort_order: 230 },
  { id: "re_property_type",                label: "Property type",                     category: "Property",            field_type: "dropdown", source: "propertyType",               sensitive: false, required: false, validation_type: "none",  options: ["Single-family home", "Condominium", "Townhouse", "Multi-family", "Commercial", "Land", "Mobile home"], sort_order: 240 },
  { id: "re_parcel_number",                label: "Parcel / APN number",               category: "Property",            field_type: "text",     source: "parcelNumber",               sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 250 },
  { id: "re_purchase_price",               label: "Purchase price ($)",                category: "Transaction",         field_type: "text",     source: "purchasePrice",              sensitive: false, required: true,  validation_type: "none",  options: [], sort_order: 260 },
  { id: "re_down_payment_amount",          label: "Down payment amount ($)",           category: "Transaction",         field_type: "text",     source: "downPaymentAmount",          sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 270 },
  { id: "re_loan_amount",                  label: "Loan amount ($)",                   category: "Transaction",         field_type: "text",     source: "loanAmount",                 sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 280 },
  { id: "re_earnest_money_amount",         label: "Earnest money deposit ($)",         category: "Transaction",         field_type: "text",     source: "earnestMoneyAmount",         sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 290 },
  { id: "re_closing_date",                 label: "Closing date",                      category: "Transaction",         field_type: "date",     source: "closingDate",                sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 300 },
  { id: "re_possession_date",              label: "Possession date",                   category: "Transaction",         field_type: "date",     source: "possessionDate",             sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 310 },
  { id: "re_contingency_deadline",         label: "Contingency deadline date",         category: "Transaction",         field_type: "date",     source: "contingencyDeadline",        sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 320 },
  { id: "re_seller_full_name",             label: "Seller full name",                  category: "Parties",             field_type: "text",     source: "sellerFullName",             sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 330 },
  { id: "re_buyer_full_name",              label: "Buyer full name",                   category: "Parties",             field_type: "text",     source: "buyerFullName",              sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 340 },
  { id: "re_listing_agent_name",           label: "Listing agent full name",           category: "Agents",              field_type: "text",     source: "listingAgentName",           sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 350 },
  { id: "re_buyers_agent_name",            label: "Buyer's agent full name",           category: "Agents",              field_type: "text",     source: "buyersAgentName",            sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 360 },
  { id: "re_realtor_license_number",       label: "Realtor license number",            category: "Agents",              field_type: "text",     source: "realtorLicenseNumber",       sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 370 },
  { id: "re_commission_percentage",        label: "Commission percentage (%)",         category: "Agents",              field_type: "text",     source: "commissionPercentage",       sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 380 },
  { id: "re_escrow_company",               label: "Escrow company name",               category: "Settlement",          field_type: "text",     source: "escrowCompany",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 390 },
  { id: "re_title_company",                label: "Title company name",                category: "Settlement",          field_type: "text",     source: "titleCompany",               sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 400 },
  { id: "re_inspection_date",              label: "Inspection date",                   category: "Due diligence",       field_type: "date",     source: "inspectionDate",             sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 410 },
  { id: "re_appraisal_value",              label: "Appraised value ($)",               category: "Due diligence",       field_type: "text",     source: "appraisalValue",             sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 420 },
  { id: "re_hoa_name",                     label: "HOA name",                          category: "HOA",                 field_type: "text",     source: "hoaName",                    sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 430 },
  { id: "re_hoa_monthly_fee",              label: "HOA monthly fee ($)",               category: "HOA",                 field_type: "text",     source: "hoaMonthlyFee",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 440 },
];

const LEGAL_FIELDS: SeedField[] = [
  { id: "leg_case_number",                 label: "Case / matter number",              category: "Matter",              field_type: "text",     source: "caseNumber",                 sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 200 },
  { id: "leg_court_name",                  label: "Court name",                        category: "Matter",              field_type: "text",     source: "courtName",                  sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 210 },
  { id: "leg_matter_type",                 label: "Matter type",                       category: "Matter",              field_type: "dropdown", source: "matterType",                 sensitive: false, required: false, validation_type: "none",  options: ["Estate planning", "Probate", "Trust administration", "Business formation", "Contract", "Litigation", "Real estate", "Family law", "Tax", "Employment"], sort_order: 220 },
  { id: "leg_filing_date",                 label: "Filing date",                       category: "Matter",              field_type: "date",     source: "filingDate",                 sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 230 },
  { id: "leg_hearing_date",                label: "Hearing / court date",              category: "Matter",              field_type: "date",     source: "hearingDate",                sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 240 },
  { id: "leg_statute_of_limitations_date", label: "Statute of limitations date",       category: "Matter",              field_type: "date",     source: "statuteOfLimitationsDate",   sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 250 },
  { id: "leg_opposing_party_name",         label: "Opposing party full name",          category: "Parties",             field_type: "text",     source: "opposingPartyName",          sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 260 },
  { id: "leg_client_company_name",         label: "Client company / entity name",      category: "Parties",             field_type: "text",     source: "clientCompanyName",          sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 270 },
  { id: "leg_attorney_name",               label: "Attorney full name",                category: "Attorney",            field_type: "text",     source: "attorneyName",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 280 },
  { id: "leg_bar_number",                  label: "Bar number",                        category: "Attorney",            field_type: "text",     source: "barNumber",                  sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 290 },
  { id: "leg_retainer_amount",             label: "Retainer amount ($)",               category: "Billing",             field_type: "text",     source: "retainerAmount",             sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 300 },
  { id: "leg_hourly_rate",                 label: "Hourly rate ($/hr)",                category: "Billing",             field_type: "text",     source: "hourlyRate",                 sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 310 },
  { id: "leg_power_of_attorney_holder",    label: "Power of attorney holder name",     category: "Estate planning",     field_type: "text",     source: "powerOfAttorneyHolder",      sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 320 },
  { id: "leg_trustee_name",                label: "Trustee full name",                 category: "Estate planning",     field_type: "text",     source: "trusteeName",                sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 330 },
  { id: "leg_trust_name",                  label: "Trust name",                        category: "Estate planning",     field_type: "text",     source: "trustName",                  sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 340 },
  { id: "leg_trust_date",                  label: "Trust date",                        category: "Estate planning",     field_type: "date",     source: "trustDate",                  sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 350 },
  { id: "leg_grantor_name",                label: "Grantor full name",                 category: "Estate planning",     field_type: "text",     source: "grantorName",                sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 360 },
  { id: "leg_executor_name",               label: "Executor full name",                category: "Estate planning",     field_type: "text",     source: "executorName",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 370 },
  { id: "leg_decedent_name",               label: "Decedent full name",                category: "Estate planning",     field_type: "text",     source: "decedentName",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 380 },
  { id: "leg_estate_value",                label: "Estate gross value ($)",            category: "Estate planning",     field_type: "text",     source: "estateValue",                sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 390 },
  { id: "leg_will_date",                   label: "Will / testament date",             category: "Estate planning",     field_type: "date",     source: "willDate",                   sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 400 },
  { id: "leg_notary_name",                 label: "Notary public full name",           category: "Notary",              field_type: "text",     source: "notaryName",                 sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 410 },
  { id: "leg_notary_commission_expiration",label: "Notary commission expiration date", category: "Notary",              field_type: "date",     source: "notaryCommissionExpiration", sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 420 },
  { id: "leg_witness_1_name",              label: "Witness 1 full name",               category: "Witnesses",           field_type: "text",     source: "witness1Name",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 430 },
  { id: "leg_witness_2_name",              label: "Witness 2 full name",               category: "Witnesses",           field_type: "text",     source: "witness2Name",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 440 },
];

const HEALTHCARE_FIELDS: SeedField[] = [
  { id: "hc_patient_id",                   label: "Patient ID / MRN",                  category: "Patient",             field_type: "text",     source: "patientId",                  sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 200 },
  { id: "hc_date_of_service",              label: "Date of service",                   category: "Encounter",           field_type: "date",     source: "dateOfService",              sensitive: false, required: true,  validation_type: "date",  options: [], sort_order: 210 },
  { id: "hc_provider_name",                label: "Provider full name",                category: "Provider",            field_type: "text",     source: "providerName",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 220 },
  { id: "hc_npi_number",                   label: "Provider NPI number",               category: "Provider",            field_type: "text",     source: "npiNumber",                  sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 230 },
  { id: "hc_facility_name",                label: "Facility / practice name",          category: "Provider",            field_type: "text",     source: "facilityName",               sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 240 },
  { id: "hc_referring_physician",          label: "Referring physician name",          category: "Provider",            field_type: "text",     source: "referringPhysician",         sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 250 },
  { id: "hc_primary_care_physician",       label: "Primary care physician name",       category: "Provider",            field_type: "text",     source: "primaryCarePhysician",       sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 260 },
  { id: "hc_diagnosis_code",               label: "Diagnosis code (ICD-10)",           category: "Billing",             field_type: "text",     source: "diagnosisCode",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 270 },
  { id: "hc_procedure_code",               label: "Procedure code (CPT)",              category: "Billing",             field_type: "text",     source: "procedureCode",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 280 },
  { id: "hc_insurance_plan_name",          label: "Insurance plan name",               category: "Insurance",           field_type: "text",     source: "insurancePlanName",          sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 290 },
  { id: "hc_insurance_group_number",       label: "Insurance group number",            category: "Insurance",           field_type: "text",     source: "insuranceGroupNumber",       sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 300 },
  { id: "hc_insurance_member_id",          label: "Insurance member ID",               category: "Insurance",           field_type: "text",     source: "insuranceMemberId",          sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 310 },
  { id: "hc_secondary_insurance_name",     label: "Secondary insurance name",          category: "Insurance",           field_type: "text",     source: "secondaryInsuranceName",     sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 320 },
  { id: "hc_secondary_group_number",       label: "Secondary insurance group number",  category: "Insurance",           field_type: "text",     source: "secondaryGroupNumber",       sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 330 },
  { id: "hc_authorization_number",         label: "Prior authorization number",        category: "Insurance",           field_type: "text",     source: "authorizationNumber",        sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 340 },
  { id: "hc_prior_auth_expiration",        label: "Prior authorization expiration",    category: "Insurance",           field_type: "date",     source: "priorAuthExpiration",        sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 350 },
  { id: "hc_emergency_contact_name",       label: "Emergency contact full name",       category: "Patient",             field_type: "text",     source: "emergencyContactName",       sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 360 },
  { id: "hc_emergency_contact_phone",      label: "Emergency contact phone",           category: "Patient",             field_type: "text",     source: "emergencyContactPhone",      sensitive: false, required: false, validation_type: "phone", options: [], sort_order: 370 },
  { id: "hc_emergency_contact_relation",   label: "Emergency contact relationship",    category: "Patient",             field_type: "text",     source: "emergencyContactRelation",   sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 380 },
  { id: "hc_patient_employer",             label: "Patient employer name",             category: "Patient",             field_type: "text",     source: "patientEmployer",            sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 390 },
  { id: "hc_patient_employer_phone",       label: "Patient employer phone",            category: "Patient",             field_type: "text",     source: "patientEmployerPhone",       sensitive: false, required: false, validation_type: "phone", options: [], sort_order: 400 },
  { id: "hc_allergies",                    label: "Known allergies",                   category: "Clinical",            field_type: "text",     source: "allergies",                  sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 410 },
  { id: "hc_current_medications",          label: "Current medications",               category: "Clinical",            field_type: "text",     source: "currentMedications",         sensitive: true,  required: false, validation_type: "none",  options: [], sort_order: 420 },
  { id: "hc_hipaa_consent_date",           label: "HIPAA consent date",                category: "Compliance",          field_type: "date",     source: "hipaaConsentDate",           sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 430 },
  { id: "hc_last_office_visit_date",       label: "Last office visit date",            category: "Clinical",            field_type: "date",     source: "lastOfficeVisitDate",        sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 440 },
];

const GENERAL_FIELDS: SeedField[] = [
  { id: "gen_document_title",              label: "Document title",                    category: "Document",            field_type: "text",     source: "documentTitle",              sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 200 },
  { id: "gen_reference_number",            label: "Reference number",                  category: "Document",            field_type: "text",     source: "referenceNumber",            sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 210 },
  { id: "gen_effective_date",              label: "Effective date",                    category: "Document",            field_type: "date",     source: "effectiveDate",              sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 220 },
  { id: "gen_expiration_date",             label: "Expiration date",                   category: "Document",            field_type: "date",     source: "expirationDate",             sensitive: false, required: false, validation_type: "date",  options: [], sort_order: 230 },
  { id: "gen_authorized_by",               label: "Authorized by",                     category: "Document",            field_type: "text",     source: "authorizedBy",               sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 240 },
  { id: "gen_prepared_by",                 label: "Prepared by",                       category: "Document",            field_type: "text",     source: "preparedBy",                 sensitive: false, required: false, validation_type: "name",  options: [], sort_order: 250 },
  { id: "gen_internal_case_id",            label: "Internal case / file ID",           category: "Document",            field_type: "text",     source: "internalCaseId",             sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 260 },
  { id: "gen_notes",                       label: "Additional notes",                  category: "Document",            field_type: "text",     source: "additionalNotes",            sensitive: false, required: false, validation_type: "none",  options: [], sort_order: 270 },
];

const INDUSTRY_FIELDS: Record<IndustryKey, SeedField[]> = {
  financial_services: FINANCIAL_SERVICES_FIELDS,
  insurance:          INSURANCE_FIELDS,
  real_estate:        REAL_ESTATE_FIELDS,
  legal:              LEGAL_FIELDS,
  healthcare:         HEALTHCARE_FIELDS,
  general:            GENERAL_FIELDS,
};

/**
 * Seeds industry-specific fields into the account's field library (per-account scoped).
 * Fields are stored in `docufill_fields` with `account_id` set, so they are
 * visible only to the account that onboarded — not to other tenants.
 *
 * Idempotent — uses ON CONFLICT (id) DO NOTHING on the primary key.
 * Field IDs are namespaced as `{base_id}_a{accountId}` to prevent PK collisions
 * across accounts. Falls back to "general" when the industry is null or unrecognised.
 */
export async function seedIndustryFields(db: Pool, accountId: number, industry: string | null | undefined): Promise<void> {
  const key: IndustryKey = (industry && INDUSTRY_FIELDS[industry as IndustryKey]) ? (industry as IndustryKey) : "general";
  const industryFields = INDUSTRY_FIELDS[key] ?? [];
  const generalFields  = GENERAL_FIELDS;

  const toInsert: SeedField[] = key === "general"
    ? generalFields
    : [...industryFields, ...generalFields];

  if (toInsert.length === 0) return;

  try {
    for (const f of toInsert) {
      const scopedId = `${f.id}_a${accountId}`;
      await db.query(
        `INSERT INTO docufill_fields
           (id, label, category, field_type, source, options, sensitive, required,
            validation_type, validation_pattern, validation_message, active, sort_order, account_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, TRUE, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          scopedId,
          f.label,
          f.category,
          f.field_type,
          f.source,
          JSON.stringify(f.options),
          f.sensitive,
          f.required,
          f.validation_type,
          f.validation_pattern ?? null,
          f.validation_message ?? null,
          f.sort_order,
          accountId,
        ],
      );
    }
    logger.info({ industry: key, accountId, count: toInsert.length }, "[IndustrySeeds] Seeded industry fields for account");
  } catch (err) {
    logger.warn({ err, industry, accountId }, "[IndustrySeeds] Failed to seed industry fields (non-fatal)");
  }
}
