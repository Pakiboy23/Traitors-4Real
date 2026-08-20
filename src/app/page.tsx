"use client";

import dynamic from "next/dynamic";

const TraitorsApp = dynamic(() => import("../../App"), {
  ssr: false,
});

export default function Home() {
  return <TraitorsApp />;
}
