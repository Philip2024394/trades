// Legacy · redirects to /nex-market/product/[slug].
import { redirect } from "next/navigation";
interface Params { slug: string }
export default async function NexShopProductRedirect({ params }: { params: Promise<Params> }): Promise<never> {
  const { slug } = await params;
  redirect(`/nex-market/product/${slug}`);
}
