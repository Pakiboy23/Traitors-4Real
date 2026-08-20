import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Round Table Draft",
  description: "What Round Table Draft collects, why, and how to have it removed.",
};

const UPDATED = "20 August 2026";

/**
 * Privacy policy.
 *
 * App Review opens this URL and checks it against the App Privacy answers, so
 * it has to describe what the app actually does rather than boilerplate. Kept
 * as a route in this app so it is deployed and versioned alongside the code it
 * describes, instead of living somewhere that can quietly go stale or offline.
 */
export default function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated {UPDATED}</p>

      <p>
        Round Table Draft runs a private fantasy league built around a reality
        competition series. It is an independent app: it is not affiliated with,
        endorsed by, or connected to any television network, studio, or
        production company, and it is not an official companion to any
        programme.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your name and email address</strong>, when you submit a draft
          or a weekly council entry. Your email identifies your entries so your
          score can be attributed to you and so a duplicate submission can be
          reconciled.
        </li>
        <li>
          <strong>Your picks and predictions</strong>, which are the substance
          of the game.
        </li>
        <li>
          <strong>A device notification token</strong>, if you allow
          notifications. It is used only to send reminders before a weekly
          council locks.
        </li>
      </ul>

      <h2>What we do not collect</h2>
      <ul>
        <li>No advertising or analytics identifiers.</li>
        <li>No location, contacts, photos, microphone, or camera access.</li>
        <li>
          No tracking across other apps or websites, and nothing is shared with
          data brokers or advertisers.
        </li>
      </ul>

      <h2>Where it goes</h2>
      <p>
        Data is stored in Supabase (Postgres, hosted in the United States) and
        served through Vercel. Entries are readable only by the league
        administrator; other players see scores and standings, never your email
        address or notification token. Nothing is sold or shared with third
        parties.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Entries are retained for the season they belong to and archived
        afterwards so past standings remain viewable. Notification tokens are
        deleted automatically once Apple reports the device as no longer
        reachable.
      </p>

      <h2>Removing your data</h2>
      <p>
        Email <a href="mailto:support@traitorsfantasydraft.online">
        support@traitorsfantasydraft.online</a> from the address you used to
        enter, and everything associated with it will be deleted within 30 days.
        You can also turn notifications off at any time in iOS Settings, which
        stops reminders immediately.
      </p>

      <h2>Children</h2>
      <p>
        The app is not directed at children under 13 and we do not knowingly
        collect their information.
      </p>

      <h2>Changes</h2>
      <p>
        If what we collect changes, this page and the App Store privacy
        disclosures will be updated together, and the date above will change.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@traitorsfantasydraft.online">
          support@traitorsfantasydraft.online
        </a>
      </p>
    </main>
  );
}
