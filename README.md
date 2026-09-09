# DevCall frontend

DevCall is a browser-based group calling room with WebRTC audio/video, screen sharing, real-time chat, participant status, responsive UI and a Socket.IO signaling channel.

## Run locally

1. Start the signaling service in `../backend`:

   ```bash
   npm install
   npm run dev
   ```

2. Install and start this app:

   ```bash
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`, create a room, and open the invite in a second browser/device.

Camera, microphone, and screen-picker permission are requested by the browser only when a person joins or shares.

## Supabase

`src/lib/supabase.js` stores room metadata and chat records when Supabase is configured. Live media never travels through Supabase: WebRTC carries media directly between peers and Socket.IO handles signaling.

1. Copy `.env.example` to `.env.local` and set the project URL plus publishable key.
2. Apply `../supabase/migrations/20260909_devcall.sql` in the Supabase SQL Editor.
3. In Supabase Authentication > Sign In / Providers, enable **Anonymous Sign-Ins**. This gives guest callers an RLS-scoped identity without a sign-up form.

The app deliberately keeps working if Supabase is temporarily unavailable; calls and live chat remain active through the signaling service.

## Production checklist

- Host the frontend over HTTPS. Browsers block camera/microphone access on ordinary HTTP pages.
- Deploy `backend` as a long-running Node service (Vercel static hosting alone cannot run Socket.IO).
- Set `VITE_SIGNALING_URL` to that service's HTTPS address before the frontend build.
- Set the matching `FRONTEND_URLS` on the backend.
- Configure a TURN server and set `TURN_URLS`/`TURN_SHARED_SECRET`; STUN alone will not connect every corporate/mobile network.
- Do not expose a Supabase service-role key in a Vite environment variable.
