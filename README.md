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

## Production hosting (Render)

The app needs a **always-on HTTPS URL** so the storefront app proxy works without `shopify app dev`.

### 1. Database (Postgres)

Production hosting cannot use SQLite. Use **either**:

**A. Neon (no Docker — recommended on Windows)**  
1. Create a free DB at [neon.tech](https://neon.tech)  
2. Put the connection string in `.env`:

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
```

3. Run:

```bash
npx prisma migrate deploy
```

**B. Docker Compose** (if Docker Desktop is installed)

```bash
docker compose up -d
# DATABASE_URL=postgresql://budget:budget@localhost:5432/budget_finder
npx prisma migrate deploy
```
### 2. Push code to GitHub

Create a GitHub repo for this project and push `main` (do not commit `.env`).

### 3. Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect the GitHub repo (this project includes `render.yaml`)
3. Create the services (web + Postgres)
4. Set these **secret** env vars on the web service:

| Key | Value |
|-----|--------|
| `SHOPIFY_API_KEY` | from `shopify app env show` |
| `SHOPIFY_API_SECRET` | from `shopify app env show` |
| `SHOPIFY_APP_URL` | your Render URL, e.g. `https://budget-finder.onrender.com` |
| `OPENAI_API_KEY` | optional |

`DATABASE_URL` is wired automatically from the Render Postgres instance.

5. After the first deploy succeeds, open `/health` — it should return `ok`.

### 4. Point Shopify at Render

Update `shopify.app.toml` `application_url` + `redirect_urls` to your Render URL, then:

```bash
shopify app deploy --allow-updates
```

Re-open the app once in Admin on each shop so sessions are created in Postgres.

### Notes

- Keep `shopify app dev` only for local coding; production storefront traffic should hit Render.
- Free Render web services may sleep — for a live storefront, use a paid/always-on plan.
- If the Render service name differs, change `SHOPIFY_APP_URL` and `shopify.app.toml` to match.