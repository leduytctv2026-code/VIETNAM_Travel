import { cache } from "react";
import { getContent, contentMetadata } from "@/lib/server-content";
import DetailPage from "@/components/discovery/DetailPage";
import ContentBreadcrumbs from "@/components/seo/ContentBreadcrumbs";
import type { Content } from "../../../../shared/domain";
const load = cache((slug: string) =>
  getContent<{ specialty: Content; related: Content[] }>(
    `/specialties/${slug}`,
  ),
);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return contentMetadata((await load(slug)).specialty, `/specialty/${slug}`);
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await load((await params).slug);
  return (
    <>
      <ContentBreadcrumbs item={data.specialty} kind="specialty" />
      <DetailPage
        item={data.specialty}
        relatedItems={data.related}
        kind="specialty"
      />
    </>
  );
}
