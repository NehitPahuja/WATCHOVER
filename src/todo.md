# 📋 WatchOver — Step-by-Step To-Do List

> Derived from analysis of all three documents: **PRD** (Product Requirements), **Design Doc** (UI/UX Design), and **Tech Doc** (Technical Architecture).

---

## 📊 Document Analysis Summary

| Document    | Focus                    | Key Takeaway                                                                                                                             |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| prd.text    | **What** to build        | Real-time geopolitical intelligence dashboard with case management, predictions, analytics, RBAC, and notifications                      |
| design.text | **How it looks & feels** | Dark tactical UI inspired by Bloomberg/Palantir terminals — 3-panel layout with 3D globe, pulse feed, predictions, markets, and keywords |
| tec.txt     | **How to build it**      | React + Vite + MapLibre/deck.gl frontend, dual-plane backend (Edge API + Realtime Relay), Postgres + Redis + S3 storage                  |

> **⚠️ IMPORTANT:** There are some **mismatches** between the PRD and the Design/Tech docs. The PRD describes a **conflict case management** system (mediators, participants, SLA tracking), while the Design and Tech docs describe a **geopolitical intelligence & forecasting** platform (live events, predictions market, tension index). The to-do list below synthesizes both visions, prioritizing the intelligence platform direction (Design + Tech) as the primary product, since it is far more detailed and cohesive.

---

## 🏁 Phase 0 — Project Setup & Foundation

### 0.1 Repository & Tooling

- [x] Initialize the project with **Vite + React + TypeScript** (`npx create-vite`)
- [x] Configure **ESLint**, **Prettier**, and **TypeScript** `tsconfig.json`
- [x] Set up **Git** repo with `.gitignore`, branch strategy (`main`, `develop`, `feature/*`)
- [x] Install core dependencies:
  - `react`, `react-dom`, `react-router-dom`
  - `maplibre-gl`, `deck.gl`, `@deck.gl/mapbox`
  - `d3` (for micro-charts)
  - `@tanstack/react-query`
  - `sentry/react`
- [x] Configure **Vite PWA plugin** (`vite-plugin-pwa`) for offline support
- [x] Set up **Playwright** for e2e testing

### 0.2 Design System Implementation

- [x] Configure **Google Fonts**: Inter / Space Grotesk (headings/body), JetBrains Mono (data labels)
- [x] Create **CSS design tokens** file (`index.css` with `:root` variables):
  - Backgrounds: `#000000`, `#0A0A0A`, `#121212`
  - Text: `#FFFFFF`, `#BBBBBB`, `#666666`
  - Signal colors: Red `#FF3B3B`, Green `#00FF85`, Yellow `#FFC857`, Blue `#2CA8FF`
  - Typography scale: H1 (28–32px), H2 (22px), Body (14–16px), Micro (12px)
  - Borders: 1px subtle, low glow on hover, soft drop shadows
- [x] Build reusable **base components**:
  - `<Button>` (primary, ghost, CTA variants)
  - `<Badge>` (severity: HIGH/MEDIUM/LOW with signal colors)
  - `<Card>` (with hover glow border effect)
  - `<Modal>` (overlay with dark backdrop)
  - `<Tooltip>`
  - `<Skeleton>` (loading states)
  - `<LiveIndicator>` (green pulsing dot)

### 0.3 Backend & Infrastructure Scaffolding

- [x] Provision **Postgres** database (Neon or Supabase) — Schema defined in Drizzle ORM
- [x] Provision **Redis** (Upstash) for caching, rate limiting, hot state — Client + key patterns ready
- [x] Set up **Vercel** project for frontend + Edge/Serverless API functions — vercel.json + api/ routes
- [x] Define **OpenAPI spec** (proto-first contracts) for all endpoints — server/api/openapi.yaml
- [x] Set up **Auth** (Clerk or Auth0) with RBAC roles: Admin, Subscriber, Free User — Auth middleware + permissions
- [x] Set up **Stripe** for subscription billing ("Signal Clearance" tiers) — 3-tier config ready

