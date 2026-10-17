# TripMind

TripMind is an AI travel planner that builds a personalized, day-by-day itinerary from real places, live weather and your own preferences.

You tell it where you're going, when, who's coming, your budget, your interests, your pace and any dietary needs. TripMind then:

1. Finds the destination with OpenStreetMap (Nominatim).
2. Checks the weather forecast for your dates (Open-Meteo).
3. Fetches real, named attractions, restaurants and cafes near the destination in one OpenStreetMap (Overpass) request, picking categories that match your interests. Weather and places are fetched in parallel and cached.
4. Hands all of that to Claude in a single request, which returns a structured itinerary. The app checks it against a schema, and any place that wasn't in the fetched list is unlinked.

Every data source is free and needs no API key. The only paid service is the Claude API, which uses its cheapest model by default.

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

| Variable            | Required | Purpose                                         |
| ------------------- | -------- | ----------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Key for the Claude API                          |
| `PLANNER_MODEL`     | no       | Which model to use (default `claude-haiku-5-5`) |
| `AI_DISABLED`       | no       | Set to `true` to pause trip generation          |

## How it's built

```
src/
  app/api/plan/route.ts      POST: validate → daily quota → planner → itinerary JSON
  app/api/health/route.ts    GET: status and whether the AI is configured
  lib/agent/planner.ts       Fetch data, one Claude call, real-place check
  lib/schema/trip.ts         Zod schemas for the trip request and itinerary
  lib/tools/                 geocode, weather and places clients
  components/                TripForm, ItineraryView
```

See [docs/PLAN.md](docs/PLAN.md) for the full feature plan and roadmap.

## Deploying

The app runs on Vercel. To deploy it, import this repository at vercel.com/new, add `ANTHROPIC_API_KEY` in the project settings, and deploy. After that, every push to `main` deploys automatically.
