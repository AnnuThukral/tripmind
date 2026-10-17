# TripMind: Master Plan

TripMind is a free, publicly hosted AI travel planner, built as a portfolio project.

**Decisions so far:** Next.js + TypeScript, near-zero running cost (free data sources, cheapest Claude model), portfolio and learning goal first, repo `AnnuThukral/tripmind`.

---

## 1. What an end-to-end travel planner covers

### A. Inspiration and destination discovery

- "Where should I go?" quiz covering budget, dates, vibe, climate and maximum flight time
- Suggested destinations with reasons: best season, crowds, cost, safety, visa difficulty for the traveler's passport
- Side-by-side comparison of destinations
- Hidden gems, trending places, events and festivals during the trip dates
- Multi-city and road-trip routes

### B. Pre-trip essentials

- Visa and entry requirements by passport, passport validity rules
- Vaccinations and travel insurance
- Weather forecast and typical climate
- Currency, exchange rates, tipping, typical costs
- Language basics, etiquette, dress codes, common scams, safety advisories
- Plug type, SIM or eSIM, useful local apps

### C. Getting there and getting around

- Flights, trains, buses, ferries, car rental
- Airport transfers
- Local transport passes, walking routes, ride-hailing
- Travel times between itinerary stops

### D. Accommodation

- Hotels, hostels, rentals
- Which neighborhood to stay in, and why
- Filters for price, amenities, accessibility, families and pets
- A location that suits the itinerary

### E. Activities and experiences

- Attractions, tours, museums, nature, nightlife, shopping, wellness, adventure
- Opening hours, prices, when to book ahead, best time of day to visit
- Events during the trip, plus rainy-day backups

### F. Food and drink

- Restaurants, street food, cafes, bars, must-try dishes
- Dietary filters (vegetarian, vegan, halal, kosher, gluten-free, allergies) and budget tiers

### G. Itinerary builder (the core)

- Day-by-day plan with time slots and sensible pacing
- Each day kept within one area, built around opening hours and meals, with a lighter first day
- A map view for each day
- Editing: drag and drop, swap an item, regenerate a day, or ask in chat

### H. Budget

- Cost estimate broken down by category
- Tracking actual spending against the plan, in multiple currencies
- Splitting costs within a group

### I. Packing and preparation

- Packing list based on the weather and planned activities
- Document checklist and reminders

### J. During the trip

- A "today" view
- Offline access
- Re-planning on the go
- Emergency information

### K. Sharing

- Share links and co-planners with voting
- Export to PDF and calendars

### L. After the trip

- Trip journal
- Ratings that improve future suggestions
- Public templates other people can use

## 2. Personalization

- **Per-trip inputs:** origin, destination (or "help me choose"), dates (fixed or flexible), travelers, budget, purpose of the trip.
- **Saved profile:** interests, pace, accommodation style, diet, accessibility needs, passport, must-sees, things to avoid.
- **How the AI uses it:**
  - TripMind fetches real places and weather in code, then makes one Claude call with them.
  - It returns an itinerary as validated JSON.
  - It explains each pick ("whyItFits").
  - It learns from feedback and edits.

## 3. What a business-ready product needs

### Must-haves

- Sign-in, with a guest mode
- Grounded data: every place traces back to a real ID, and sources are shown
- Validated AI output, with retries and fallbacks
- Rate limits, caching and a switch that pauses all AI use
- Security: keys kept on the server, inputs validated
- Privacy policy and terms of service, plus data export and deletion
- Mobile-first and accessible design
- Error tracking and analytics
- Admin and cost dashboard
- Automated tests and CI/CD
- Note that visa and health information is advisory

### Nice-to-haves

- Booking inside the app
- Price alerts
- Group voting and expense splitting
- Voice input and multiple languages
- Progressive web app or mobile app, with offline mode
- Live re-planning
- Importing bookings from confirmation emails
- Community templates
- Carbon score for each trip
- An API for travel agencies

## 4. Tech stack (free tier)

| Layer                  | Choice                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| App                    | Next.js (App Router) + TypeScript + Tailwind                                              |
| AI                     | Claude API, `claude-haiku-5-5` by default (`PLANNER_MODEL` to override)                   |
| Places                 | OpenStreetMap Overpass API (later: OpenTripMap, Wikivoyage)                               |
| Geocoding              | Nominatim                                                                                 |
| Weather                | Open-Meteo                                                                                |
| Maps and routing       | Leaflet + OSM tiles, OpenRouteService                                                     |
| Currency               | Frankfurter                                                                               |
| Flights, hotels, tours | Links to Google Flights, Skyscanner, Booking.com, GetYourGuide with the search pre-filled |
| Database and auth      | Supabase (free)                                                                           |
| Rate limiting          | Upstash Redis (free)                                                                      |
| Hosting                | Vercel Hobby                                                                              |
| Monitoring             | Sentry + Vercel Analytics                                                                 |

**Cost guardrails:**

- 2 trips a day for guests and 5 for signed-in users
- Place and weather data cached
- Token caps on each generation
- `AI_DISABLED` switch to pause all AI use
- Users who bring their own API key skip the limits

## 5. Roadmap

- [x] **Phase 0: Setup**
  - Next.js scaffold, linting and formatting, tests, CI
  - Itinerary schema and planner agent
  - Free data tools: geocoding, weather, places
- [ ] **Phase 1: First working version**
  - [x] Trip input form
  - [x] Planner agent with tools and a Zod-validated itinerary
  - [x] Check that every recommended place is real
  - [x] Day-by-day itinerary view
  - [x] Map view for each day (Leaflet)
  - [ ] Regenerate a day, swap an item, chat-based edits
  - [ ] Save trips (Supabase auth), share links, PDF export
  - [x] Daily trip quotas (per visitor and global) and cached data lookups
  - [ ] Connect Upstash so quotas hold across serverless instances
  - [x] Public deploy on Vercel (https://tripmind-rho.vercel.app)
- [ ] **Phase 2: Full coverage**
  - Destination discovery quiz
  - Where to stay, with links
  - Transport links
  - Budget, packing list, visa and pre-trip checklist
  - Saved profiles and personalization from feedback
- [ ] **Phase 3: Polish**
  - Quota display and bring-your-own-key
  - Admin dashboard
  - Sentry and Playwright end-to-end tests
  - Privacy policy and terms
  - SEO template pages
  - Progressive web app
  - Portfolio README with a demo
- [ ] **Phase 4: Extras**
  - Collaboration and expense splitting
  - Price alerts
  - Live re-planning
  - Calendar sync
  - Multiple languages

## Verification

- **Unit tests:** schemas, tools (with mocked fetch) and the place check.
- **Agent evaluation:** about 20 sample trips, checking for real place IDs, each day staying in one area, opening hours respected, and spending within ±15% of the budget.
- **End-to-end tests:** Playwright runs the form → generate → save → share flow.
- **Cost:** target $0.02 or less per generated trip.
