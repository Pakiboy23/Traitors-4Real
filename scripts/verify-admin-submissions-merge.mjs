import { readFile } from "node:fs/promises";

const targetPath = new URL("../components/AdminPanel.tsx", import.meta.url);
const source = await readFile(targetPath, "utf8");

const requiredPatterns = [
  {
    name: "no merge conflict markers",
    test: !/^(<<<<<<<|=======|>>>>>>>)/m.test(source),
  },
  {
    name: "useCallback import present",
    test: /import React, \{[^}]*\buseCallback\b[^}]*\} from 'react';/.test(source),
  },
  {
    name: "weekly submission filter helper present",
    test: /const isWeeklySubmissionRecord = \(submission: SubmissionRecord\)/.test(source),
  },
  {
    name: "fallback submissions fetch present",
    test: /if \(records\.length === 0\)/.test(source),
  },
  {
    name: "fallback filters weekly records",
    test: /records = data\.items\.filter\(\(submission\) => isWeeklySubmissionRecord\(submission\)\);/.test(
      source
    ),
  },
  {
    name: "history entry stores bonus points",
    test: /bonusPoints: bonusScore\.hasResults \? bonusScore\.points : undefined,/.test(
      source
    ),
  },
  {
    name: "history entry stores bonus breakdown",
    test: /bonusPointBreakdown: bonusScore\.hasResults/.test(source),
  },
];

const failed = requiredPatterns.filter((pattern) => !pattern.test);

if (failed.length > 0) {
  console.error("Admin submissions merge verification failed:");
  failed.forEach((pattern) => console.error(`- Missing or invalid: ${pattern.name}`));
  process.exit(1);
}

console.log("Admin submissions merge verification passed.");
