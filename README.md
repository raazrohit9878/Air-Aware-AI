# AirAware AI — Breathe Better, Live Smarter

A mobile-friendly daily air-quality planner with Supabase authentication, six-step household onboarding, personalized routines, indoor air guidance, an AI chatbot, optional nearby monitoring stations with an interactive Leaflet map, and a community activity view.

**Live deployment:** https://airaware-ai-psi.vercel.app

## Chosen Vertical & Persona

* **Vertical:** Urban Sustainability, Clean Air & Environmental Health
* **Target Persona:** Urban households (families with children, older adults, commuters, and budget-conscious residents) navigating daily air-pollution exposure and transport choices without assuming access to expensive air-purification equipment or private vehicles.

## Approach and Logic

AirAware AI follows a **rules-first, context-grounded AI second** architecture so safety-critical numbers and guidance are never left to freeform LLM generation:

1. **Independent data separation:** Atmospheric forecast estimates (Open-Meteo US AQI) and nearby ground-monitor observations (OpenAQ v3) are fetched and displayed independently, never merged or disguised as official CPCB-published AQI.
2. **Conservative precaution selection (`guidanceBand`):** In [src/airQualityUtils.js](src/airQualityUtils.js), `stationCanGuide` verifies that an OpenAQ station has a valid calculated India AQI (`>= 3` pollutant sub-indices including PM2.5 or PM10) backed by fresh readings (`<= 6` hours old). Only eligible stations can raise today's precaution band above the Open-Meteo model band.
3. **Personalized household rules (`buildAdvice`):** Generates three time-of-day actions (Morning outdoor activity, Afternoon indoor air, Evening commute) adapted to household sensitivities (children, older adults, respiratory concerns), equipment availability (purifier, window control), commute mode (`Private car` / `Car` vs. transit/active), and seasonal hemisphere/month winter routines (`isWinterLocation`).
4. **Exposure vs. emissions separation:** Personal exposure actions (avoiding busy roads, indoor source control) are kept explicitly separate from environmental emissions estimates (shared trips or public transit).
5. **Context-grounded assistant (`createChatResponse`):** In [api/ai/chat-core.js](api/ai/chat-core.js), emergency symptom phrases (`can't breathe`, `chest pain`, `severe symptoms`) are intercepted deterministically before reaching the LLM. Non-emergency queries pass sanitized non-PII JSON context to **NVIDIA NIM** (`nvidia/nemotron-3.5-bolt-e4b`) and fall back to reviewed rule-based guidance (`guideAnswer`) whenever `NVIDIA_API_KEY` is absent or unavailable.

## How the Solution Works

1. **Landing, Auth & 6-Step Onboarding (`src/AuthGate.jsx`, `src/components/`):**
   * Unauthenticated visitors see the landing overview ([LandingPage.jsx](src/components/LandingPage.jsx)) and Supabase Auth flows ([AuthPanel.jsx](src/components/AuthPanel.jsx)) supporting email/password, verification resend, password recovery, and OAuth.
   * Signed-in users complete a 6-step onboarding wizard ([OnboardingWizard.jsx](src/components/OnboardingWizard.jsx)) backed by five Supabase Postgres tables (`user_profiles`, `household_profiles`, `sensitivity_profiles`, `lifestyle_profiles`, `home_profiles`) protected by owner-only Row Level Security (`auth.uid() = user_id`).
2. **Dashboard & Real-Time Air Intelligence (`src/App.jsx`, `src/components/TodayView.jsx`):**
   * Geocodes the user's selected city via Open-Meteo Geocoding API and fetches hourly/current US AQI, pollutants (`PM2.5`, `PM10`, `NO₂`, `O₃`), and weather (`temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`).
   * Calls the authenticated serverless endpoint `GET /api/air-quality/stations` ([api/air-quality/stations.js](api/air-quality/stations.js)) which queries stationary OpenAQ v3 monitors within 25 km, normalizes units, computes CPCB-breakpoint India AQI (`calculateIndianAqi`), and plots markers on an interactive lazy-loaded Leaflet map ([src/MonitorMap.jsx](src/MonitorMap.jsx)).
