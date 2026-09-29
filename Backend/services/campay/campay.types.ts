// BuildSmart AI — Campay Payment Service Type Definitions
// Defines request/response contracts for Campay Mobile Money & Card Integration (Cameroon / Central Africa)

export interface CampayConfig {
  baseUrl: string;
  token: string;
  webhookSecret?: string;
  isDemo?: boolean;
  maxDemoAmount?: number;
}

export interface CampayCollectParams {
  amount: number | string;
  from: string; // Cameroon phone number (e.g. 2376XXXXXXXX or 6XXXXXXXX)
  description: string;
  externalReference?: string;
  currency?: string; // Default 'XAF'
}

export interface CampayCollectResponse {
  reference: string;
  ussd_code?: string;
  operator?: string; // 'MTN' | 'ORANGE'
}

export interface CampayPaymentLinkParams {
  amount: number | string;
  description: string;
  externalReference?: string;
  redirectUrl?: string;
  failureRedirectUrl?: string;
  currency?: string;
}

export interface CampayPaymentLinkResponse {
  link: string;
  reference: string;
}

export type CampayTransactionStatus = 'SUCCESSFUL' | 'FAILED' | 'PENDING';

export interface CampayTransactionResponse {
  reference: string;
  status: CampayTransactionStatus;
  amount: string | number;
  currency: string;
  operator?: string;
  code?: string;
  operator_reference?: string;
  endpoint?: string;
  signature?: string;
  external_reference?: string;
  phone_number?: string;
  description?: string;
  reason?: string;
  app_amount?: string;
}

export interface CampayWithdrawParams {
  amount: number | string;
  to: string; // Recipient mobile money number (2376XXXXXXXX)
  description: string;
  externalReference?: string;
  currency?: string;
}

export interface CampayWithdrawResponse {
  reference?: string;
  status?: string;
  message?: string;
}

export interface CampayBalanceResponse {
  total_balance: number;
  mtn_balance: number;
  orange_balance: number;
  currency: string;
  utility_balance?: number;
  utility_commission_balance?: number;
}

export interface CampayWebhookPayload {
  reference: string;
  status: string; // 'SUCCESSFUL' | 'FAILED' | 'PENDING'
  amount: string | number;
  currency: string;
  operator?: string;
  code?: string;
  operator_reference?: string;
  endpoint?: string;
  signature?: string;
  external_reference?: string;
  phone_number?: string;
  description?: string;
  reason?: string;
  app_amount?: string;
}
