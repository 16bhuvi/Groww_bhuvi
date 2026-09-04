# Groww — Smart Market Watchlist

A high-performance, intelligent stock market watchlist application built to answer one critical question: **"What meaningfully changed since I last checked?"**

Instead of overwhelming traders with flat ticker lists and raw price movements, Groww tracks each user's personalized `last_seen` baseline and calculates an **explainable, multi-signal attention score** for every asset.

---

## 🌟 Key Highlights & Features

### 1. Explainable Attention Scoring Engine
Every stock is continuously evaluated against user-specific state baselines across multiple market dimensions:
- **Price Delta & Volatility**: Tracks percentage price departure since the user's prior session.
- **Volume Anomalies**: Identifies abnormal trading volume surges relative to standard 20-day averages.
- **Technical Indicators**: Detects critical technical triggers including RSI momentum swings (<30 oversold, >70 overbought) and 50/200 DMA trend crossovers (Golden Cross / Death Cross).
- **Corporate Actions**: Surfacing upcoming earnings releases, dividend ex-dates, bonus issues, and AGM schedules.
- **Sentiment & News**: Evaluates incoming news articles and analyst updates with intelligent caching and circuit breakers.

### 2. Personalized "Since You Last Checked" State Baselines
- Automatically preserves the exact price, volume, technical indicators, and acknowledged event IDs at the moment of viewing.
- Single-click **"Acknowledge Changes"** updates the user's checkpoint baseline, dynamically resetting attention scores and highlighting only newly emerging catalysts.

### 3. Market Simulator & Stress Testing Lab
- Interactive simulation modal allowing traders and developers to simulate:
  - Custom percentage price shocks (e.g. +5.5% gap up, -4.2% drop).
  - Out-of-order data ingestion tests.
  - Market status overrides (forcing open/closed trading sessions).
  - Simulated corporate action disclosures.

### 4. Resilient Architecture & Circuit Breaking
- **High-speed Local SQLite Database**: In-memory and persisted SQLite database with predefined seeds for top Indian equities (NSE/BSE: RELIANCE, TCS, INFY, HDFCBANK, TATAMOTORS, etc.).
- **Smart News Provider**: Fallback pipeline with automated circuit breakers to protect against external API rate limits or network aborts.
- **Concurrent Analysis**: Multi-ticker evaluations run concurrently via `Promise.all`, providing response times under 400ms.

### 5. Modern Editorial Design System
- High-contrast, scannable layout with Groww-inspired accents (`#00D09C`).
- Responsive 8:4 desktop grid with watchlist telemetry, market insight briefs, and quick-filter pills.
- Progressive Web App (PWA) ready with offline caching and service worker registration.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Motion (`motion/react`), Recharts, Lucide React
- **Backend**: Node.js, Express 4, TypeScript (`tsx`), SQLite (`sql.js`), esbuild
- **Security & Authentication**: JSON Web Tokens (`jsonwebtoken`), password hashing (`bcryptjs`)
- **Testing**: Vitest (`tests/changeEngine.test.ts`, `tests/dataIntegrity.test.ts`)
- **PWA**: `vite-plugin-pwa` with manifest and service worker integration

---

## 🔒 Authentication & JWT Security

The application supports secure, token-based authentication using **JSON Web Tokens (JWT)**:

- **JWT Signing & Verification**: Signed using `JWT_SECRET` with configurable token lifetime (default 7 days).
- **Bearer Token Authorization**: Protected endpoints extract and verify user identity via the standard `Authorization: Bearer <token>` HTTP header.
- **Graceful Session Fallback**: If no token is provided, requests seamlessly fallback to the active demo investor session (`user_demo_1`), ensuring frictionless evaluation without blocking exploratory UI interactions.
- **Default Demo Credentials**:
  - **Email**: `demo@groww.in`
  - **Password**: `Demo1234!`

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (recommended v22+)
- npm 10+

### Installation
```bash
# Clone the repository and install dependencies
npm install
```

### Development Mode
Runs the backend Express server with Vite middleware on port 3000:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Running Tests
Execute the Vitest suite covering the deterministic change engine and out-of-order data resilience:
```bash
npm test
```

### Production Build & Launch
```bash
# Build Vite client assets and compile backend bundle
npm run build

# Start the standalone production server
npm start
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` if configuring optional external services or custom secrets:

```env
# JWT_SECRET: Secret key for signing and verifying JWT tokens
JWT_SECRET="groww_market_watchlist_jwt_secret_key_2025"

# Optional: SerpAPI key for live Google News search
SERPAPI_API_KEY=

# Optional: Google Gemini API key for automated AI summaries (handled server-side)
GEMINI_API_KEY=

# PORT: Dev server port (binds to port 3000)
PORT=3000
```

*Note: The application includes smart fallback providers and local SQLite storage out of the box if no external API keys are configured.*

---

## 📡 Key API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate with email & password, returns JWT token |
| `POST` | `/api/auth/register` | Create a new user account, returns JWT token & default watchlist |
| `GET` | `/api/auth/me` | Fetch active profile from JWT Bearer token or demo session |

### Market & Watchlist
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check and current server timestamp |
| `GET` | `/api/market/status` | Current market trading status (NSE/BSE) |
| `POST` | `/api/market/status/override` | Set simulator override for market status |
| `GET` | `/api/market/indices` | Overview of benchmark indices (Nifty 50, Sensex) |
| `GET` | `/api/watchlist` | Full watchlist analysis with attention scores and deltas |
| `GET` | `/api/stocks/:symbol` | Detailed stock analysis, technicals, chart, and news |
| `POST` | `/api/stocks/:stockId/mark-seen` | Update user baseline checkpoint for a stock |
| `POST` | `/api/watchlist/:id/mark-seen` | Acknowledge all stocks in a watchlist |
| `GET` | `/api/watchlist/all` | Get user's created watchlists |
| `POST` | `/api/watchlist` | Create a new user watchlist |
| `POST` | `/api/watchlist/:id/stocks` | Add a stock to an active watchlist |
| `DELETE` | `/api/watchlist/:id/stocks/:stockId` | Remove a stock from an active watchlist |
| `POST` | `/api/simulation/trigger` | Trigger simulation scenarios (price plunges, breakouts, conflicts) |

---

## 🧪 Testing & Verification

The project includes an automated test suite verifying:
1. **Deterministic Attention Scoring**: Accurate weighting of individual score components (price deltas, volume spikes, technical crossovers, corporate actions).
2. **Data Integrity & Out-of-Order Ingestion**: Verification that outdated or unordered market ticks do not corrupt `last_seen` baselines or generate false anomaly alerts.

Run tests anytime with:
```bash
npm test
```
