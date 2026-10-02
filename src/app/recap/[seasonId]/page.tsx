import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import RecapHubView from "../../../../components/RecapHubView";
import { RecapUnavailable } from "../../../../components/WeeklyRecapView";
import { RECAP_HUB_FIXTURE } from "../../../../src/utils/recapFixture";
import { loadLiveSeasonId, loadPublicRecapIndex } from "../../../../src/utils/loadPublicRecap";
import {
  isShortRecapWeek,
  publicRecapHubUrl,
  recapPath,
  type PublicRecapIndex,
} from "../../../../src/utils/weeklyRecap";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type RecapSegmentParams = { seasonId: string };
type RecapSearch = { fixture?: string };

const unpublishedMetadata = (): Metadata => ({
  title: "Recaps · Round Table Draft",
  description: "Weekly recaps aren't available yet.",
  robots: { index: false, follow: false },
});

const publishedMetadata = (index: PublicRecapIndex): Metadata => {
  const title = `${index.seasonLabel} recaps · ${index.leagueName}`;
  const description =
    index.weeks.map((week) => week.weekLabel).join(" · ") || "Weekly recaps.";
  const canonical = publicRecapHubUrl(index.seasonId);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Round Table Draft",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
};

const devHubFixture = (
  seasonId: string,
  fixture: string | undefined
): PublicRecapIndex | null => {
  if (process.env.NODE_ENV !== "development" || fixture !== "1") return null;
  if (isShortRecapWeek(seasonId)) return null;
  return {
    ...RECAP_HUB_FIXTURE,
    seasonId,
    weeks: RECAP_HUB_FIXTURE.weeks.map((week) => ({
      ...week,
      href: recapPath(seasonId, week.weekId),
    })),
  };
};

/**
 * `/recap/week-2` redirects to the live season's week page.
 * `/recap/<seasonId>` lists that season's published recaps.
 * The first segment has to be named seasonId because
 * `/recap/[seasonId]/[weekId]` already uses that name.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RecapSegmentParams>;
  searchParams: Promise<RecapSearch>;
}): Promise<Metadata> {
  const [{ seasonId: segment }, query] = await Promise.all([params, searchParams]);
  if (isShortRecapWeek(segment)) {
    return {
      title: "Weekly recap · Round Table Draft",
      robots: { index: false, follow: false },
    };
  }
  const fixture = devHubFixture(segment, query.fixture);
  if (fixture) return publishedMetadata(fixture);
  const loaded = await loadPublicRecapIndex(segment);
  if (loaded.status !== "ready") return unpublishedMetadata();
  return publishedMetadata(loaded.index);
}

export default async function RecapSegmentPage({
  params,
  searchParams,
}: {
  params: Promise<RecapSegmentParams>;
  searchParams: Promise<RecapSearch>;
}) {
  const [{ seasonId: segment }, query] = await Promise.all([params, searchParams]);
  if (isShortRecapWeek(segment)) {
    const liveSeasonId = await loadLiveSeasonId();
    if (!liveSeasonId) notFound();
    redirect(recapPath(liveSeasonId, segment));
  }

  const fixture = devHubFixture(segment, query.fixture);
  if (fixture) return <RecapHubView index={fixture} />;

  const loaded = await loadPublicRecapIndex(segment);
  switch (loaded.status) {
    case "ready":
      return <RecapHubView index={loaded.index} />;
    case "error":
      return (
        <RecapUnavailable
          title="Couldn't load recaps"
          body="The link is right, but the league data didn't load. Try it again in a minute."
        />
      );
    case "missing":
      notFound();
    default: {
      const _exhaustive: never = loaded;
      return _exhaustive;
    }
  }
}
