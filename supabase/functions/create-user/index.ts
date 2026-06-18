// supabase/functions/create-user/index.ts
//
// This Edge Function lets a Super Admin create a new agent (payroll number,
// name, role, password) without ever exposing the Supabase service_role key
// to the browser. The key lives only here, on Supabase's server.
//
// HOW TO DEPLOY THIS (one-time):
// 1. In your Supabase project, go to "Edge Functions" in the left sidebar
// 2. Click "Create a new function"
// 3. Name it exactly: create-user
// 4. Delete the placeholder code and paste this entire file
// 5. Click "Deploy"
// That's it — no command line needed.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYROLL_EMAIL_DOMAIN = 'stationapp.local';

Deno.serve(async (req) => {
  // Allow the browser to call this (CORS)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { payrollNo, name, role, password, requestingUserId } = await req.json();

    if (!payrollNo || !name || !role || !password || !requestingUserId) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!/^\d{6}$/.test(payrollNo)) {
      return new Response(JSON.stringify({ error: 'Payroll number must be exactly 6 digits.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validRoles = ['SUPER_ADMIN', 'STN_ADMIN', 'STN_SCADA'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // This client uses the SERVICE ROLE key, which has full admin rights.
    // It's only available as an environment variable inside the Edge Function
    // runtime — never sent to or readable by the browser.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('DEBUG requestingUserId:', requestingUserId);

    // Verify the requesting user is actually a SUPER_ADMIN before allowing this
    const { data: requestingProfile, error: profileError } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', requestingUserId)
      .single();

    console.log('DEBUG requestingProfile:', JSON.stringify(requestingProfile));
    console.log('DEBUG profileError:', JSON.stringify(profileError));

    if (profileError || !requestingProfile || requestingProfile.role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({
        error: 'Only Super Admin can create users.',
        debug: { requestingUserId, requestingProfile, profileError },
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fakeEmail = `${payrollNo}@${PAYROLL_EMAIL_DOMAIN}`;

    // Create the actual auth user (this is what makes login with a password work)
    const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true, // skip email verification since this isn't a real email
    });

    if (createAuthError) {
      return new Response(JSON.stringify({ error: createAuthError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert the matching profile row with payroll number, name, role
    const { error: insertProfileError } = await supabaseAdmin
      .from('app_users')
      .insert([{ id: newAuthUser.user.id, payroll_no: payrollNo, name, role, is_active: true }]);

    if (insertProfileError) {
      // Roll back the auth user if the profile insert fails, to avoid orphaned accounts
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(JSON.stringify({ error: insertProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, userId: newAuthUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Unexpected error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
