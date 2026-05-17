export type FieldInterviewMode = "required" | "optional" | "readonly" | "omitted";

export type FieldCondition = {
  fieldId: string;
  operator: "equals" | "not_equals" | "is_answered" | "is_not_answered";
  value: string;
};

export type FieldItem = {
  id: string;
  libraryFieldId?: string;
  name: string;
  color: string;
  type: "text" | "radio" | "checkbox" | "dropdown" | "date" | "initials";
  options?: string[];
  optionsMode?: "inherit" | "override";
  interviewMode: FieldInterviewMode;
  defaultValue: string;
  source: string;
  sensitive: boolean;
  validationType?: "none" | "string" | "name" | "number" | "currency" | "email" | "phone" | "date" | "time" | "zip" | "zip4" | "ssn" | "percent" | "custom";
  validationPattern?: string;
  validationMessage?: string;
  condition?: FieldCondition | null;
  condition2?: FieldCondition | null;
  conditionOperator?: "and" | "or";
  nameMode?: "inherit" | "override";
  sumGroup?: string;
};

export type MappingFormat =
  | "as-entered"
  | "uppercase"
  | "lowercase"
  | "first-name"
  | "middle-name"
  | "last-name"
  | "last-first-m"
  | "first-last"
  | "initials"
  | "digits-only"
  | "last-four"
  | "currency"
  | "date-mm-dd-yyyy"
  | "date-dd-mm-yyyy"
  | "date-yyyy-mm-dd"
  | "checkbox-yes"
  | "signature";

export type MappingItem = {
  id: string;
  fieldId: string;
  documentId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  format?: MappingFormat | string;
  recipientId?: string;
  multiLine?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  optionColor?: string;
  mark?: string;
};

export type RecipientItem = {
  id: string;
  label: string;
  color: string;
  type: "customer" | "group" | "custodian" | "depository" | "custom";
  refId?: number;
  email?: string;
};
