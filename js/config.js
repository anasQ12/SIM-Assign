// config.js
// ============================================================================
// FILL IN YOUR SUPABASE CREDENTIALS HERE
// ============================================================================
// 1. Go to your Supabase project
// 2. Click "Project Settings" (gear icon) → "API"
// 3. Copy "Project URL" and paste below as SUPABASE_URL
// 4. Copy "anon public" key and paste below as SUPABASE_ANON_KEY
// ============================================================================

const SUPABASE_URL = "https://nbhewigvmzbziomyysiy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iaGV3aWd2bXpiemlvbXl5c2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjA4MDYsImV4cCI6MjA5NzE5NjgwNn0.F0iQ0cNOgcsIXiPgNZ10V0cH75_85kteWTJDQ97D8og";

// Used to build a fake-but-valid email behind the scenes from a payroll
// number, since Supabase Auth requires an email format. Users never see
// or type this — they only ever use their 6-digit payroll number.
const PAYROLL_EMAIL_DOMAIN = "stationapp.local";

// Initialize the Supabase client (used by every page)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The create-user Edge Function lives at this URL automatically once deployed
const CREATE_USER_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-user`;
