import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Round Table Draft",
  description: "Help with Round Table Draft: entries, scoring, notifications, and data removal.",
};

/**
 * Support page.
 *
 * Required by App Store Connect and opened by reviewers, so it needs to answer
 * real questions rather than be a placeholder. Lives in this app so the URL is
 * deployed with the code and cannot rot independently of it.
 */
export default function Support() {
  return (
    <main className="legal-page">
      <h1>Support</h1>

      <p>
        Round Table Draft runs a private fantasy league built around a reality
        competition series. It is an independent app: it is not affiliated with,
        endorsed by, or connected to any television network, studio, or
        production company, and it is not an official companion to any
        programme.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@traitorsfantasydraft.online">
          support@traitorsfantasydraft.online
        </a>
        <br />
        Most questions are answered within a couple of days, and faster during a
        live season.
      </p>

      <h2>Common questions</h2>

      <h3>The draft is closed. When does it open?</h3>
      <p>
        The draft opens when the season goes live and closes at the scheduled
        lock before the premiere. The Draft screen always says which of those
        applies, so if it looks closed the message on that screen is the reason.
      </p>

      <h3>How does scoring work?</h3>
      <p>
        The Rules tab lists every value, generated from the rules the scoreboard
        actually uses, so what you read there is what gets awarded. Two points
        catch people out: Double or Nothing doubles a wrong weekly call as well
        as a right one, and the Traitor Trio bonus needs all three names — two
        correct pays the per-name rate, not the full bonus.
      </p>

      <h3>My score looks wrong.</h3>
      <p>
        Open the Leaderboard and expand your entry to see where each point came
        from, including any manual adjustment and the reason for it. If it still
        looks wrong, email us with your name and the week.
      </p>

      <h3>I submitted twice by mistake.</h3>
      <p>
        Entries are matched on your email address, so the administrator can
        reconcile duplicates. Email us and say which entry should count.
      </p>

      <h3>Can I change my picks after submitting?</h3>
      <p>
        Not once a week has locked — that is what keeps the game fair. Before
        the lock, submit again and tell the administrator which entry to keep.
      </p>

      <h3>How do I turn notifications off?</h3>
      <p>
        iOS Settings, then Notifications, then Round Table Draft. Turning
        them off stops reminders immediately.
      </p>

      <h3>How do I delete my data?</h3>
      <p>
        Email us from the address you entered with and everything associated
        with it is removed within 30 days. See the{" "}
        <a href="/privacy">privacy policy</a> for what is stored.
      </p>
    </main>
  );
}
