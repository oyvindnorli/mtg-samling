# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start Vite dev server (includes Scryfall API proxy)
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build locally
```

No linting or test commands configured.

## Tech Stack

- **Frontend**: React 19 + React Router 7 + TypeScript (strict mode)
- **Build**: Vite 7
- **Backend**: Supabase (PostgreSQL + OTP auth)
- **Local Storage**: Dexie.js (IndexedDB)
- **Styling**: Tailwind CSS 4
- **Deployment**: Vercel

## Architecture Overview

**Entry Points:**
- `src/main.tsx` - React root with BrowserRouter
- `src/App.tsx` - Main component handling auth, collection state, and routing

**Key Directories:**
- `src/pages/` - Route page components (HomePage, SetPage)
- `src/components/` - Reusable UI components
- `src/lib/` - Core integrations (supabase.ts, db.ts, sync.ts)
- `src/utils/scryfall.ts` - Scryfall API client with rate limiting

**State Management:**
- React hooks only (no Redux/Zustand)
- Collection state lives in App.tsx, passed via props
- useRef guards for sync control: `hydratedRef`, `syncInProgressRef`, `needsResyncRef`

**Data Flow:**
1. User authenticates via Supabase OTP (magic links)
2. Collection hydrates from `mtg_collection_items` Supabase table
3. Dexie provides offline IndexedDB fallback
4. Supabase is source of truth

## Scryfall API Integration

Located in `src/utils/scryfall.ts`:
- Rate limited to 1 request/second with queue
- 2-minute JSON cache
- CORS proxy fallback chain for browser requests
- Vite dev proxy at `/scryfall` rewrites to api.scryfall.com

**Key helpers:**
- `makeOwnedKey(cardId, finish)` - Creates unique collection key
- `getCardImage(card)` - Extracts image URL from card object
- `compareCollector()` - Sorts by collector number
- `scryfallFetch()` - Rate-limited fetch wrapper

## Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Deployment

Site: **mtgcoll.com** (hosted on Vercel)

Push to `main` branch to deploy:
```bash
git add <files> && git commit -m "message" && git push
```

Vercel automatically builds and deploys on push to main.

## Notes

- UI text is in Norwegian
- Price data from Scryfall (EUR) converted to NOK via Frankfurt exchange rate API
- Collection key format: `${cardId}::${finish}` (handles multiple copies & finishes)
- Auto-sync is currently disabled; manual save triggers Supabase updates
