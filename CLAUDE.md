@AGENTS.md

# TripMind

TripMind is an AI travel planner and portfolio project, deployed on Vercel from `main`. [docs/PLAN.md](docs/PLAN.md) holds the full plan and roadmap. Tick off roadmap items there as they ship.

## Constraints

- **The budget is close to zero.** Use free, keyless data sources (OSM, Open-Meteo). Every Claude call uses `MODEL` from `src/lib/agent/model.ts`, pinned to Claude Haiku (`claude-haiku-5-5`, the cheapest). The owner asked for Haiku only, so never make it configurable or use another model. A test enforces this. Don't add paid APIs without asking.
- **Every recommended place must be real.** Recommended places must come from the fetched candidate list. `enforceGroundedPlaces` in `src/lib/agent/planner.ts` unlinks anything else, so keep that check whenever the planner changes.
- **Keep the planner to one model call.** Fetch data in code first. An earlier tool-calling loop needed several model turns and slow Overpass requests, and timed out on Vercel.
- **The itinerary schema** (`src/lib/schema/trip.ts`) is also the structured-output schema. Keep it free of numeric and length constraints, and do semantic checks in code after parsing.
- **API keys stay on the server.** Never expose them to client components.

## Workflow

- Before committing, run `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`. CI runs the same checks.
- Commit author email must be `annu.thukral1@gmail.com`, or Vercel will block the deploy.
- This is Next.js 16 with `cacheComponents` enabled. Check `node_modules/next/dist/docs/` before using framework APIs.