3. **Action Plan, Commute Calculator & Community (`PlanView.jsx`, `CommunityView.jsx`):**
   * Renders the 3-step tailored daily plan alongside an interactive solo-car vs. public-transport CO₂e estimator and logs trips to `community_activities` via [src/communityService.js](src/communityService.js).
   * Calls the `get_airaware_community_stats` RPC, which withholds city totals until at least five distinct households participate in the prior 30 days.
4. **AI Chat Assistant (`ChatAssistant.jsx`, `/api/ai/chat`):**
   * Sends the user's question, recent turn history, and sanitized air/household context with the user's Supabase JWT to `POST /api/ai/chat` ([api/ai/chat.js](api/ai/chat.js)), which verifies the session, enforces a sliding-window rate limit (18 req/min), and queries NVIDIA NIM.

## Assumptions Made

* **Commute emissions baseline:** The illustrative commute calculator assumes a solo petrol car emits **192 g CO₂e/km** and public transit adds zero incremental emissions; actual savings vary by vehicle, fuel, occupancy, and transit system.
* **CPCB India AQI calculation:** Computed only when at least **3 pollutant sub-indices** (including `PM2.5` or `PM10`) meet coverage rules: **>= 16 valid hours** in the last 24 hours per pollutant, plus **>= 6 valid hours** in the latest 8-hour window for `CO` and `O₃`. Gas readings in `ppm`/`ppb` are converted to mass concentration assuming **25°C** (`24.45 L/mol`).
* **Data freshness:** Station measurements older than **6 hours** (or more than 15 minutes ahead of local clock) are marked stale and excluded from raising today's precaution level; Open-Meteo timestamps older than **3 hours** trigger a stale-data notice.
* **Seasonal winter routine:** Uses hemisphere (`latitude < 0` vs `>= 0`) and calendar month (`May–Sep` south, `Nov–Feb` north) only; the app does not detect temperature inversions or measure indoor air.
* **Privacy & health boundaries:** Community totals require **>= 5 distinct households** over 30 days. All advice is general informational guidance, not medical diagnosis or treatment, and account emails/names are excluded from NIM prompts.

## Run locally

Requirements: Node.js 18 or newer and a Supabase project. The Vite and React versions are pinned to releases that support Node 18.

```sh
npm install
npm run dev
```

Run linting and automated tests with:

```sh
npm run lint
npm test
```

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the public client key from Supabase project settings. Run `supabase/schema.sql` in the Supabase SQL Editor. In Supabase Authentication settings, enable email/password, configure the site URL and local redirect URL (for example `http://localhost:5173`), and configure SMTP/email verification for your deployment. Vite prints the local URL. `npm run build` creates the production frontend bundle. `start-airaware.bat` installs dependencies and starts Vite on Windows.

The landing page works before Supabase is configured. Login, account creation, profile saving, and password reset intentionally remain unavailable until a real Supabase URL/key and schema are configured; this app does not simulate authentication. The signed-in dashboard includes an AirAware chat assistant. It uses reviewed local guidance when no model key is configured and calls NVIDIA NIM through a server-side endpoint when configured.

## Data and limitations

