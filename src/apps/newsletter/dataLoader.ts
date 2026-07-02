// App data loader: newsletter.
// The signup form only needs slug + display_name from the merchant,
// both already in MerchantData. Return { enabled: true } as a signal
// slot so the wrapper knows to render.

import { registerAppDataLoader } from "@/platform/apps/_shared/appDataLoader";

registerAppDataLoader("newsletter", () => ({ enabled: true }));
