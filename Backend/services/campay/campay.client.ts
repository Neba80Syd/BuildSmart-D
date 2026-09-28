// BuildSmart AI — Campay Developer API Client
// Provides direct server-side integration with Campay (https://demo.campay.net/api / https://campay.net/api)
// Supports MTN MoMo, Orange Money, Payment Links, Status Verification, and Webhooks in Cameroon/CEMAC.

import 'dotenv/config';
import crypto from 'node:crypto';

import type {
  CampayConfig,
  CampayCollectParams,
  CampayCollectResponse,
  CampayPaymentLinkParams,
  CampayPaymentLinkResponse,
  CampayTransactionResponse,
  CampayWithdrawParams,
  CampayWithdrawResponse,
  CampayBalanceResponse,
} from './campay.types.ts';

export class CampayApiClient {
  private readonly config: CampayConfig;

  constructor(customConfig?: Partial<CampayConfig>) {
    const rawBaseUrl = customConfig?.baseUrl || process.env.CAMPAY_API_BASE_URL || 'https://demo.campay.net/api';
    // Ensure baseUrl does not end with trailing slash
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const token = customConfig?.token || process.env.CAMPAY_API_TOKEN || '';
    const isDemo = customConfig?.isDemo ?? (baseUrl.includes('demo.campay.net') || process.env.CAMPAY_DEMO_MODE === 'true');

    this.config = {
      baseUrl,
      token,
      webhookSecret: customConfig?.webhookSecret || process.env.CAMPAY_WEBHOOK_SECRET || token,
      isDemo,
      maxDemoAmount: customConfig?.maxDemoAmount ?? 25,
    };
  }

  public getConfig(): CampayConfig {
    return { ...this.config };
  }

  /**
   * Normalizes Cameroon phone numbers to the international standard expected by Campay:
   * e.g. '677123456' -> '237677123456'
   * e.g. '+237 677 12 34 56' -> '237677123456'
   */
  public normalizePhoneNumber(phone: string): string {
    const cleaned = String(phone || '').replace(/[\s\-\(\)\+]/g, '');
    if (!cleaned) return '';

    if (cleaned.startsWith('237') && cleaned.length === 12) {
      return cleaned;
    }
    if (cleaned.length === 9 && cleaned.startsWith('6')) {
      return `237${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Detects whether the normalized number belongs to MTN or Orange in Cameroon.
   */
  public detectOperator(phone: string): 'MTN' | 'ORANGE' | 'UNKNOWN' {
    const norm = this.normalizePhoneNumber(phone);
    if (!norm || norm.length !== 12) return 'UNKNOWN';

    const localPrefix = norm.substring(3, 5); // Digits right after '237'
    // MTN Cameroon prefixes: 67, 68, 650, 651, 652, 653, 654
    // Orange Cameroon prefixes: 69, 655, 656, 657, 658, 659
    if (['67', '68'].includes(localPrefix)) return 'MTN';
    if (localPrefix === '69') return 'ORANGE';

    const threeDigit = norm.substring(3, 6);
    if (['650', '651', '652', '653', '654'].includes(threeDigit)) return 'MTN';
    if (['655', '656', '657', '658', '659'].includes(threeDigit)) return 'ORANGE';

    return 'UNKNOWN';
  }

  /**
   * Determines effective gateway request amount. In demo mode (demo.campay.net),
   * Campay enforces a hard ceiling of 25 XAF per transaction (ER201).
   * For testing, we cap the gateway prompt to 10-25 XAF while maintaining real nominal values in BuildSmart.
   */
  private resolveGatewayAmount(amount: number | string): string {
    const num = Math.round(Number(amount));
    if (this.config.isDemo && num > (this.config.maxDemoAmount || 25)) {
      console.warn(
        `[BuildSmart:Campay] Notice: Demo environment limit active. Capping gateway request amount from ${num} XAF to ${this.config.maxDemoAmount} XAF for sandbox simulation.`
      );
      return String(this.config.maxDemoAmount || 25);
    }
    return String(Math.max(1, num));
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.config.token) {
      headers.Authorization = `Token ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const errMsg = data?.message || data?.error || data?.detail || `Campay API error (${response.status})`;
      const err = new Error(errMsg) as any;
      err.status = response.status;
      err.code = data?.error_code;
      err.response = data;
      throw err;
    }

    return data as T;
  }

