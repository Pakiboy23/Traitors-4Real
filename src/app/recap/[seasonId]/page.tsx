import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadLiveSeasonId } from "../../../../src/utils/loadPublicRecap";
import { recapPath } from "../../../../src/utils/weeklyRecap";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export const metadata: Metadata = {
  title: "Weekly recap · Round Table Draft",
  robots: { index: false, follow: false },
};

/**
 * Short link /recap/week-2. The first segment has to be named seasonId
 * because /recap/[seasonId]/[weekId] already uses that name — Next.js
 * rejects two dynamic names at the same position.
 */
export default async function ShortRecapPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId: segment } = await params;
  if (!/^week-\d+$/i.test(segment)) notFound();
  const liveSeasonId = await loadLiveSeasonId();
  if (!liveSeasonId) notFound();
  redirect(recapPath(liveSeasonId, segment));
}