---

## 🏗 Phase 1 — MVP Core (Priority Build)

> **TIP:** The Tech Doc recommends this build order: Event Feed → Map/Globe → Counters/Tension Index → Predictions → Realtime Relay → Subscriptions.

### 1.1 Global Layout Shell

- [x] Build the **3-panel layout** grid:
  - Left Panel: 22–25%
  - Center Globe: 45–50%
  - Right Panel: 25–30%
- [x] Implement **responsive breakpoints**:
  - ≥1280px → Full 3-panel
  - <1024px → Collapse right panel
  - <768px → Stacked mobile layout
- [x] Build the **Top Navigation Bar** (sticky, `#0A0A0A` background):
  - Logo (top-left)
  - Live counters (Active Conflicts, Tensions)
  - `LIVE` indicator (green pulse animation)
  - "Live View" button, "Predictions" button
  - "Subscribe" CTA, "Sign In"
  - Activity Pulse icon
- [x] Build the **scrolling news ticker** below nav:
  - Auto-scroll left
  - Pause on hover
  - Click → open event detail

### 1.2 Event Feed (Left Panel — "Pulse Feed")

- [ ] Create **Event Card** component with:
  - Title, Category Tag (HIGH/MEDIUM), Confidence %, Source, Timestamp, Country flag, Expand arrow
  - States: Default, Hover (border glow), Expanded (summary), Escalation (red), De-escalation (green)
- [ ] Build **Pulse Feed** list with virtualized scrolling (performance)
- [ ] Implement **Smart Digest** section (locked for free users)
- [ ] Build **filtering system**:
  - Tabs: High, Medium, 24H, Escalation, De-escalation
  - Search bar with keyword + country filtering
- [ ] Create **Event Detail Modal** (overlay):
  - Header: Country, Close button, Title
  - Metadata: Severity, Sentiment, Confidence %, Published timestamp, Region, 24H Activity
  - Summary paragraph
  - Sources list + Contradictions section
  - "Source" external link CTA

### 1.3 API — Events & Feed

- [ ] Create Postgres **`events` table**: `id, title, summary, region, lat, lng, severity, sentiment, confidence, created_at, source_refs[]`
- [ ] Create **`event_sources` table**: normalized sources + canonical URLs
- [ ] Build API endpoints:
  - `GET /events` (paginated, filterable by severity, region, date range)
  - `GET /events/{id}` (full detail with sources)
- [ ] Implement **Redis caching** for feed (`feed:latest:{variant}`)
- [ ] Set up **TanStack Query** on frontend for data fetching/caching

### 1.4 3D Globe Visualization (Center Panel)

- [ ] Integrate **MapLibre GL** with dark terrain map style
- [ ] Add **deck.gl layers**:
  - `ScatterplotLayer` for event markers
  - `IconLayer` for typed markers (Explosion=Red, Military=Blue, Economic=Yellow, Political=Cyan)
  - `HeatmapLayer` for conflict density
  - `ArcLayer` for movement/connection visualization
- [ ] Implement **marker interactions**:
  - Hover → tooltip
  - Click → open Event Detail Modal
- [ ] Enable **zoom in/out** and **auto-rotate** (slow)
- [ ] Implement **clustering** (server-side precluster or client-side supercluster)
- [ ] Add **progressive disclosure**: high-level markers at low zoom, detail layers at higher zoom
- [ ] Add **Military Aircraft Counter** overlay at bottom of globe
- [ ] Create `layers` table in Postgres: catalog of map layers and their data sources

### 1.5 Global Tension Index (Below Globe)

- [ ] Build **7-day line chart** using D3:
  - Thin line, subtle grid, no heavy chart chrome
  - Red/Green delta indicator
  - % change vs last week
  - Hover to inspect day values
  - Smooth animation transitions
- [ ] Create API endpoint for tension index data
- [ ] Store computed tension index in Redis (`counters:{variant}`)

### 1.6 Right Panel — Data Modules

