import { z } from "zod";

// ── Docufill ──────────────────────────────────────────────────────────────────

export const FieldLibraryCreateSchema = z.object({
  label: z.string(),
}).passthrough();
export type FieldLibraryCreateBody = z.infer<typeof FieldLibraryCreateSchema>;

export const FieldLibraryUpdateSchema = z.object({
  label: z.string(),
}).passthrough();
export type FieldLibraryUpdateBody = z.infer<typeof FieldLibraryUpdateSchema>;

export const EntityBodySchema = z.object({}).passthrough();
export type EntityBody = z.infer<typeof EntityBodySchema>;

export const EntityNameRequiredSchema = z.object({
  name: z.string(),
}).passthrough();
export type EntityNameRequiredBody = z.infer<typeof EntityNameRequiredSchema>;

export const TransactionTypeBodySchema = z.object({
  label: z.string(),
}).passthrough();
export type TransactionTypeBody = z.infer<typeof TransactionTypeBodySchema>;

export const PackageBodySchema = z.object({}).passthrough();
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

export const SessionAnswersBodySchema = z.object({}).passthrough();
export type SessionAnswersBody = z.infer<typeof SessionAnswersBodySchema>;

export const SendLinkBodySchema = z.object({
  recipientEmail: z.string(),
}).passthrough();
export type SendLinkBody = z.infer<typeof SendLinkBodySchema>;

export const BatchSendLinksBodySchema = z.object({
  invitations: z.array(z.record(z.unknown())),
}).passthrough();
export type BatchSendLinksBody = z.infer<typeof BatchSendLinksBodySchema>;

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

// ── Settings ──────────────────────────────────────────────────────────────────

export const OrgBodySchema = z.object({}).passthrough();
export type OrgBody = z.infer<typeof OrgBodySchema>;

export const ExtractBrandColorsBodySchema = z.object({
  url: z.string(),
});
export type ExtractBrandColorsBody = z.infer<typeof ExtractBrandColorsBodySchema>;

export const TeamInviteBodySchema = z.object({
  email: z.string(),
}).passthrough();
export type TeamInviteBody = z.infer<typeof TeamInviteBodySchema>;

export const TeamRoleBodySchema = z.object({
  role: z.string(),
});
export type TeamRoleBody = z.infer<typeof TeamRoleBodySchema>;

export const BillingCheckoutBodySchema = z.object({
  plan: z.string(),
}).passthrough();
export type BillingCheckoutBody = z.infer<typeof BillingCheckoutBodySchema>;

export const BillingPackCheckoutBodySchema = z.object({
  packSize: z.number(),
  packType: z.string(),
});
export type BillingPackCheckoutBody = z.infer<typeof BillingPackCheckoutBodySchema>;

export const OnboardingBodySchema = z.object({}).passthrough();
export type OnboardingBody = z.infer<typeof OnboardingBodySchema>;

export const OAuthConnectBodySchema = z.object({
  redirectUri: z.string(),
});
export type OAuthConnectBody = z.infer<typeof OAuthConnectBodySchema>;

export const OAuthExchangeBodySchema = z.object({
  code: z.string(),
  state: z.string(),
}).passthrough();
export type OAuthExchangeBody = z.infer<typeof OAuthExchangeBodySchema>;

export const OAuthExchangeWithRedirectBodySchema = z.object({
  code: z.string(),
  state: z.string(),
  redirectUri: z.string(),
});
export type OAuthExchangeWithRedirectBody = z.infer<typeof OAuthExchangeWithRedirectBodySchema>;

export const GDriveFolderBodySchema = z.object({}).passthrough();
export type GDriveFolderBody = z.infer<typeof GDriveFolderBodySchema>;

export const AdminAccountBodySchema = z.object({}).passthrough();
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

export const EmailSettingsBodySchema = z.object({}).passthrough();
export type EmailSettingsBody = z.infer<typeof EmailSettingsBodySchema>;

export const InterviewDefaultsBodySchema = z.object({}).passthrough();
export type InterviewDefaultsBody = z.infer<typeof InterviewDefaultsBodySchema>;

export const LocaleBodySchema = z.object({}).passthrough();
export type LocaleBody = z.infer<typeof LocaleBodySchema>;

export const DataPrivacyBodySchema = z.object({}).passthrough();
export type DataPrivacyBody = z.infer<typeof DataPrivacyBodySchema>;

export const DeletionRequestBodySchema = z.object({
  confirmName: z.string(),
});
export type DeletionRequestBody = z.infer<typeof DeletionRequestBodySchema>;

export const ProfileBodySchema = z.object({}).passthrough();
export type ProfileBody = z.infer<typeof ProfileBodySchema>;

export const TwoFACodeBodySchema = z.object({
  code: z.string(),
}).passthrough();
export type TwoFACodeBody = z.infer<typeof TwoFACodeBodySchema>;

export const CustomDomainBodySchema = z.object({}).passthrough();
export type CustomDomainBody = z.infer<typeof CustomDomainBodySchema>;

// ── Product Auth ──────────────────────────────────────────────────────────────

export const OnboardBodySchema = z.object({
  email: z.string(),
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