- The dashboard shows a clearly labelled Open-Meteo **US AQI model estimate** and separately labelled OpenAQ ground-monitor observations when configured and available.
- Weather and location search use Open-Meteo's public Forecast and Geocoding APIs. Values show unavailable when the request fails or a field is missing; the app does not substitute sample readings.
- Nearby monitor data is retrieved through OpenAQ API v3. In India, a CPCB-breakpoint-based India AQI estimate is shown only when hourly monitor measurements meet the AQI coverage rules; it is an app calculation, not a CPCB-published AQI. Official information remains available from the [CPCB portal](https://airquality.cpcb.gov.in/AQI_India/).
- This MVP does not measure indoor air or detect temperature inversions. Nearby OpenAQ monitoring stations (when configured) and the selected city are displayed on an interactive Leaflet / OpenStreetMap view (`src/MonitorMap.jsx`). Seasonal winter routines use location hemisphere and calendar month only.
- Recommendation text is rule-based general guidance. It is not medical advice, a diagnosis, or a guarantee of protection.
- The commute calculator is an illustrative estimate using 192 g CO₂e per solo-car kilometre and zero incremental transit emissions. It is not a measured citywide reduction. Actual results vary by vehicle, fuel, passengers, and transit system.
- Household profile fields are stored in Supabase under owner-only Row Level Security and cached in browser `localStorage` for dashboard personalization. Community activity needs the optional migration described below.

### OpenAQ and community setup

- Optional station measurements need an OpenAQ API v3 key. Add `OPENAQ_API_KEY` to `.env` for local development and to the server environment for deployment. It is server-only; never prefix it with `VITE_`. Create a key from [OpenAQ](https://explore.openaq.org/register). Without a key, no station values are shown and the separate model estimate continues to work.
- Run `supabase/community-activities.sql` in Supabase SQL Editor to enable community activity logging. Its policies restrict personal records to their owner. The aggregate-only RPC hides city totals until five distinct households have participated in the prior 30 days. Those CO₂e values are modeled household estimates, not measured changes in city air pollution.
- Station observations, data provider, distance, age and raw units are displayed independently from Open-Meteo. OpenAQ hourly observations are used for the optional India AQI estimate only when coverage is sufficient. See [OpenAQ locations](https://docs.openaq.org/resources/locations) and the [CPCB National AQI method](https://www.cpcb.nic.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvQWJvdXRfQVFJLnBkZg).

## Authentication setup

- Supabase Auth handles password storage, sessions, email verification, sign-in, and password-reset links. The app never writes passwords to `user_profiles`.
- `supabase/schema.sql` creates/upgrades the existing Step 1 `user_profiles` table. Do not replace it when setting up the remaining onboarding steps.
- `supabase/upgrade-user-profiles.sql` upgrades an existing `user_profiles` table by adding all columns the app uses, and refreshes the Supabase schema cache.
- `supabase/onboarding-sections.sql` creates/upgrades the separate Step 2–5 tables (`household_profiles`, `sensitivity_profiles`, `lifestyle_profiles`, and `home_profiles`) with per-user RLS, validated options, one row per user, and `updated_at` triggers. Run this migration in Supabase SQL Editor; it preserves `user_profiles` and existing data.
- `supabase/verify-onboarding-sections.sql` contains read-only queries for checking the tables, constraints, indexes, RLS policies, and triggers after migration.
- `src/onboardingService.js` loads the signed-in user's onboarding data and upserts each step using the authenticated Supabase user ID. `src/onboardingOptions.js` shares the existing UI dropdown and checkbox options with validation.
- `api/ai/chat.js` is the authenticated Vercel chat endpoint; `vite.config.js` provides the same endpoint during local development. The API verifies the Supabase session and limits request size and frequency.
- To enable NVIDIA NIM, set `NVIDIA_API_KEY` and optionally `NVIDIA_NIM_MODEL` in the local `.env` file. Add the same variables to the deployed backend/serverless environment. The default model is `nvidia/nemotron-3.5-bolt-e4b`. Without a key, the chat remains usable in reviewed AirAware guide mode. Never use a `VITE_` prefix for the NVIDIA key.
- When NIM is enabled, chat messages and limited context (city, displayed model readings, and selected household preferences) are sent to NVIDIA. The widget explains this and does not include the account email or name.
- The browser only receives the Supabase publishable/anon key. Never put a service-role key or NVIDIA NIM secret in a `VITE_` variable.
- Registration requires email verification when enabled in Supabase. Users can sign in after verification and complete onboarding if their profile row does not exist.
- Profile edits and deletion are available from the signed-in account bar. Deleting the household profile does not delete the Supabase Auth account.
- Google, X/Twitter, and GitHub buttons call Supabase OAuth. Enable each provider in Supabase Authentication settings and enter that provider's OAuth client credentials there; configure the callback URL shown by Supabase at the provider. Add `http://localhost:5173` and your deployed site URL to Supabase's allowed redirect URLs. OAuth buttons cannot work until the provider is configured.

## Suggested next increments

1. Connect directly to an official CPCB feed if a stable documented endpoint is available, and keep its readings distinct from OpenAQ observations.
2. Expand the illustrative commute estimate into a user-configurable vehicle, fuel, occupancy, alternative-mode, and trip-frequency calculator with maintained emission-factor citations.
3. Add historical measured air-quality trends, notifications, and full English, Hindi, and Kannada UI localization.
4. Expand and review the recommendation library, and evaluate NIM responses for safety. Keep measurements and safety rules outside model-generated text.
5. Consider a dedicated FastAPI data service for production caching, monitoring, and provider normalization; the current data and chat routes are authenticated Vercel functions with equivalent Vite development middleware.
