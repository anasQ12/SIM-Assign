# Station SIM/IP Assignment System

A simple web app to replace the Excel/email handover between Station Admins and SCADA for assigning SIM cards and IP addresses to stations.

No server to run, no `npm install` needed for the frontend — just plain HTML/CSS/JS files that talk directly to a free Supabase database.

---

## How it works

1. **Station Admin** creates a request and adds stations one at a time: type the EQ Number, pick a Type (Smart RMU or Smart OH) from a dropdown, and click Check — the system checks that exact EQ Number + Type combination against the registry (the same EQ Number is allowed twice if the Type differs). If it's already registered, an error blocks it; if not, fill in Vendor, Modem, and optional location info (X/Y coordinates, a location URL) and add it. On submit, every new station is also registered in the master list automatically.
2. **SCADA** opens the request and manually types in a SIM Serial Number and IP Address for each station — the IP gets checked against the IP registry first, and a duplicate is blocked with an error.
3. **Station Admin or Super Admin** can export the complete data to Excel at any time.
4. **Super Admin** can bulk-upload stations and IPs into their respective registries via CSV ahead of time, and browse the full station registry in the Stations Master List page.
5. Every action is recorded in the Audit Log.

---

## One-time setup (about 10 minutes)

### Step 1 — Create a free Supabase account

Go to supabase.com and sign up.

### Step 2 — Create a new project

Click **New Project**, give it a name, set a database password, pick a region, and create it.

### Step 3 — Run the database schema

- In your Supabase project, click **SQL Editor** → **New query**
- Open `supabase_schema.sql` from this project, copy all of it, paste into the SQL editor
- Click **Run**
- Confirm under **Table Editor** that you see 6 tables: `app_users`, `stations_master`, `ip_registry`, `station_requests`, `request_stations`, `audit_logs`

### Step 4 — Get your API credentials

- **Project Settings** (gear icon) → **API Keys**
- Click the **Legacy anon, service_role API keys** tab
- Copy the **Project URL** (from General settings) and the **anon public** key (the long `eyJ...` one — not the newer `sb_publishable_...` format, which can have compatibility issues with some client library versions)

### Step 5 — Fill in your config

Open `js/config.js`, paste in your Project URL and anon key, save.

### Step 6 — Deploy the create-user Edge Function

- **Edge Functions** → **Create a new function** → name it exactly `create-user`
- Paste in the contents of `supabase/functions/create-user/index.ts`
- Click **Deploy**
- Go to that function's **Settings** tab and turn **OFF** "Verify JWT with legacy secret", then save

### Step 7 — Grant table permissions

RLS policies alone aren't enough — Postgres also needs explicit grants. In **SQL Editor**, run:

```sql
grant usage on schema public to service_role, authenticated, anon;

grant all on public.app_users to service_role;
grant all on public.stations_master to service_role;
grant all on public.ip_registry to service_role;
grant all on public.station_requests to service_role;
grant all on public.request_stations to service_role;
grant all on public.audit_logs to service_role;

grant select, insert, update, delete on public.app_users to authenticated;
grant select, insert, update, delete on public.stations_master to authenticated;
grant select, insert, update, delete on public.ip_registry to authenticated;
grant select, insert, update, delete on public.station_requests to authenticated;
grant select, insert, update, delete on public.request_stations to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;
```

