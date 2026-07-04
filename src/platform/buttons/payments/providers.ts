// Payment provider catalogue — the single source of truth for what
// each provider needs to be configured.
//
// Each provider declares:
//   • its id (matches the button variantKey prefix)
//   • name + region + docs URL
//   • credential fields (public key, secret key, webhook secret, etc.)
//   • test connection endpoint hint
//
// The Studio config UI reads this catalogue and renders the correct
// form per provider. New provider = one entry here + one button variant.

export type CredentialField = {
  key: string;
  label: string;
  kind: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpUrl?: string;
};

export type PaymentProvider = {
  id: string;
  name: string;
  region: string;
  variantKey: string; // e.g. "pay.stripe_1"
  docsUrl: string;
  logoInitial: string;
  brandColour: string;
  credentials: CredentialField[];
  webhookEndpointHint: string;
  supportedCurrencies: string[];
};

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "stripe",
    name: "Stripe",
    region: "Global",
    variantKey: "pay.stripe_1",
    docsUrl: "https://stripe.com/docs/keys",
    logoInitial: "S",
    brandColour: "#635BFF",
    credentials: [
      { key: "publishable_key", label: "Publishable key", kind: "text", placeholder: "pk_live_…", required: true, helpUrl: "https://stripe.com/docs/keys" },
      { key: "secret_key", label: "Secret key", kind: "password", placeholder: "sk_live_…", required: true },
      { key: "webhook_secret", label: "Webhook signing secret", kind: "password", placeholder: "whsec_…", required: false }
    ],
    webhookEndpointHint: "/api/pay/stripe/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD", "CAD", "IDR", "INR", "SGD", "JPY"]
  },
  {
    id: "paypal",
    name: "PayPal",
    region: "Global",
    variantKey: "pay.paypal_1",
    docsUrl: "https://developer.paypal.com/dashboard",
    logoInitial: "P",
    brandColour: "#003087",
    credentials: [
      { key: "client_id", label: "Client ID", kind: "text", placeholder: "AY…", required: true },
      { key: "client_secret", label: "Client secret", kind: "password", placeholder: "EL…", required: true },
      { key: "mode", label: "Mode (sandbox / live)", kind: "text", placeholder: "live", required: true }
    ],
    webhookEndpointHint: "/api/pay/paypal/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD", "CAD", "IDR", "JPY"]
  },
  {
    id: "wise",
    name: "Wise",
    region: "Global",
    variantKey: "pay.wise_1",
    docsUrl: "https://api-docs.wise.com/",
    logoInitial: "W",
    brandColour: "#9FE870",
    credentials: [
      { key: "api_token", label: "API token", kind: "password", placeholder: "wise_…", required: true },
      { key: "profile_id", label: "Business profile ID", kind: "text", placeholder: "12345", required: true }
    ],
    webhookEndpointHint: "/api/pay/wise/webhook",
    supportedCurrencies: ["GBP", "EUR", "USD", "AUD", "SGD", "IDR"]
  },
  {
    id: "escrow",
    name: "Escrow.com",
    region: "Global",
    variantKey: "pay.escrow_1",
    docsUrl: "https://www.escrow.com/api",
    logoInitial: "E",
    brandColour: "#0055A5",
    credentials: [
      { key: "api_key", label: "API key", kind: "password", placeholder: "escrow_…", required: true },
      { key: "email", label: "Account email", kind: "text", placeholder: "you@example.com", required: true }
    ],
    webhookEndpointHint: "/api/pay/escrow/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD"]
  },
  {
    id: "klarna",
    name: "Klarna",
    region: "EU / US / UK / AU",
    variantKey: "pay.klarna_1",
    docsUrl: "https://developers.klarna.com/",
    logoInitial: "K",
    brandColour: "#FFA8CD",
    credentials: [
      { key: "username", label: "Username (UID)", kind: "text", placeholder: "PK00…", required: true },
      { key: "password", label: "Password", kind: "password", placeholder: "sharedSecret_…", required: true },
      { key: "region", label: "Region (na / eu / oc)", kind: "text", placeholder: "eu", required: true }
    ],
    webhookEndpointHint: "/api/pay/klarna/webhook",
    supportedCurrencies: ["EUR", "SEK", "NOK", "DKK", "GBP", "USD", "AUD"]
  },
  {
    id: "afterpay",
    name: "Afterpay / Clearpay",
    region: "AU / US / UK",
    variantKey: "pay.afterpay_1",
    docsUrl: "https://developers.afterpay.com/",
    logoInitial: "A",
    brandColour: "#B2FCE4",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "AP…", required: true },
      { key: "secret_key", label: "Secret key", kind: "password", placeholder: "afterpay_…", required: true }
    ],
    webhookEndpointHint: "/api/pay/afterpay/webhook",
    supportedCurrencies: ["USD", "AUD", "GBP", "NZD", "CAD"]
  },
  {
    id: "apple_pay",
    name: "Apple Pay",
    region: "Global (via Stripe/Adyen)",
    variantKey: "pay.apple_1",
    docsUrl: "https://developer.apple.com/apple-pay/",
    logoInitial: "",
    brandColour: "#000000",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "merchant.com.brand", required: true },
      { key: "certificate_pem", label: "Payment processing certificate (PEM)", kind: "password", placeholder: "-----BEGIN CERTIFICATE-----…", required: true }
    ],
    webhookEndpointHint: "n/a — handled via Stripe / Adyen",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD", "CAD", "JPY"]
  },
  {
    id: "google_pay",
    name: "Google Pay",
    region: "Global (via Stripe/Adyen)",
    variantKey: "pay.google_1",
    docsUrl: "https://developers.google.com/pay",
    logoInitial: "G",
    brandColour: "#000000",
    credentials: [
      { key: "merchant_id", label: "Google Pay merchant ID", kind: "text", placeholder: "BCR2DN…", required: true },
      { key: "processor", label: "Underlying processor (stripe / adyen / …)", kind: "text", placeholder: "stripe", required: true }
    ],
    webhookEndpointHint: "n/a — handled via processor",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD", "IDR", "INR"]
  },
  {
    id: "shop_pay",
    name: "Shop Pay",
    region: "Global (Shopify merchants)",
    variantKey: "pay.shop_pay_1",
    docsUrl: "https://shopify.dev/docs/apps/payments",
    logoInitial: "S",
    brandColour: "#5A31F4",
    credentials: [
      { key: "shop_domain", label: "Shopify shop domain", kind: "url", placeholder: "you.myshopify.com", required: true },
      { key: "access_token", label: "Admin API access token", kind: "password", placeholder: "shpat_…", required: true }
    ],
    webhookEndpointHint: "/api/pay/shopify/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD"]
  },
  {
    id: "amazon_pay",
    name: "Amazon Pay",
    region: "US / EU / JP",
    variantKey: "pay.amazon_pay_1",
    docsUrl: "https://developer.amazon.com/pay",
    logoInitial: "a",
    brandColour: "#FF9900",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "A2Q3…", required: true },
      { key: "public_key_id", label: "Public key ID", kind: "text", placeholder: "SANDBOX-…", required: true },
      { key: "private_key", label: "Private key", kind: "password", placeholder: "-----BEGIN…", required: true }
    ],
    webhookEndpointHint: "/api/pay/amazon/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "JPY"]
  },
  {
    id: "cash_app",
    name: "Cash App Pay",
    region: "US (via Square)",
    variantKey: "pay.cash_app_1",
    docsUrl: "https://developer.squareup.com/docs/cash-app-pay",
    logoInitial: "$",
    brandColour: "#00D632",
    credentials: [
      { key: "access_token", label: "Square access token", kind: "password", placeholder: "EAAAE…", required: true },
      { key: "location_id", label: "Location ID", kind: "text", placeholder: "L…", required: true }
    ],
    webhookEndpointHint: "/api/pay/cashapp/webhook",
    supportedCurrencies: ["USD"]
  },
  {
    id: "coinbase",
    name: "Coinbase Commerce",
    region: "Global (crypto)",
    variantKey: "pay.coinbase_1",
    docsUrl: "https://commerce.coinbase.com/docs/",
    logoInitial: "C",
    brandColour: "#0052FF",
    credentials: [
      { key: "api_key", label: "API key", kind: "password", placeholder: "coinbase_…", required: true },
      { key: "webhook_secret", label: "Webhook shared secret", kind: "password", placeholder: "whsec_…", required: false }
    ],
    webhookEndpointHint: "/api/pay/coinbase/webhook",
    supportedCurrencies: ["BTC", "ETH", "USDC", "USDT"]
  },
  {
    id: "alipay",
    name: "Alipay",
    region: "China / Global",
    variantKey: "pay.alipay_1",
    docsUrl: "https://global.alipay.com/",
    logoInitial: "A",
    brandColour: "#00A0E9",
    credentials: [
      { key: "app_id", label: "App ID", kind: "text", placeholder: "2021…", required: true },
      { key: "private_key", label: "RSA private key", kind: "password", placeholder: "-----BEGIN RSA…", required: true },
      { key: "alipay_public_key", label: "Alipay public key", kind: "password", placeholder: "MIIBIjA…", required: true }
    ],
    webhookEndpointHint: "/api/pay/alipay/notify",
    supportedCurrencies: ["CNY", "USD", "EUR", "GBP"]
  },
  {
    id: "wechat",
    name: "WeChat Pay",
    region: "China",
    variantKey: "pay.wechat_1",
    docsUrl: "https://pay.weixin.qq.com/wiki/doc/apiv3/",
    logoInitial: "W",
    brandColour: "#07C160",
    credentials: [
      { key: "mch_id", label: "Merchant ID (mch_id)", kind: "text", placeholder: "1900…", required: true },
      { key: "api_key", label: "API v3 key", kind: "password", placeholder: "…", required: true },
      { key: "cert_serial", label: "Certificate serial number", kind: "text", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/wechat/notify",
    supportedCurrencies: ["CNY"]
  },
  {
    id: "razorpay",
    name: "Razorpay",
    region: "India",
    variantKey: "pay.razorpay_1",
    docsUrl: "https://razorpay.com/docs/api/",
    logoInitial: "R",
    brandColour: "#3395FF",
    credentials: [
      { key: "key_id", label: "Key ID", kind: "text", placeholder: "rzp_live_…", required: true },
      { key: "key_secret", label: "Key secret", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/razorpay/webhook",
    supportedCurrencies: ["INR", "USD"]
  },
  {
    id: "paytm",
    name: "Paytm",
    region: "India",
    variantKey: "pay.paytm_1",
    docsUrl: "https://business.paytm.com/docs",
    logoInitial: "P",
    brandColour: "#00BAF2",
    credentials: [
      { key: "merchant_id", label: "Merchant ID (MID)", kind: "text", placeholder: "Merch_…", required: true },
      { key: "merchant_key", label: "Merchant key", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/paytm/webhook",
    supportedCurrencies: ["INR"]
  },
  {
    id: "adyen",
    name: "Adyen",
    region: "Global (enterprise)",
    variantKey: "pay.adyen_1",
    docsUrl: "https://docs.adyen.com/",
    logoInitial: "A",
    brandColour: "#0ABF53",
    credentials: [
      { key: "api_key", label: "API key", kind: "password", placeholder: "AQ…", required: true },
      { key: "merchant_account", label: "Merchant account", kind: "text", placeholder: "YourMerchant", required: true },
      { key: "environment", label: "Environment (live / test)", kind: "text", placeholder: "live", required: true }
    ],
    webhookEndpointHint: "/api/pay/adyen/webhook",
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "IDR"]
  },
  {
    id: "mollie",
    name: "Mollie",
    region: "EU",
    variantKey: "pay.mollie_1",
    docsUrl: "https://docs.mollie.com/",
    logoInitial: "M",
    brandColour: "#000E52",
    credentials: [
      { key: "api_key", label: "API key", kind: "password", placeholder: "live_…", required: true }
    ],
    webhookEndpointHint: "/api/pay/mollie/webhook",
    supportedCurrencies: ["EUR", "GBP", "USD"]
  },
  {
    id: "square",
    name: "Square",
    region: "US / UK / AU / JP",
    variantKey: "pay.square_1",
    docsUrl: "https://developer.squareup.com/docs",
    logoInitial: "S",
    brandColour: "#3E4348",
    credentials: [
      { key: "access_token", label: "Access token", kind: "password", placeholder: "EAAAE…", required: true },
      { key: "location_id", label: "Location ID", kind: "text", placeholder: "L…", required: true }
    ],
    webhookEndpointHint: "/api/pay/square/webhook",
    supportedCurrencies: ["USD", "GBP", "AUD", "CAD", "JPY"]
  },
  {
    id: "zelle",
    name: "Zelle",
    region: "US",
    variantKey: "pay.zelle_1",
    docsUrl: "https://www.zellepay.com/business",
    logoInitial: "Z",
    brandColour: "#6D1ED4",
    credentials: [
      { key: "recipient_email", label: "Zelle recipient email or phone", kind: "text", placeholder: "you@example.com", required: true }
    ],
    webhookEndpointHint: "n/a — manual reconciliation",
    supportedCurrencies: ["USD"]
  },
  {
    id: "venmo",
    name: "Venmo",
    region: "US",
    variantKey: "pay.venmo_1",
    docsUrl: "https://developer.paypal.com/braintree/docs/guides/venmo",
    logoInitial: "V",
    brandColour: "#008CFF",
    credentials: [
      { key: "braintree_merchant_id", label: "Braintree merchant ID", kind: "text", placeholder: "…", required: true },
      { key: "braintree_public_key", label: "Braintree public key", kind: "text", placeholder: "…", required: true },
      { key: "braintree_private_key", label: "Braintree private key", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/venmo/webhook",
    supportedCurrencies: ["USD"]
  },
  {
    id: "qris",
    name: "QRIS (Indonesia)",
    region: "Indonesia",
    variantKey: "pay.qris_1",
    docsUrl: "https://www.bi.go.id/QRIS",
    logoInitial: "Q",
    brandColour: "#B02A2D",
    credentials: [
      { key: "merchant_id", label: "NMID (National Merchant ID)", kind: "text", placeholder: "ID10…", required: true },
      { key: "static_qr_url", label: "Static QR image URL", kind: "url", placeholder: "https://…/qris.png", required: true }
    ],
    webhookEndpointHint: "handled by acquiring bank",
    supportedCurrencies: ["IDR"]
  },
  {
    id: "gopay",
    name: "GoPay",
    region: "Indonesia (Gojek)",
    variantKey: "pay.gopay_1",
    docsUrl: "https://midtrans.com/",
    logoInitial: "G",
    brandColour: "#00AED6",
    credentials: [
      { key: "midtrans_server_key", label: "Midtrans server key", kind: "password", placeholder: "Mid-server-…", required: true },
      { key: "midtrans_client_key", label: "Midtrans client key", kind: "text", placeholder: "Mid-client-…", required: true }
    ],
    webhookEndpointHint: "/api/pay/gopay/notify",
    supportedCurrencies: ["IDR"]
  },
  {
    id: "dana",
    name: "DANA",
    region: "Indonesia",
    variantKey: "pay.dana_1",
    docsUrl: "https://dashboard.dana.id/api-docs",
    logoInitial: "D",
    brandColour: "#118EEA",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "…", required: true },
      { key: "private_key", label: "Private key", kind: "password", placeholder: "-----BEGIN…", required: true }
    ],
    webhookEndpointHint: "/api/pay/dana/notify",
    supportedCurrencies: ["IDR"]
  },
  {
    id: "ovo",
    name: "OVO",
    region: "Indonesia",
    variantKey: "pay.ovo_1",
    docsUrl: "https://ovo.id/business",
    logoInitial: "O",
    brandColour: "#4C2A86",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "…", required: true },
      { key: "api_key", label: "API key", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/ovo/notify",
    supportedCurrencies: ["IDR"]
  },
  {
    id: "linkaja",
    name: "LinkAja",
    region: "Indonesia (Telkomsel)",
    variantKey: "pay.linkaja_1",
    docsUrl: "https://linkaja.id/business",
    logoInitial: "L",
    brandColour: "#E53935",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", kind: "text", placeholder: "…", required: true },
      { key: "api_key", label: "API key", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/linkaja/notify",
    supportedCurrencies: ["IDR"]
  },
  {
    id: "grabpay",
    name: "GrabPay",
    region: "Singapore / Malaysia / Philippines / Thailand / Vietnam / Indonesia",
    variantKey: "pay.grabpay_1",
    docsUrl: "https://developer.grab.com/docs/grabpay/",
    logoInitial: "G",
    brandColour: "#00B14F",
    credentials: [
      { key: "partner_id", label: "Partner ID", kind: "text", placeholder: "…", required: true },
      { key: "partner_secret", label: "Partner secret", kind: "password", placeholder: "…", required: true }
    ],
    webhookEndpointHint: "/api/pay/grabpay/webhook",
    supportedCurrencies: ["SGD", "MYR", "PHP", "THB", "VND", "IDR"]
  },
  {
    id: "sepa",
    name: "SEPA Direct Debit",
    region: "EU",
    variantKey: "pay.sepa_1",
    docsUrl: "https://www.europeanpaymentscouncil.eu/",
    logoInitial: "€",
    brandColour: "#003399",
    credentials: [
      { key: "iban", label: "Company IBAN", kind: "text", placeholder: "DE89…", required: true },
      { key: "creditor_id", label: "Creditor ID", kind: "text", placeholder: "DE98ZZZ…", required: true }
    ],
    webhookEndpointHint: "handled by bank",
    supportedCurrencies: ["EUR"]
  },
  {
    id: "bank_transfer",
    name: "Bank Transfer",
    region: "Global",
    variantKey: "pay.bank_transfer_1",
    docsUrl: "n/a",
    logoInitial: "B",
    brandColour: "#0A0A0A",
    credentials: [
      { key: "bank_name", label: "Bank name", kind: "text", placeholder: "Bank Central Asia", required: true },
      { key: "account_number", label: "Account number", kind: "text", placeholder: "0000000000", required: true },
      { key: "account_holder", label: "Account holder", kind: "text", placeholder: "Company Ltd", required: true }
    ],
    webhookEndpointHint: "manual reconciliation",
    supportedCurrencies: ["*"]
  },
  {
    id: "cod",
    name: "Cash on Delivery",
    region: "Global (mainly SEA / IN / MENA)",
    variantKey: "pay.cod_1",
    docsUrl: "n/a",
    logoInitial: "$",
    brandColour: "#525252",
    credentials: [
      { key: "surcharge_percent", label: "Surcharge % (optional)", kind: "text", placeholder: "0", required: false },
      { key: "max_amount", label: "Max amount allowed", kind: "text", placeholder: "1000000", required: false }
    ],
    webhookEndpointHint: "n/a",
    supportedCurrencies: ["*"]
  }
];

export function getProvider(id: string): PaymentProvider | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}
