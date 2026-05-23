import { z } from "zod";

// ── Shared ────────────────────────────────────────────────────────────────────

export const EmptyBodySchema = z.object({}).optional();
export type EmptyBody = z.infer<typeof EmptyBodySchema>;

// ── Docuplete ──────────────────────────────────────────────────────────────────

export const FieldLibraryCreateSchema = z.object({
  label: z.string(),
}).passthrough();
export type FieldLibraryCreateBody = z.infer<typeof FieldLibraryCreateSchema>;

export const FieldLibraryUpdateSchema = z.object({
  label: z.string(),
}).passthrough();
export type FieldLibraryUpdateBody = z.infer<typeof FieldLibraryUpdateSchema>;

export const ComplianceTagCreateSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
}).passthrough();
export type ComplianceTagCreateBody = z.infer<typeof ComplianceTagCreateSchema>;

export const ComplianceTagUpdateSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
}).passthrough();
export type ComplianceTagUpdateBody = z.infer<typeof ComplianceTagUpdateSchema>;

export const FieldComplianceTagsPatchSchema = z.object({
  complianceTags: z.array(z.string()),
}).passthrough();
export type FieldComplianceTagsPatchBody = z.infer<typeof FieldComplianceTagsPatchSchema>;

export const FieldGroupCreateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  fieldIds: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
}).passthrough();
export type FieldGroupCreateBody = z.infer<typeof FieldGroupCreateSchema>;

export const FieldGroupUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  fieldIds: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
}).passthrough();
export type FieldGroupUpdateBody = z.infer<typeof FieldGroupUpdateSchema>;

export const FieldLibraryImportFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  category: z.string().optional(),
  type: z.string().optional(),
  source: z.string().optional(),
  options: z.array(z.string()).optional(),
  sensitive: z.boolean().optional(),
  required: z.boolean().optional(),
  validationType: z.string().optional(),
  validationPattern: z.string().optional().nullable(),
  validationMessage: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
  complianceTags: z.array(z.string()).optional(),
});

export const FieldLibraryImportGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  fieldIds: z.array(z.string()).optional().default([]),
  sortOrder: z.number().optional(),
});

export const FieldLibraryImportSchema = z.object({
  version: z.number().optional(),
  fields: z.array(FieldLibraryImportFieldSchema).max(2000),
  fieldGroups: z.array(FieldLibraryImportGroupSchema).optional().default([]),
});
export type FieldLibraryImportBody = z.infer<typeof FieldLibraryImportSchema>;

export const EntityBodySchema = z.object({
  name: z.string().optional(),
  kind: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
}).passthrough();
export type EntityBody = z.infer<typeof EntityBodySchema>;

export const EntityNameRequiredSchema = z.object({
  name: z.string(),
}).passthrough();
export type EntityNameRequiredBody = z.infer<typeof EntityNameRequiredSchema>;

export const TransactionTypeBodySchema = z.object({
  label: z.string(),
}).passthrough();
export type TransactionTypeBody = z.infer<typeof TransactionTypeBodySchema>;

export const PackageBodySchema = z.object({
  name: z.string().optional(),
  webhookUrl: z.string().optional().nullable(),
  groupId: z.union([z.number(), z.null()]).optional(),
  groupIds: z.array(z.number()).optional().nullable(),
  enableGdrive: z.boolean().optional(),
  enableHubspot: z.boolean().optional(),
  enableCustomerLink: z.boolean().optional(),
  enableInterview: z.boolean().optional(),
  enableCsv: z.boolean().optional(),
  notifyStaff: z.boolean().optional(),
  notifyClient: z.boolean().optional(),
  authLevel: z.string().optional(),
  requirePreview: z.boolean().optional(),
  interviewUrl: z.string().optional().nullable(),
  status: z.string().optional(),
}).passthrough();
export type PackageBody = z.infer<typeof PackageBodySchema>;

export const CsvBatchBodySchema = z.object({
  packageId: z.union([z.string(), z.number()]),
  rows: z.array(z.record(z.unknown())),
}).passthrough();
export type CsvBatchBody = z.infer<typeof CsvBatchBodySchema>;

