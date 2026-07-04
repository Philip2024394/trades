// Payment processors — side-effect imports.
//
// Every processor self-registers with paymentProcessors on import.
// Import this file once before hitting /api/pay/session so the
// registry is populated.

import "./stripe";
import "./paypal";
import "./midtrans";
import "./razorpay";
import "./offline";
