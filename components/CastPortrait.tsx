import React, { useEffect, useState } from "react";
import { getCastPortraitSrc } from "../src/castPortraits";

interface CastPortraitProps {
  name: string;
  portraitUrl?: string | null;
  /** Applied to the <img> itself; the surrounding frame stays with the caller. */
  imgClassName?: string;
  /** Shown when there is no photo. Callers pass their own initial styling. */
  fallback: React.ReactNode;
}

/**
 * A cast member's photo, or their initial when there isn't one.
 *
 * Portrait paths are derived from the name, so a path exists for everybody
 * whether or not the file has been added yet. This is the single place that
 * knows a missing file means "show the initial" rather than a broken image
 * icon — which is what every caller would otherwise render the first time
 * someone drafted a member whose photo had not been supplied.
 */
const CastPortrait: React.FC<CastPortraitProps> = ({
  name,
  portraitUrl,
  imgClassName,
  fallback,
}) => {
  const src = getCastPortraitSrc(name, portraitUrl);
  const [failed, setFailed] = useState(false);

  // A new source deserves a fresh attempt: these components are recycled as
  // the roster is re-ordered, and a previous member's missing photo must not
  // suppress the next member's.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img src={src} alt="" className={imgClassName} onError={() => setFailed(true)} />
  );
};

export default CastPortrait;
