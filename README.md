# FPY Dashboard (React + Supabase)

## 1) Install dependencies
```bash
npm install
```

## 2) Configure environment (optional for local-only mode)
Copy `.env.example` to `.env` and set values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> Important: Do **not** use your Postgres password in frontend env vars.
> Frontend must use the Supabase **Anon key** only.
> If `.env` is missing, the app still works in **Local Fallback** mode using browser storage.

## 3) Create database table
Run SQL from `sql/schema.sql` in Supabase SQL Editor.

## 4) Start app
```bash
npm run dev
```

## Notes
- Your provided connection string is suitable for server-side tools/backends, not browser code.
- If your DB password was shared publicly, rotate it in Supabase immediately.
- Legacy file remains available: `FPY_Dashboard.html`.
- The UI now shows current mode: `Supabase` or `Local Fallback`.
