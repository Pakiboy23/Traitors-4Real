# Cast portraits

Put current-season files here as `<slug>.png`.

`getCastPortraitSrc()` derives the slug from the cast name, and `<CastPortrait>`
falls back to initials if the file is missing. A file in this folder is shipped
in the web bundle and the native wrapper, so last-season celebrity stills do
not belong here and must not return.

New Blood civilians are present: Peacock/NBC official cast publicity photos, as
published in Gold Derby's New Blood cast gallery (Deadline has a mirror). Do
not generate faces, and do not restore the previous celebrity season.
