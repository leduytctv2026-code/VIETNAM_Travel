import { Suspense } from "react";
import MapExplorer from "@/components/discovery/MapExplorer";
export default function Page() {
  return (
    <Suspense>
      <MapExplorer />
    </Suspense>
  );
}