export const SessionCreateBodySchema = z.object({
  packageId: z.union([z.string(), z.number()]),
}).passthrough();
export type SessionCreateBody = z.infer<typeof SessionCreateBodySchema>;

export const SessionAnswersBodySchema = z.object({
  answers: z.record(z.unknown()).optional(),
  status: z.string().optional(),
}).passthrough();
export type SessionAnswersBody = z.infer<typeof SessionAnswersBodySchema>;

export const SendLinkBodySchema = z.object({
  recipientEmail: z.string(),
}).passthrough();
export type SendLinkBody = z.infer<typeof SendLinkBodySchema>;

export const BatchSendLinksBodySchema = z.object({
  invitations: z.array(z.object({
    token: z.string(),
    recipientEmail: z.string(),
    recipientName: z.string().optional(),
  })),
  customMessage: z.string().optional(),
}).passthrough();
export type BatchSendLinksBody = z.infer<typeof BatchSendLinksBodySchema>;

export const VoidSessionBodySchema = z.object({
  reason: z.string().min(1, "A void reason is required"),
  notifySigner: z.boolean().optional(),
});
export type VoidSessionBody = z.infer<typeof VoidSessionBodySchema>;

export const PdfUploadHeaderSchema = z.object({
  "content-type": z.string().refine(
    (ct) => ct.includes("pdf") || ct.includes("octet-stream"),
    "content-type must be application/pdf or application/octet-stream",
  ).optional(),
}).passthrough();
export type PdfUploadHeader = z.infer<typeof PdfUploadHeaderSchema>;

// ── Docuplete GET query schemas ─────────────────────────────────────────────────

export const SessionsQuerySchema = z.object({
  dealId: z.string().regex(/^\d+$/, "dealId must be a numeric string").optional(),
  packageId: z.string().regex(/^\d+$/, "packageId must be a numeric string").optional(),
  status: z.enum(["draft", "in_progress", "generated", "voided"]).optional(),
  updatedAfter: z.string().optional(),
  limit: z.string().regex(/^\d+$/, "limit must be a numeric string").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a numeric string").optional(),
}).passthrough();
export type SessionsQuery = z.infer<typeof SessionsQuerySchema>;

export const BatchRunsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/, "limit must be a numeric string").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a numeric string").optional(),
}).passthrough();
export type BatchRunsQuery = z.infer<typeof BatchRunsQuerySchema>;

// ── Deals ─────────────────────────────────────────────────────────────────────

export const DealCreateBodySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
}).passthrough();
export type DealCreateBody = z.infer<typeof DealCreateBodySchema>;

export const TrackingBodySchema = z.object({
  trackingNumber: z.string(),
});
export type TrackingBody = z.infer<typeof TrackingBodySchema>;

export const PreviewInvoiceBodySchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  dealType: z.string().optional(),
  shippingMethod: z.string().optional(),
  fedexLocation: z.string().optional(),
  fedexLocationHours: z.string().optional(),
  shipToLine1: z.string().optional(),
  shipToCity: z.string().optional(),
  shipToState: z.string().optional(),
  shipToZip: z.string().optional(),
  billingLine1: z.string().optional(),
  billingLine2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  products: z.array(z.object({
    productName: z.string(),
    qty: z.number(),
    unitPrice: z.number(),
    lineTotal: z.number(),
  })).optional(),
  subtotal: z.number().optional(),
  shipping: z.number().optional(),
  total: z.number().optional(),
  goldSpotAsk: z.number().optional(),
  silverSpotAsk: z.number().optional(),
}).passthrough();
export type PreviewInvoiceBody = z.infer<typeof PreviewInvoiceBodySchema>;

// ── Settings ──────────────────────────────────────────────────────────────────