(This is already included at the bottom of `supabase_schema.sql`, so if you ran that fully you can skip this step — it's here in case you need to re-run it after any table changes.)

### Step 8 — Create your first Super Admin (one-time manual step)

The create-user function requires an *existing* Super Admin to call it, so the first one is created by hand:

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. Email: `100000@stationapp.local` (use any 6-digit number as your payroll number)
3. Password: set one you'll remember, check **Auto Confirm User**
4. Click **Create user**, then copy the **User UID** shown
5. **Table Editor** → `app_users` → **Insert row**:
   - `id` → paste the User UID
   - `payroll_no` → `100000`
   - `name` → your name
   - `role` → `SUPER_ADMIN`
   - `is_active` → `true`
6. Save

You can now log in with payroll `100000` and that password, then use the **Users** page to create everyone else properly.

---

## Hosting it (GitHub Pages — free)

1. Create a GitHub repo and upload all the files in this project (everything inside this folder, not the folder itself)
2. Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save
3. Wait a minute, then your site is live at `https://yourusername.github.io/your-repo-name/login.html`

---

## First-time walkthrough

1. Open `login.html`, sign in with payroll `100000` and your password
2. **Users** → create a Station Admin and a SCADA user with passwords
3. (Optional) **Upload Stations CSV** and **Upload IPs CSV** → pre-load known stations and IPs into the registries
4. Sign out, sign in as the Station Admin
5. **New Request** → enter an EQ Number, pick a Type → click **Check** → if available, fill in Vendor, Modem, and optional X/Y/Location → **Add to Request** → repeat for more stations → **Submit Request**
6. Sign out, sign in as the SCADA user
7. **Requests Queue** → open the new request → click **Assign SIM/IP** on each station → type in Serial Number and IP (a duplicate IP gets blocked with an error) → **Assign**
8. Click **Complete Request**
9. Sign in as Station Admin or Super Admin, open the request, click **Export Current Data** / **Download Final Excel**
10. Check **Audit Log** to see every step recorded, or **Stations Master List** to see the growing registry

---

## Project structure

```
station-sim-app/
├── index.html              redirects to login
├── login.html               payroll number + password sign in
├── redirect.html            routes you to the right home page based on role
├── dashboard.html           KPI overview (Super Admin)
├── new-request.html         create a request, add stations one at a time (Station Admin)
├── upload-stations.html     bulk-upload stations into the registry via CSV (Super Admin)
├── upload-ips.html          bulk-upload IP addresses into the registry via CSV (Super Admin)
├── stations-master.html     read-only view of the full station registry (Super Admin)
├── requests.html            list of requests (all roles, filtered by role)
├── assign.html               manually assign SIM Serial No + IP (SCADA)
├── request-detail.html      view request + export Excel (all roles)
├── users.html                manage users (Super Admin)
├── audit-log.html            view all logged actions (Super Admin, SCADA)
├── css/styles.css            all styling, including responsive/mobile layout
├── js/
│   ├── config.js             YOUR Supabase credentials go here
│   ├── auth.js                session management
│   ├── data.js                all database queries
│   ├── csv.js                  CSV parsing
│   ├── sidebar.js             role-based navigation + mobile menu
│   └── toast.js                notifications
├── supabase/functions/create-user/index.ts   Edge Function for secure user creation
└── supabase_schema.sql        run this once in Supabase SQL Editor
```

---

## Notes on the station registry

The `stations_master` table is the single source of truth for "does this station already exist." Uniqueness is on the EQ Number + Type combination — the same EQ Number is allowed twice if the Type differs (Smart RMU vs Smart OH), since that reflects two genuinely different pieces of equipment at the same location. It grows two ways: Super Admin can bulk-upload it via CSV ahead of time, and every station added through a request gets automatically registered the moment the request is submitted.

## Notes on the IP registry

The `ip_registry` table works the same way but for IP addresses: Super Admin can bulk-upload known IPs via CSV, and every IP assigned through the Assign SIM/IP screen gets automatically registered too. When SCADA tries to assign an IP that's already in this registry, they get blocked with an error before the assignment goes through.

## Notes on the login system

Login uses real payroll number + password via Supabase Auth — passwords are properly hashed and sessions are managed securely. Your payroll number is turned into a fake-but-valid email like `123456@stationapp.local` behind the scenes (Supabase Auth requires an email format); you never see or type that.

Only Super Admin can create new users (via the Users page), through a secure server-side function so the admin key never touches the browser. There's no self-service password reset — Super Admin resets it manually via Supabase's dashboard if needed.

---

## Troubleshooting

**"permission denied for table ..." in any error message**: you're missing a GRANT — re-run the grant statements from Step 7 above.

**403 Forbidden calling the create-user function**: check that "Verify JWT with legacy secret" is OFF in that function's Settings tab, and that the function's slug (in its URL) is exactly `create-user`.

**Blank page / nothing loads**: you're probably opening the file directly (`file://...`) instead of through GitHub Pages or a local server.

**"Failed to fetch" when adding a user**: usually a CORS/deployment issue with the Edge Function — check the function is deployed, named correctly, and JWT verification is off.
