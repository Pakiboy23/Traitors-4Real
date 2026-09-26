import { ImageResponse } from "next/og";
import { loadPublicWeeklyRecap } from "../../../../../src/utils/loadPublicRecap";

export const alt = "Weekly recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-dynamic";

export default async function RecapOgImage({
  params,
}: {
  params: Promise<{ seasonId: string; weekId: string }>;
}) {
  const { seasonId, weekId } = await params;
  const loaded = await loadPublicWeeklyRecap(seasonId, weekId);
  const recap = loaded.status === "published" ? loaded.recap : null;
  const lines = recap
    ? [
        recap.results.banished ? `Banished   ${recap.results.banished}` : null,
        recap.results.murdered ? `Murdered   ${recap.results.murdered}` : null,
        recap.results.shield ? `Shield   ${recap.results.shield}` : null,
        recap.results.newTraitors.length > 0
          ? `New Traitors   ${recap.results.newTraitors.join(", ")}`
          : null,
      ].filter((line): line is string => Boolean(line))
    : ["This week's recap isn't available yet."];
  const leader = recap?.standings[0];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0d1118",
        color: "#f2eee6",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#d4b272", textTransform: "uppercase" }}>
          {recap?.leagueName ?? "Round Table Draft"}
        </div>
        <div style={{ fontSize: 84, marginTop: 12, fontWeight: 700 }}>
          {recap?.weekLabel ?? "Recap"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 36, lineHeight: 1.35 }}>
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#d4b272" }}>
        {leader ? `1  ${leader.name}  ·  ${leader.score}` : "Round Table Draft"}
      </div>
    </div>,
    { ...size }
  );
}
