# Original Tube — full-stack starter

A branded video-sharing web app starter using Next.js + Supabase. The responsive web UI can be installed on Android as a home-screen web app (PWA-style use); a native Play Store app is a separate build step.

## Included
- Email/password sign-up and sign-in
- Shared public video feed and category/search filtering
- Upload video and optional thumbnail to Supabase Storage
- Video playback, comments, likes and subscribe/unsubscribe actions
- PostgreSQL schema, trigger-created profiles, Row Level Security and storage policies
- Responsive mobile layout

## Setup
1. Create a project at https://supabase.com/.
2. In Supabase **SQL Editor**, run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and anon/public key. Do not use the service-role secret in browser code.
4. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
5. Install Node.js 20+ and run:
   ```
   npm install
   npm run dev
   ```
6. Open http://localhost:3000.
7. For public access, deploy the project to Vercel or another Next.js host and set the same environment variables in its project settings. Add the deployed URL to Supabase Auth's allowed redirect URLs.

## Important production limitations
This is a functional starter, not a hosted production service. The project owner must create the Supabase project and hosting account and deploy it. Storage is configured for public video delivery and currently uses standard uploads capped at 500 MB in the UI; use resumable uploads (TUS), transcoding/HLS, CDN, rate limits, quotas, content reporting/moderation, copyright takedown flow, backups and monitoring before opening it to the public. Storage/bandwidth can incur costs. Enable email confirmation and configure SMTP before real public launch.

## Android
The responsive site works in Android Chrome. For a quick app-like experience, open the deployed site in Chrome and choose **Add to Home screen**. To publish a native Android package, wrap the deployed site with Capacitor or build a native client, then test signing, permissions and Play Store policies. This starter does not include a signed APK.

## Feature notes
- The subscriptions table is wired for follow/unfollow, but a personalized subscription feed is not yet implemented.
- Watch history, video analytics, creator dashboards, reporting/moderation and transcoding are not yet included.
- Keep the Supabase anon key public by design, and rely on RLS; never ship the service-role key to the client.
