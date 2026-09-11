# Budget Finder

Shopify custom app that recommends products by a shopper’s **min–max budget**, with **Add to cart** on the storefront.

Built with the official **React Router** Shopify app template + a Theme App Extension.

## Features

- Storefront **Budget Finder** app block (category chips + budget slider)
- App proxy API: `/apps/budget-finder/recommend?min=&max=`
- Returns products ranked for the budget with a one-line reason + `variantId` for cart
- Optional OpenAI re-ranking when `OPENAI_API_KEY` is set (falls back to budget-fit heuristics)
- **Add to cart** via `/cart/add.js`
- Admin settings: results limit + in-stock only

## Prerequisites

- Node.js 20.19+ or 22.12+
- Shopify Partner account + development store
- Shopify CLI (`shopify version` should work)
- (Optional) OpenAI API key for smarter ranking/reasons

## Setup

```bash
cd C:\Users\Loyyy\budget-finder
npm install
npx prisma migrate dev
```

Link the project to a Shopify app (interactive — run in your own terminal):

```bash
shopify app config link
# or create/link during:
shopify app dev
```

### Optional: enable AI ranking

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add it to `.env` (Shopify CLI creates this file; or copy from `.env.example`):

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

3. Restart `shopify app dev` so the key loads
4. On the storefront, run a recommendation with **2+ products**
5. Check the API response includes `"ranking":"ai"` and product cards show short AI reasons
6. In the terminal you should see: `[budget-finder ai] re-ranked …`

Without a key, ranking stays on fast local heuristics (`"ranking":"budget-fit"`) — the app still works.

Then:

```bash
shopify app dev
```

1. Install the app on your development store when prompted
2. Online Store → Themes → Customize → add **Budget Finder** block
3. Enter a budget range and test **Add to cart**

## Project layout

- `app/routes/app._index.tsx` — admin home
- `app/routes/app.settings.tsx` — merchant settings
- `app/routes/apps.budget-finder.recommend.tsx` — app proxy recommend API
- `app/services/recommend.server.ts` — price-range product query
- `app/services/ranking.server.ts` — budget-fit + optional OpenAI re-rank
- `extensions/budget-finder/` — theme app extension (block + JS/CSS)

## Scopes

`read_products,write_products,write_app_proxy` (cart uses the storefront Cart Ajax API).

## Production hosting (Railway)

The app needs an always-on HTTPS URL so the storefront app proxy works without `shopify app dev`.

### 1. GitHub

Repo: `https://github.com/jankaloygalarza-alt/budget-finder` (latest `main` includes `railway.toml`).

### 2. Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → select `budget-finder`
3. Railway uses `railway.toml` + `Dockerfile`

### 3. Add Postgres

1. Same project → **New** → **Database** → **PostgreSQL**
2. Web service → **Variables** → add reference:
   - `DATABASE_URL` = Postgres `DATABASE_URL`

### 4. Set secrets (web service Variables)

| Key | Value |
|-----|--------|
| `SHOPIFY_API_KEY` | from `shopify app env show` |
| `SHOPIFY_API_SECRET` | from `shopify app env show` |
| `SCOPES` | `read_products,write_products,write_app_proxy` |
| `SHOPIFY_APP_URL` | your Railway HTTPS domain |
| `OPENAI_API_KEY` | optional |
| `OPENAI_MODEL` | `gpt-4o-mini` (optional) |

### 5. Public URL

1. Web service → **Settings** → **Networking** → **Generate Domain**
2. Put that URL in `SHOPIFY_APP_URL` and redeploy if needed
3. Open `/health` — should return `ok`

### 6. Point Shopify at Railway

Update `shopify.app.toml` `application_url` + `redirect_urls`, then:

```bash
shopify app deploy --allow-updates
```

Re-open the app once in Admin on each shop so sessions are created in Postgres.

### Local note

Production uses **Postgres** (`DATABASE_URL`). Local `shopify app dev` also needs a Postgres URL (Neon, or Railway’s public DB URL).