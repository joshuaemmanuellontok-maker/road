# Supabase Setup for KalsadaKonek Backend

## 1. Create Supabase Project
1. Open your Supabase dashboard.
2. Create a new project.
3. Wait until the project is ready.

## 2. Set up the database schema
1. In Supabase, open the SQL Editor.
2. Copy the contents of `supabase/sql/roadresq_schema.psql`.
3. Run the script.
4. Copy the contents of `supabase/sql/roadresq_seed.psql` and run it too.

## 3. Update `backend/.env`
1. Open `backend/.env`.
2. Replace the placeholder `DATABASE_URL` with your Supabase connection string.
   - Example: `postgresql://postgres:MY_PASSWORD@YOUR_PROJECT_REF.supabase.co:5432/postgres`
3. Save the file.

## 4. Verify connection
From `backend/`, run:

```bash
node test_supabase.js
```

If successful, the backend can now connect to your Supabase database.

## 5. Deploy backend and mobile app
- Deploy backend to a host (Railway, Vercel, Fly.io, etc.)
- Set the deployed backend URL in `mobile/.env`:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com/api
```

- Rebuild your APK once the backend URL is correct.

## 6. Real user testing
- Start the backend connected to Supabase.
- Open the app on the motorist device and the agent device.
- Both devices should now share the same data and see the same rescue requests.
