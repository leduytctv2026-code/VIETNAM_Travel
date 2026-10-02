import { cache } from "react";
import { getContent, contentMetadata } from "@/lib/server-content";
import ProvinceDetail from "@/components/ProvinceDetail";
import ContentBreadcrumbs from "@/components/seo/ContentBreadcrumbs";
import type { ProvinceBundle } from "../../../../shared/domain";
const load = cache((slug: string) =>
  getContent<ProvinceBundle>(`/provinces/${slug}`),
);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return contentMetadata((await load(slug)).province, `/province/${slug}`);
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  return (
    <>
      <ContentBreadcrumbs item={data.province} kind="province" />
      <ProvinceDetail data={data} />
    </>
  );
}
