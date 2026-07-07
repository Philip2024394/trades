// Email delivery — after an external buyer completes checkout, we
// email them a signed download URL. Merchants don't need this flow
// (their whole site auto-upgrades to their tier).

import { Resend } from "resend";

export type LicenseDeliveryInput = {
  toEmail: string;
  licenseId: string;
  imageId: string;
  tier: string;
};

const FROM_ADDRESS = "xrated trades <images@xratedtrades.com>";

export async function sendLicenseDeliveryEmail(
  input: LicenseDeliveryInput
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const resend = new Resend(key);
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://xratedtrades.com"}/api/licenses/download/${input.licenseId}`;
  const marketplaceUrl = `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://xratedtrades.com"}/xrated-trades-images/${input.imageId}`;
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.toEmail,
    subject: "Your xrated trades image licence + download",
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#111;max-width:520px;">
        <h2 style="font-size:20px;margin:0 0 12px;">Your licence is active</h2>
        <p style="font-size:14px;line-height:1.5;color:#333;">
          Thanks — your ${input.tier} licence for image <code>${input.imageId}</code>
          is now on file. Download the clean file below.
        </p>
        <p style="margin:20px 0;">
          <a href="${downloadUrl}"
             style="display:inline-block;background:#111;color:#fff;padding:10px 18px;
                    border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">
            Download your image
          </a>
        </p>
        <p style="font-size:12px;color:#666;">
          Licence id: <code>${input.licenseId}</code><br />
          Licence page: <a href="${marketplaceUrl}">${marketplaceUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:11px;color:#888;">
          By using this image you agree to the xrated trades licence terms
          available at
          <a href="https://xratedtrades.com/image-licence-terms">
            xratedtrades.com/image-licence-terms
          </a>.
        </p>
      </div>
    `
  });
  return !error;
}
