import { cache } from "react";
import {
  getContent,
  contentMetadata,
  structuredData,
} from "@/lib/server-content";
import DetailPage from "@/components/discovery/DetailPage";
import ContentBreadcrumbs from "@/components/seo/ContentBreadcrumbs";
import type { DestinationBundle } from "../../../../shared/domain";
const load = cache((slug: string) =>
  getContent<DestinationBundle>(`/destinations/${slug}`),
);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return contentMetadata(
    (await load(slug)).destination,
    `/destination/${slug}`,
  );
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
      <ContentBreadcrumbs item={data.destination} kind="destination" />
      {!data.destination.isSample && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              structuredData(
                data.destination,
                `/destination/${slug}`,
                "TouristAttraction",
              ),
            ).replace(/</g, "\u003c"),
          }}
        />
      )}
      <DetailPage
        item={data.destination}
        relatedItems={data.nearby}
        kind="destination"
      />
    </>
  );
}
