export interface ProductRow {
  productId:   string;
  productName: string;
  metal:       "gold" | "silver";
  qty:         string;
  unitPrice:   string;
}

export interface SpotData {
  goldSpotAsk:   number | null;
  silverSpotAsk: number | null;
  spotTimestamp: string | null;
}

export interface FedExLocationResult {
  name:         string;
  locationType: string;
  address:      string;
  city:         string;
  state:        string;
  zip:          string;
  distance:     string;
  phone:        string;
  hours:        string;
}

export interface Customer {
  firstName:        string;
  lastName:         string;
  email:            string;
  phone:            string;
  state:            string;
  zip:              string;
  leadId:           string;
  confirmationId:   string;
  custodian:        string;
  iraAccountNumber: string;
}

export interface ExecutionResult {
  invoiceId:   string | null;
  invoiceUrl:  string | null;
  emailSentTo: string | null;
  warnings?:   string[];
}