export const OrgBodySchema = z.object({
  name: z.string().optional(),
  brandColor: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  clearLogo: z.boolean().optional(),
  clearFormLogo: z.boolean().optional(),
  pkgDefaultInterview: z.boolean().optional(),
  pkgDefaultCsv: z.boolean().optional(),
  pkgDefaultCustomerLink: z.boolean().optional(),
  pkgDefaultNotifyStaff: z.boolean().optional(),
  pkgDefaultNotifyClient: z.boolean().optional(),
  pkgDefaultEsign: z.boolean().optional(),
  logoOnWhite: z.boolean().optional(),
  fieldPalette: z.union([
    z.object({
      palette:    z.array(z.string()),
      typeColors: z.record(z.string()),
      direction:  z.string().optional(),
    }),
    z.null(),
  ]).optional(),
}).passthrough();
export type OrgBody = z.infer<typeof OrgBodySchema>;

export const ExtractBrandColorsBodySchema = z.object({
  url: z.string(),
});
export type ExtractBrandColorsBody = z.infer<typeof ExtractBrandColorsBodySchema>;

export const TeamInviteBodySchema = z.object({
  email: z.string(),
  role: z.string().optional(),
}).passthrough();
export type TeamInviteBody = z.infer<typeof TeamInviteBodySchema>;

export const TeamRoleBodySchema = z.object({
  role: z.string(),
});
export type TeamRoleBody = z.infer<typeof TeamRoleBodySchema>;

export const BillingCheckoutBodySchema = z.object({
  plan: z.string(),
  interval: z.string().optional(),
  extraSeats: z.number().optional(),
  extraSubmissionPacks: z.number().optional(),
  referralCode: z.string().max(20).optional(),
}).passthrough();
export type BillingCheckoutBody = z.infer<typeof BillingCheckoutBodySchema>;

export const BillingPackCheckoutBodySchema = z.object({
  packSize: z.number(),
  packType: z.string(),
});
export type BillingPackCheckoutBody = z.infer<typeof BillingPackCheckoutBodySchema>;

export const OnboardingBodySchema = z.object({
  dismissed: z.boolean().optional(),
}).passthrough();
export type OnboardingBody = z.infer<typeof OnboardingBodySchema>;

export const OAuthConnectBodySchema = z.object({
  redirectUri: z.string(),
});
export type OAuthConnectBody = z.infer<typeof OAuthConnectBodySchema>;

export const OAuthExchangeBodySchema = z.object({
  code: z.string(),
  state: z.string(),
  redirectUri: z.string().optional(),
}).passthrough();
export type OAuthExchangeBody = z.infer<typeof OAuthExchangeBodySchema>;

export const OAuthExchangeWithRedirectBodySchema = z.object({
  code: z.string(),
  state: z.string(),
  redirectUri: z.string(),
});
export type OAuthExchangeWithRedirectBody = z.infer<typeof OAuthExchangeWithRedirectBodySchema>;

export const GDriveFolderBodySchema = z.object({
  folderInput: z.string().optional(),
}).passthrough();
export type GDriveFolderBody = z.infer<typeof GDriveFolderBodySchema>;

export const StorageConnectBodySchema = z.object({
  provider: z.enum(["gdrive", "onedrive", "dropbox"]),
  redirectUri: z.string(),
});
export type StorageConnectBody = z.infer<typeof StorageConnectBodySchema>;

export const StorageExchangeBodySchema = z.object({
  provider: z.enum(["gdrive", "onedrive", "dropbox"]),
  code: z.string(),
  state: z.string(),
  redirectUri: z.string().optional(),
}).passthrough();
export type StorageExchangeBody = z.infer<typeof StorageExchangeBodySchema>;

export const StorageFolderBodySchema = z.object({
  folderInput: z.string().optional(),
}).passthrough();
export type StorageFolderBody = z.infer<typeof StorageFolderBodySchema>;

export const AdminAccountBodySchema = z.object({
  plan_tier: z.string().optional(),
  seat_limit: z.number().optional(),
  subscription_status: z.string().optional(),
}).passthrough();
export type AdminAccountBody = z.infer<typeof AdminAccountBodySchema>;

export const AdminNoteBodySchema = z.object({
  note: z.string(),
}).passthrough();
export type AdminNoteBody = z.infer<typeof AdminNoteBodySchema>;

export const IpAllowlistBodySchema = z.object({
  allowed_ip_ranges: z.array(z.string()),
});
export type IpAllowlistBody = z.infer<typeof IpAllowlistBodySchema>;