  /**
   * Initiates direct USSD payment collection (Mobile Money request-to-pay push prompt).
   */
  async collect(params: CampayCollectParams): Promise<CampayCollectResponse> {
    const phone = this.normalizePhoneNumber(params.from);
    if (!phone || phone.length !== 12 || !phone.startsWith('2376')) {
      throw new Error(`Invalid Cameroon mobile money phone number (${params.from}). Must be 9 digits (e.g. 67XXXXXXX or 69XXXXXXX).`);
    }

    const gatewayAmount = this.resolveGatewayAmount(params.amount);

    const body: Record<string, any> = {
      amount: gatewayAmount,
      currency: params.currency || 'XAF',
      from: phone,
      description: (params.description || 'BuildSmart Payment').slice(0, 100),
    };

    if (params.externalReference) {
      body.external_reference = params.externalReference.slice(0, 100);
    }

    return this.request<CampayCollectResponse>('/collect/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Generates a hosted payment checkout link where customer can choose payment method.
   */
  async getPaymentLink(params: CampayPaymentLinkParams): Promise<CampayPaymentLinkResponse> {
    const gatewayAmount = this.resolveGatewayAmount(params.amount);

    const body: Record<string, any> = {
      amount: gatewayAmount,
      currency: params.currency || 'XAF',
      description: (params.description || 'BuildSmart Checkout').slice(0, 100),
    };

    if (params.externalReference) {
      body.external_reference = params.externalReference.slice(0, 100);
    }

    // Campay requires valid URLs if redirect is supplied, and requires failure_redirect_url if redirect_url is given
    if (params.redirectUrl && params.redirectUrl.startsWith('http')) {
      body.redirect_url = params.redirectUrl;
      body.failure_redirect_url = params.failureRedirectUrl || params.redirectUrl;
    }

    return this.request<CampayPaymentLinkResponse>('/get_payment_link/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Fetches real-time status of a transaction by its Campay reference UUID.
   */
  async getTransactionStatus(reference: string): Promise<CampayTransactionResponse> {
    if (!reference) {
      throw new Error('Campay reference UUID is required to check status');
    }
    return this.request<CampayTransactionResponse>(`/transaction/${encodeURIComponent(reference)}/`, {
      method: 'GET',
    });
  }

  /**
   * Disburses payout funds from merchant account to a mobile money number.
   */
  async withdraw(params: CampayWithdrawParams): Promise<CampayWithdrawResponse> {
    const phone = this.normalizePhoneNumber(params.to);
    if (!phone || phone.length !== 12 || !phone.startsWith('2376')) {
      throw new Error(`Invalid destination phone number for withdrawal: ${params.to}`);
    }

    const gatewayAmount = this.resolveGatewayAmount(params.amount);

    const body: Record<string, any> = {
      amount: gatewayAmount,
      currency: params.currency || 'XAF',
      to: phone,
      description: (params.description || 'BuildSmart Escrow Withdrawal').slice(0, 100),
    };

    if (params.externalReference) {
      body.external_reference = params.externalReference.slice(0, 100);
    }

    return this.request<CampayWithdrawResponse>('/withdraw/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Retrieves merchant application balances (MTN, Orange, Total).
   */
  async getBalance(): Promise<CampayBalanceResponse> {
    return this.request<CampayBalanceResponse>('/balance/', {
      method: 'GET',
    });
  }

  /**
   * Validates webhook signatures or authorization headers from Campay callbacks.
   */
  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean {
    // 1. Check direct Token header match
    const authHeader = (headers['authorization'] || headers['Authorization']) as string;
    if (authHeader && this.config.token) {
      const cleanToken = authHeader.replace(/^Token\s+/i, '').trim();
      if (cleanToken === this.config.token) return true;
    }

    // 2. Check X-Campay-Signature / X-Signature header HMAC
    const signature = (headers['x-campay-signature'] || headers['x-signature']) as string;
    if (signature && this.config.webhookSecret) {
      try {
        const expected = crypto.createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
        if (signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return true;
        }
      } catch {
        // Fall through
      }
    }

    // 3. In demo / sandbox mode, accept if token matches or in dev environment
    if (this.config.isDemo) {
      return true;
    }

    return false;
  }
}

// Global Singleton Instance
export const campayClient = new CampayApiClient();