- [ ] **Predictions Module**:
  - Card: Category icon, Vote count, Time remaining, Question, Probability %, trend line chart, Yes/No split bar
  - Click → full Prediction page
  - Locked state for unsubscribed users
- [ ] **Markets Module**:
  - Live indices: S&P 500, NASDAQ, Dow Jones, DAX
  - Each shows: Value, % change, Red/Green indicator
  - Refresh icon
- [ ] **Top Keywords (24H)**:
  - Ranked list with mention counts
  - Click → filter feed by keyword

---

## 🔮 Phase 2 — Predictions & Subscriptions

### 2.1 Predictions Full Page

- [ ] Create **Predictions page** layout:
  - Header: Title, Description, Active/Resolved tabs, Vote count, Countdown
  - Probability time-series chart (green for YES, thin axis grid, smooth animation)
  - Yes/No probability bar
  - Vote CTA
  - Subscription wall sidebar ("Signal Clearance Required")
- [ ] Build **Vote Interaction Flow**:
  - Not signed in → "Sign in to vote"
  - Signed in, not subscribed → Show subscription modal
  - Subscribed → Yes/No buttons → Confirmation modal → Update probability

### 2.2 Predictions Backend

- [ ] Create Postgres tables:
  - `predictions`: `id, question, description, category, closes_at, resolution_rules, status`
  - `prediction_votes`: `prediction_id, user_id, side, weight, created_at`
  - `prediction_snapshots`: computed probability timeline points
- [ ] Build API endpoints:
  - `GET /predictions` (list, filterable)
  - `GET /predictions/{id}` (detail with chart data)
  - `POST /predictions/{id}/vote` (auth + subscription gated)
- [ ] Implement **probability calculation**: weighted ratio YES/(YES+NO) (baseline)
- [ ] Store latest probability in Redis (`prediction:prob:{id}`)

### 2.3 Subscription System ("Signal Clearance")

- [ ] Integrate **Stripe** for subscription billing
- [ ] Design subscription tiers with feature gating
- [ ] Build **locked content pattern** UI:
  - Dark overlay + Red lock icon + CTA button + Pricing preview
  - No intrusive popups
- [ ] Implement subscription check middleware on gated API endpoints
- [ ] Create `subscriptions` table in Postgres

---

## ⚡ Phase 3 — Realtime & Ingestion

### 3.1 Realtime Relay Server

- [ ] Deploy **stateful WebSocket relay** (Fly.io or Railway)
- [ ] Implement WebSocket channels:
  - `global` (headline counters)
  - `region:{code}`
  - `prediction:{id}`
  - `layer:{layer_id}`
- [ ] Define **message envelope** format: `{ type, ts, payload }`
- [ ] Implement event types: `events:new`, `events:update`, `predictions:update`, `counters:update`
- [ ] Implement **security**: JWT auth for client WS, shared secret for server-to-relay
- [ ] Build **graceful degradation**: WS down → polling fallback

### 3.2 Ingestion Workers

- [ ] Build **RSS/News polling** worker
- [ ] Build curated **API connectors** (conflict data sources)
- [ ] (Optional) Build **Telegram/OSINT** channel pollers
- [ ] Implement **event deduplication** logic
- [ ] Fan-out ingested events to relay → subscribers

### 3.3 Frontend Realtime Integration

- [ ] Connect React app to WebSocket relay (`wss://relay.watchover.app`)
- [ ] Update Pulse Feed in real-time on `events:new`
- [ ] Update globe markers in real-time
- [ ] Update counters (Active Conflicts, Tensions, Aircraft) with **increment animations**
- [ ] Update prediction probabilities live

---

## 🧠 Phase 4 — AI & Analytics

### 4.1 Smart Digest / AI Summarization

- [ ] Integrate pluggable AI provider (with fallback chain)
- [ ] Generate daily **Smart Digest** summaries
- [ ] Cache AI results in Redis (`cache:ai:brief:{date}:{variant}`)
- [ ] Gate Smart Digest behind subscription

### 4.2 Analytics & Reporting