export const NotificationsBodySchema = z.object({
  prefs: z.array(z.record(z.unknown())),
});
export type NotificationsBody = z.infer<typeof NotificationsBodySchema>;

export const EmailSettingsBodySchema = z.object({
  senderName: z.string().optional().nullable(),
  replyTo: z.string().optional().nullable(),
  footer: z.string().optional().nullable(),
}).passthrough();
export type EmailSettingsBody = z.infer<typeof EmailSettingsBodySchema>;

export const InterviewDefaultsBodySchema = z.object({
  linkExpiryDays: z.union([z.number(), z.null()]).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDays: z.number().optional(),
  defaultLocale: z.string().optional(),
}).passthrough();
export type InterviewDefaultsBody = z.infer<typeof InterviewDefaultsBodySchema>;

export const LocaleBodySchema = z.object({
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
}).passthrough();
export type LocaleBody = z.infer<typeof LocaleBodySchema>;

export const DataPrivacyBodySchema = z.object({
  submissionRetentionDays: z.union([z.number().positive(), z.null()]).optional(),
}).passthrough();
export type DataPrivacyBody = z.infer<typeof DataPrivacyBodySchema>;

export const DeletionRequestBodySchema = z.object({
  confirmName: z.string(),
});
export type DeletionRequestBody = z.infer<typeof DeletionRequestBodySchema>;

export const ProfileBodySchema = z.object({
  display_name: z.string().optional().nullable(),
  email: z.string().optional(),
  cancel_pending_email: z.boolean().optional(),
}).passthrough();
export type ProfileBody = z.infer<typeof ProfileBodySchema>;

export const TwoFACodeBodySchema = z.object({
  code: z.string(),
}).passthrough();
export type TwoFACodeBody = z.infer<typeof TwoFACodeBodySchema>;

export const CustomDomainBodySchema = z.object({
  domain: z.string().optional(),
}).passthrough();
export type CustomDomainBody = z.infer<typeof CustomDomainBodySchema>;

// ── Settings GET query schemas ─────────────────────────────────────────────────

export const AdminAccountsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  limit: z.string().regex(/^\d+$/, "limit must be a numeric string").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a numeric string").optional(),
}).passthrough();
export type AdminAccountsQuery = z.infer<typeof AdminAccountsQuerySchema>;

// ── Product Auth ──────────────────────────────────────────────────────────────

export const OnboardBodySchema = z.object({
  email: z.string(),
  companyName: z.string().optional(),
  industry: z.string().optional(),
}).passthrough();
export type OnboardBody = z.infer<typeof OnboardBodySchema>;

export const Verify2FABodySchema = z.object({
  code: z.string(),
}).passthrough();
export type Verify2FABody = z.infer<typeof Verify2FABodySchema>;

export const ApiKeyBodySchema = z.object({
  name: z.string().max(100),
});
export type ApiKeyBody = z.infer<typeof ApiKeyBodySchema>;

// ── E-sign / public session schemas ───────────────────────────────────────────

export const OtpRequestBodySchema = z.object({
  email: z.string().email("A valid email address is required"),
});
export type OtpRequestBody = z.infer<typeof OtpRequestBodySchema>;

export const OtpVerifyBodySchema = z.object({
  email: z.string().email("A valid email address is required"),
  code: z.string().min(1, "Verification code is required"),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBodySchema>;

export const GenerateSessionBodySchema = z.object({
  esignToken:      z.string().optional(),
  signerName:      z.string().optional(),
  signatureImage:  z.string().optional(),
  initialsImage:   z.string().optional(),
}).passthrough();
export type GenerateSessionBody = z.infer<typeof GenerateSessionBodySchema>;

// ── Image upload header schema ─────────────────────────────────────────────────

export const ImageUploadHeaderSchema = z.object({
  "content-type": z.string().regex(
    /^(image\/png|image\/jpeg|image\/webp)/i,
    "content-type must be image/png, image/jpeg, or image/webp",
  ),
}).passthrough();
export type ImageUploadHeader = z.infer<typeof ImageUploadHeaderSchema>;
