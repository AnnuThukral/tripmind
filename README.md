# TripMind

**Live:** https://tripmind-rho.vercel.app

TripMind is an AI travel planner that builds a personalized, day-by-day itinerary from real places, live weather and your own preferences.

## Features

- **Plan a trip.** Give it a destination, dates, travelers, budget, interests, pace and diet. You get a day-by-day plan with a map for each day, plus where to stay, transport, an estimated budget, a packing list and pre-trip essentials (visa, money, plugs, emergency numbers).
- **Help me choose.** Not sure where to go? Pick a month, trip length, budget and vibe, and get 4 destination ideas. One click plans the trip.
- **Change it.** Regenerate a single day, swap one item, or ask in plain words ("make day 2 more relaxed").
- **Personalization.** 👍/👎 on items, and your preferences are remembered, so future plans take them into account.
- **Keep and share it.** Save trips in your browser, share a link (the trip is packed inside the link, with no database), print to PDF, or add every item to your calendar (`.ics`).
- **Book.** Booking.com, Airbnb, GetYourGuide, Google Flights and Rome2Rio links open with your search pre-filled, and Google Maps gives walking routes for each day.

## How it works

1. Finds the destination with OpenStreetMap (Nominatim).
2. In parallel, fetches the weather forecast (Open-Meteo) and real, named places near the destination in a single OpenStreetMap (Overpass) request. Categories are chosen from your interests. Results are cached, and every public Overpass server is queried at once so the fastest one wins.
3. Sends all of that to Claude in one request, which returns a structured itinerary. The app validates it against a schema, and any place that wasn't in the fetched list is unlinked.

Every data source is free and needs no API key. The only paid service is the Claude API, which always uses **Claude Haiku**, the cheapest model. The model isn't configurable, and daily quotas keep spending bounded. A typical plan costs well under a cent.

## Running it locally

You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Scripts

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the development server  |
| `npm test`          | Run the unit tests (Vitest)   |
| `npm run typecheck` | Check types with TypeScript   |
| `npm run lint`      | Check the code with ESLint    |
| `npm run format`    | Format the code with Prettier |
| `npm run build`     | Build for production          |

## Environment variables

| Variable                                             | Required | Purpose                                                          |
| ---------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                  | yes      | Key for the Claude API                                           |
| `AI_DISABLED`                                        | no       | Set to `true` to pause all AI features                           |
| `DAILY_{TRIPS,EDITS,IDEAS}_{PER_VISITOR,GLOBAL}`     | no       | Daily quotas (defaults: trips 3/200, edits 20/1000, ideas 5/300) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | no       | Keep exact quota counts across serverless instances              |

## How it's built

```
src/
  app/api/plan/route.ts      POST: new itinerary
  app/api/revise/route.ts    POST: edit an itinerary (returns only changed days)
  app/api/ideas/route.ts     POST: destination ideas
  app/api/health/route.ts    GET: status and whether the AI is configured
  app/trip/                  Shared-trip page (trip decoded from the URL fragment)
  app/about/                 About and privacy
  lib/agent/                 model.ts (pinned Haiku), planner, revise, ideas
  lib/api.ts                 Shared route flow: kill-switch, validation, quota, errors
  lib/schema/                Zod schemas (also the structured-output formats)
  lib/tools/                 Geocode, weather and places clients, plus cached wrappers
  lib/itinerary/             Map stops, booking links, budget, calendar export
  lib/share.ts, storage.ts   Share-link encoding, browser storage
  components/                Planner, TripForm, IdeasPanel, TripResult, ItineraryView, ...
```

See [docs/PLAN.md](docs/PLAN.md) for the full feature plan and roadmap.

## Deploying

The app runs on Vercel. To deploy it, import this repository at vercel.com/new, add `ANTHROPIC_API_KEY` in the project settings, and deploy. After that, every push to `main` deploys automatically.