- [ ] Build **analytics dashboard** with charts (D3):
  - Conflict volume by region
  - Conflict type distribution
  - Resolution time trends
  - Escalation rate
  - Heat map by region
- [ ] Implement **date range filtering** (7d, 30d, 90d, custom)
- [ ] Add **export** to CSV/PDF
- [ ] Enforce **role-based visibility** on analytics

---

## 🔐 Phase 5 — Security, Quality & Polish

### 5.1 Security & Abuse Controls

- [ ] Implement **rate limiting** (Upstash Ratelimit) on API + WS connections
- [ ] Implement **input sanitization** (DOMPurify)
- [ ] Enforce **RBAC** server-side on all endpoints
- [ ] Build **audit log** system for all moderator/editor actions (`audit_logs` table)
- [ ] Ensure HTTPS everywhere, data encryption at rest

### 5.2 Notifications System

- [ ] Build **in-app notifications** with real-time badge indicator
- [ ] Implement notification triggers:
  - New event in watched region
  - Prediction status changed
  - SLA breach (if case management features included)
- [ ] Add notification preferences per user
- [ ] Mark as read functionality

### 5.3 Micro-Interactions & Polish

- [ ] Implement **live pulse animation** on LIVE indicator
- [ ] Add **counter increment animations** (number tick-up effect)
- [ ] Add **marker glow effects** on globe
- [ ] Ensure **chart smooth transitions** on data updates
- [ ] Add **subtle hover highlights** on all interactive elements
- [ ] Verify: No bouncy animations — linear, subtle, professional motion only

### 5.4 Accessibility

- [ ] Verify **color + icon** (never color alone for meaning)
- [ ] Ensure **keyboard navigation** for all interactive elements
- [ ] Test **tooltip readability**
- [ ] Validate **contrast ≥ WCAG AA** on all text
- [ ] Add **visible focus states**
- [ ] Add **screen reader support**

### 5.5 Performance Optimization

- [ ] Ensure **globe renders at 60fps**
- [ ] **Lazy load** right panel data
- [ ] **Virtualize** feed list (already in Phase 1, verify)
- [ ] **Debounce** search input
- [ ] Verify **page load < 2.5s**, **API P95 < 300ms**

### 5.6 Testing

- [ ] Write **Playwright e2e tests** for critical flows
- [ ] Write **contract tests** for API endpoints
- [ ] Run **load tests** on WebSocket fanout endpoints
- [ ] Perform **visual regression testing**

---

## 🚀 Phase 6 — Deployment & Launch

### 6.1 Production Deployment

- [ ] Deploy frontend + API to **Vercel**
- [ ] Deploy relay server to **Railway** or **Fly.io**
- [ ] Provision production **Postgres** (Neon/Supabase)
- [ ] Provision production **Redis** (Upstash)
- [ ] Set up **object storage** (S3/R2) for media/thumbnails/reports
- [ ] Configure **Sentry** (frontend + backend error monitoring)
- [ ] Set up **structured logging** on relay + ingestion workers
- [ ] Configure **metrics dashboards**: WS clients, fanout rate, ingestion lag, cache hit ratio, P95 API times

### 6.2 Optional: Desktop App

- [ ] Wrap web app with **Tauri v2** for cross-platform desktop distribution
- [ ] Test on Windows, macOS, Linux

---

## 🔮 Phase 7 — Future Extensions

- [ ] AI-generated insights panel
- [ ] Risk heatmap overlay
- [ ] Personalized alert dashboard
- [ ] Multi-globe region split view
- [ ] Time-travel mode (replay historical events)
- [ ] Conflict risk prediction (ML model)
- [ ] Sentiment analysis on ingested content
- [ ] Slack/Teams integration for notifications
- [ ] Multi-language localization (i18next)
- [ ] Advanced probability model (log-odds + liquidity curve)

---

> **Total estimated phases:** 7 (0–6 for launch, 7 for future).
> **Recommended MVP scope (Phases 0–1):** Project setup, design system, event feed, globe, tension index, and right panel modules.
> **First user-facing milestone:** A working dashboard with live event feed + interactive globe + static data panels.
