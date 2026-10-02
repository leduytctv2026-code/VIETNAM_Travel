import { Suspense } from "react";
import Explorer from "@/components/discovery/Explorer";
export default function Page() {
  return (
    <Suspense>
      <Explorer kind="provinces" />
    </Suspense>
  );
}
