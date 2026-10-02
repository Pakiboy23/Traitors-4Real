import type { Metadata } from "next";
import { RecapUnavailable } from "../../../../components/WeeklyRecapView";

export const metadata: Metadata = {
  title: "Recap not available · Round Table Draft",
  description: "That recap link isn't available.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Recap not available · Round Table Draft",
    description: "That recap link isn't available.",
    siteName: "Round Table Draft",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recap not available · Round Table Draft",
    description: "That recap link isn't available.",
  },
};

export default function RecapHubNotFound() {
  return (
    <RecapUnavailable
      title="Recap not available"
      body="That link doesn't match a published recap."
    />
  );
}
