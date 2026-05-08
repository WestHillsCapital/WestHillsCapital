import type { FieldItem, MappingItem, RecipientItem } from "@/lib/docufill-types";

export type Entity = {
  id: number;
  name: string;
  kind?: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

export type TransactionType = {
  scope: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export type DocItem = {
  id: string;
  title: string;
  pages: number;
  fileName?: string;
  byteSize?: number;
  contentType?: string;
  pdfStored?: boolean;
  pageSizes?: Array<{ width: number; height: number }>;
  uploadedAt?: string;
  updatedAt?: string;
};

export type FieldLibraryItem = {
  id: string;
  label: string;
  category: string;
  type: FieldItem["type"];
  source: string;
  options: string[];
  sensitive: boolean;
  required: boolean;
  validationType: FieldItem["validationType"];
  validationPattern?: string;
  validationMessage?: string;
  active: boolean;
  sortOrder: number;
};

export type FieldVersionRow = {
  id: number;
  fieldId: string;
  changedBy: string | null;
  changedAt: string;
  snapshot: Partial<FieldLibraryItem> & { restoredFromVersion?: number };
};

export type PackageItem = {
  id: number;
  name: string;
  group_id: number | null;
  group_ids: number[];
  group_name: string | null;
  custodian_id: number | null;
  depository_id: number | null;
  custodian_name: string | null;
  depository_name: string | null;
  transaction_scope: string;
  description: string | null;
  status: string;
  version: number;
  documents: DocItem[];
  fields: FieldItem[];
  mappings: MappingItem[];
  recipients: RecipientItem[];
  enable_interview: boolean;
  enable_csv: boolean;
  enable_customer_link: boolean;
  webhook_enabled: boolean;
  webhook_url: string | null;
  slack_notifications_enabled: boolean;
  tags: string[];
  notify_staff_on_submit: boolean;
  notify_client_on_submit: boolean;
  enable_embed: boolean;
  embed_key: string | null;
  enable_gdrive: boolean;
  enable_hubspot: boolean;
  auth_level: "none" | "email_otp";
  require_preview: boolean;
  require_scroll_confirmation: boolean;
};
