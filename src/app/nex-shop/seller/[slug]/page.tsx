import { redirect } from "next/navigation";
interface Params { slug: string }
export default async function NexShopSellerRedirect({ params }: { params: Promise<Params> }): Promise<never> {
  const { slug } = await params;
  redirect(`/nex-market/seller/${slug}`);
}
