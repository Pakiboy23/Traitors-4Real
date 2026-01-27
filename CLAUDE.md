# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **React + TypeScript fantasy draft application** for "The Traitors" TV show (Titanic Swim Team Edition). Users create draft entries predicting game outcomes and view leaderboards with calculated scores.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Firebase Hosting

## Common Commands

```bash
# Install dependencies
npm install

# Development server (port 3000)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview

# Deploy to Firebase
firebase deploy
```

## Architecture

```
├── src/index.css          # Tailwind directives + custom animations
├── components/            # React components
│   ├── Layout.tsx         # Navigation & theme toggle
│   ├── DraftForm.tsx      # Draft entry form with validation
│   ├── Leaderboard.tsx    # Score calculation & rankings
│   └── AdminPanel.tsx     # Admin management interface
├── App.tsx                # Main app with centralized state
├── types.ts               # TypeScript interfaces & cast list
└── vite.config.ts         # Vite config with @/* path alias
```

**State Management:** Centralized in `App.tsx`, persisted to localStorage (key: `traitors_db_v4`). No Redux/Context - props flow down from App.

## Code Conventions

- **Components:** Functional with TypeScript (`React.FC<Props>`)
- **Styling:** Tailwind CSS only; theme colors use gold (`#D4AF37`), red tones, zinc/black backgrounds
- **Naming:** PascalCase components, UPPER_SNAKE_CASE constants, camelCase functions
- **Types:** All interfaces in `types.ts` - `PlayerEntry`, `DraftPick`, `CastMemberStatus`, `GameState`

## Scoring System

- Winner pick: +10 points
- First out pick: +5 points
- Correct traitor identification: +3 points
- Incorrect traitor guess: -2 points

## Important Notes

- Cast list (22 members) defined in `types.ts`
- Admin password in `App.tsx` line ~56 (change for production)
- Email recipients hardcoded in `DraftForm.tsx` line ~106
- Firebase config in `firebase.json` - SPA rewrites enabled
- Portrait URLs can be manually set in Admin Panel via "Set URL" button
