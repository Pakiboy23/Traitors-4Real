/**
 * Cast for The Traitors: New Blood.
 *
 * Unlike previous seasons this is an all-civilian cast, so a name on its own
 * tells a player nothing. Age, occupation and hometown are the only things
 * distinguishing twenty-two strangers at draft time, which is why they are
 * modelled as data rather than baked into the display name the way the
 * celebrity seasons did it ("Lisa Rinna (RHOBH)").
 *
 * Provenance, so this is easy to correct:
 * - Names and hometowns come from NBC's published cast page.
 * - Ages and occupations come from press coverage of the cast announcement and
 *   have not been checked against NBC directly. Treat them as correctable.
 */

export interface CastProfile {
  name: string;
  age?: number;
  occupation?: string;
  hometown?: string;
}

export const NEW_BLOOD_SEASON_ID = "traitors-new-blood-s1";
export const NEW_BLOOD_SEASON_LABEL = "The Traitors: New Blood";

export const NEW_BLOOD_CAST: CastProfile[] = [
  { name: "Abbey Benjamin", age: 37, occupation: "Nurse", hometown: "Mangham, LA" },
  { name: "Abby Lee", age: 29, occupation: "Astrophysicist", hometown: "Saint Paul, MN" },
  { name: "Arisa Thomas", age: 36, occupation: "Dog Groomer", hometown: "Los Angeles, CA" },
  { name: "Ben McDonnell", age: 34, occupation: "Barrel Racer", hometown: "Granbury, TX" },
  { name: "Clyde Moser", age: 32, occupation: "Teacher", hometown: "Charleston, SC" },
  { name: "Jay Vinnedge", age: 36, occupation: "Physician", hometown: "Oklahoma City, OK" },
  { name: "Joe Vanella", age: 44, occupation: "Funeral Director", hometown: "Wantagh, NY" },
  { name: "Katie Fites", age: 23, occupation: "Marketing Manager", hometown: "Jacksonville, FL" },
  { name: "Kim Daily", age: 37, occupation: "Lawyer", hometown: "Houston, TX" },
  { name: "Kriste Lewis", age: 52, occupation: "Realtor", hometown: "Hattiesburg, MS" },
  { name: "Logan Smith", age: 26, occupation: "Realtor", hometown: "Gatlinburg, TN" },
  { name: "Madeline Kostopulos", age: 26, occupation: "Construction Manager", hometown: "San Diego, CA" },
  { name: "Mark Zgoda", age: 26, occupation: "Personal Trainer", hometown: "Phillipsburg, NJ" },
  { name: "Michael Foote", age: 38, occupation: "Lawyer", hometown: "New York, NY" },
  { name: "Morgan Cook", age: 39, occupation: "Content Creator", hometown: "Midland, MI" },
  { name: "Niyyah Hayes", age: 29, occupation: "Therapist", hometown: "Indianapolis, IN" },
  { name: "Shane Beatty", age: 32, occupation: "Ironworker", hometown: "Staten Island, NY" },
  { name: "Sherry Kuehl", age: 65, occupation: "Writer", hometown: "Leawood, KS" },
  { name: "Tomica Adams", age: 54, occupation: "Pilot", hometown: "Boston, MA" },
  { name: "Victor Vollbrechthausen", age: 26, occupation: "Business Executive", hometown: "New York, NY" },
  { name: "Wyatt Gillespie", age: 26, occupation: "Designer", hometown: "Ligonier, PA" },
  { name: "Xavier Scruggs", age: 38, occupation: "MLB Analyst", hometown: "Wesley Chapel, FL" },
];

export const NEW_BLOOD_CAST_NAMES = NEW_BLOOD_CAST.map((member) => member.name).sort(
  (a, b) => a.localeCompare(b)
);
