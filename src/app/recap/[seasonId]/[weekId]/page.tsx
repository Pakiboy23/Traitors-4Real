import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WeeklyRecapView, { RecapUnavailable } from "../../../../../components/WeeklyRecapView";
import { loadPublicWeeklyRecap } from "../../../../../src/utils/loadPublicRecap";
import { RECAP_FIXTURE } from "../../../../../src/utils/recapFixture";
import {
  publicRecapUrl,
  recapShareDescription,
  type PublicWeeklyRecap,
} from "../../../../../src/utils/weeklyRecap";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type RecapParams = { seasonId: string; weekId: string };
type RecapSearch = { fixture?: string };

const unpublishedMetadata = (canonical: string): Metadata => ({
  title: "Recap not published yet · Round Table Draft",
  description: "This week's recap isn't available yet.",
  robots: { index: false, follow: false },
  alternates: { canonical },
  openGraph: {
    title: "Recap not published yet · Round Table Draft",
    description: "This week's recap isn't available yet.",
    url: canonical,
    siteName: "Round Table Draft",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recap not published yet · Round Table Draft",
    description: "This week's recap isn't available yet.",
  },
});

const publishedMetadata = (recap: PublicWeeklyRecap, canonical: string): Metadata => {
  const title = `${recap.weekLabel} recap · ${recap.leagueName}`;
  const description = recapShareDescription(recap);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      siteName: "Round Table Draft",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
};

const devFixture = (
  seasonId: string,
  weekId: string,
  fixture: string | undefined
): PublicWeeklyRecap | null => {
  if (process.env.NODE_ENV !== "development" || fixture !== "1") return null;
  return { ...RECAP_FIXTURE, seasonId, weekId };
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RecapParams>;
  searchParams: Promise<RecapSearch>;
}): Promise<Metadata> {
  const [{ seasonId, weekId }, query] = await Promise.all([params, searchParams]);
  const canonical = publicRecapUrl(seasonId, weekId);
  const fixture = devFixture(seasonId, weekId, query.fixture);
  if (fixture) return publishedMetadata(fixture, canonical);
  const loaded = await loadPublicWeeklyRecap(seasonId, weekId);
  if (loaded.status !== "published") return unpublishedMetadata(canonical);
  return publishedMetadata(loaded.recap, canonical);
}

export default async function RecapPage({
  params,
  searchParams,
}: {
  params: Promise<RecapParams>;
  searchParams: Promise<RecapSearch>;
}) {
  const [{ seasonId, weekId }, query] = await Promise.all([params, searchParams]);
  const fixture = devFixture(seasonId, weekId, query.fixture);
  if (fixture) return <WeeklyRecapView recap={fixture} />;
  const loaded = await loadPublicWeeklyRecap(seasonId, weekId);
  if (loaded.status === "error") {
    return (
      <RecapUnavailable
        title="Couldn't load this recap"
        body="The link is right, but the league data didn't load. Try it again in a minute."
      />
    );
  }
  if (loaded.status !== "published") notFound();
  return <WeeklyRecapView recap={loaded.recap} />;
}
