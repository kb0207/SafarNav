# Publish SafarNav

The app is ready for a presentation deployment after configuring the variables below. Local build and automated checks do not replace testing your deployed provider accounts and physical phone. Local environment files are not uploaded by Git; `.env.example` is a credential-free template.

## GitHub

Create an empty `safarnav` repository on GitHub, without an initial README or .gitignore. Then:

```bash
cd "/Users/karanbhura/CODING/VIHAAN X 9.0"
git init
git branch -M main
git add .
git status --short
git check-ignore .env.local
```

Confirm `.env.local` is ignored and isn't staged. Keep `.env.example` secret values blank. If credentials were previously shared publicly, rotate them at the provider before deployment.

```bash
git commit -m "Build SafarNav route planner"
git remote add origin https://github.com/YOUR_USERNAME/safarnav.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Authenticate through GitHub's credential flow if prompted; your normal account password is not a Git HTTPS credential.

## Vercel

1. Sign in at https://vercel.com and choose Add New → Project.
2. Import the GitHub repository. Use Next.js, repository root, `npm ci` to install and `npm run build` to build. Leave output directory at the framework default. Use a supported Node version of at least 22 (24.x is appropriate when offered).
3. Add these environment variables for Production (also Preview if you want preview deployments):

| Variable | Value |
| --- | --- |
| `DEMO_MODE` | `false` for real places/routes |
| `SESSION_SECRET` | A private random secret; generate with `openssl rand -hex 32` |
| `ORS_API_KEY` | Your openrouteservice key |
| `GEOCODING_API_KEY` | Your Geoapify key |
| `GEMINI_API_KEY` | Your Gemini key; optional, computed summary works without it or on failure |
| `GEMINI_MODEL` | `gemini-2.5-flash`, or an available compatible model for your account |
| `NEXT_PUBLIC_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/positron` |
| `DATABASE_URL` | Optional Neon pooled URL; required to save real feedback |

Provider URLs and `INFRASTRUCTURE_FALLBACK=geoapify` have defaults. `NEXT_PUBLIC_MAP_API_KEY` can remain empty. Never prefix private service keys with `NEXT_PUBLIC_`.

4. Deploy. When the Production URL is available, set `NEXT_PUBLIC_SITE_URL` to that HTTPS URL and redeploy. Environment-variable changes apply to subsequent deployments.
5. If using Neon, apply the supplied SQL migration manually (or configure the migration connection and run `npm run db:migrate`) before testing feedback. Route planning and summaries work without the database; real feedback saving does not.
6. Open the production URL on your phone. For judges, check that the production deployment is accessible in a private browser without your Vercel login; adjust Deployment Protection if required.

## Check on the phone

- Search two Delhi/NCR destinations and compare routes; Driving starts selected.
- View Summary. A successful Gemini response is labelled GEMINI EXPLANATION; otherwise the computed summary is shown.
- Test light/dark journey buttons, allow location and optionally notifications, and keep SafarNav in the foreground during monitoring.
- Alerts target upcoming sections strictly below 30/100 within 250 m, require accurate on-route GPS and are sent once per section per journey. Browser notification support varies; on-screen alerts remain available. This is not a background push-navigation service.
- Open selected route + waypoint in Google Maps and check the directions preview. Google recalculates between stops and cannot be forced to preserve every road segment. The waypoint is a route-shaping road coordinate, not a verified place to park or stop. Demo routes do not open a real Google Maps handoff.
- Physical iPhone/Android behavior and live Gemini/key quotas still require this device/account check.

## Later updates

```bash
git add .
git commit -m "Update SafarNav"
git push
```

Vercel builds a new deployment from pushes to the connected production branch.

References: [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), [environment variables](https://vercel.com/docs/environment-variables), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
