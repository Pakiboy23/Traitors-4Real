# Cast portraits

Put current-season files here as `<slug>.png`.

`getCastPortraitSrc()` derives the slug from the cast name, and `<CastPortrait>`
falls back to initials if the file is missing. A file in this folder is shipped
in the web bundle and the native wrapper, so last-season celebrity stills do
not belong here.

New Blood civilians still need portraits (for example `abbey-benjamin.png`).
Do not restore the previous celebrity season to fill the gap.
