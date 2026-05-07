# BM Core Supabase Setup

1. Open Supabase Dashboard > Project Settings > API.
2. Copy the `anon public` key.
3. Open `app.js` and replace:
   `PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE`
4. Open Supabase Dashboard > SQL Editor.
5. Run `supabase_setup.sql` once.
6. Deploy the folder to Netlify.

Default login after setup:

- Username: `admin`
- Password: `123456`

Your Supabase URL is already added:
`https://pmetszycofwhgqbpzcby.supabase.co`
