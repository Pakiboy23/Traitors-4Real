# Archived: `season-legacy` cast portraits

The 23 portraits here are for the celebrity cast of the season stored under
`season_id = "season-legacy"` in `season_states` / `seasons` — not the live
season. They moved out of `public/cast-portraits/` because Next.js ships
everything under `public/` verbatim (Vercel deploy and the Capacitor iOS
bundle alike), with no filtering by what the current cast's slugs actually
resolve to, so leaving them there meant shipping 23 unused images in every
build. They're kept here, not deleted, for reference.

Filenames are `slugifyCastName(name).png` for that season's roster (e.g.
`lisa-rinna-rhobh.png` for `"Lisa Rinna (RHOBH)"`) — see
`src/castPortraits.ts`. None of these match `traitors-new-blood-s1`'s cast,
so none of them should be copied or restored into `public/cast-portraits/`.

If a future season revives one of these people, add a fresh copy to
`public/cast-portraits/` under that season's slug — don't repoint this
archive back into `public/`.
