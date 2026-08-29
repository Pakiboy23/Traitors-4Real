# Cast portraits

Portrait images for the **live** season only. A file here is served at
`/cast-portraits/<slug>.png`; `CastPortrait` (`components/CastPortrait.tsx`)
requests that path via `getCastPortraitSrc` (`src/castPortraits.ts`) and falls
back to the member's initial when the file 404s. That fallback is not an
error state — it is the correct rendering for a slug with no file yet.

**Never add a file for anyone whose photo you don't have in hand.** Do not
scrape NBC, generate a likeness, or otherwise fabricate a portrait. Initials
are correct until real photos are supplied.

## Naming

`slug = slugifyCastName(name)` — lowercased, non-alphanumeric runs collapsed
to a single hyphen, leading/trailing hyphens trimmed (`src/castPortraits.ts`).
Dropping in a real photo is the whole job: add
`public/cast-portraits/<slug>.png` and nothing else needs to change.

## Current roster — `traitors-new-blood-s1`

Derived from the live `season_states` row for this season (not the bundled
`NEW_BLOOD_CAST_NAMES` fallback, though the two agree today). Re-derive from
season state if the cast is ever edited — do not assume this list stays
correct. None of these files exist yet; that is expected.

```
abbey-benjamin.png
abby-lee.png
arisa-thomas.png
ben-mcdonnell.png
clyde-moser.png
jay-vinnedge.png
joe-vanella.png
katie-fites.png
kim-daily.png
kriste-lewis.png
logan-smith.png
madeline-kostopulos.png
mark-zgoda.png
michael-foote.png
morgan-cook.png
niyyah-hayes.png
shane-beatty.png
sherry-kuehl.png
tomica-adams.png
victor-vollbrechthausen.png
wyatt-gillespie.png
xavier-scruggs.png
```

## Last season's files

The 23 files that used to live here — named for `season-legacy`'s celebrity
cast (`lisa-rinna-rhobh.png` and the like) — don't match any slug this season
produces, so they were dead weight in every build: Next.js ships everything
under `public/` verbatim, in both the Vercel deploy and the Capacitor iOS
bundle (`npm run ios:sync:bundled`), with no filtering by what's actually
referenced. They've moved to `archive/cast-portraits/season-legacy/`, outside
`public/`, so they stop shipping but aren't deleted.
