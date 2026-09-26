import type { Metadata } from "next";
import { RecapUnavailable } from "../../../../../components/WeeklyRecapView";

export const metadata: Metadata = {
  title: "Recap not published yet · Round Table Draft",
  description: "This week's recap isn't available yet.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Recap not published yet · Round Table Draft",
    description: "This week's recap isn't available yet.",
    siteName: "Round Table Draft",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recap not published yet · Round Table Draft",
    description: "This week's recap isn't available yet.",
  },
};

export default function RecapNotFound() {
  return (
    <RecapUnavailable
      title="This recap isn't published yet"
      body="The league hasn't posted this week. The link will work after it's published."
    />
  );
}
