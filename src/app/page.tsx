import { cookies } from "next/headers";
import { serverApi } from "@/lib/server-content";
import HeritageHome from "@/components/HeritageHome";
import type { HomeBundle } from "../../shared/domain";
export const dynamic = "force-dynamic";
export default async function Page() {
  const locale =
    (await cookies()).get("atlas_locale")?.value === "en" ? "en" : "vi";
  const data = await serverApi<HomeBundle>("/discover", {}, locale);
  return <HeritageHome data={data} />;
}
