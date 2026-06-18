// data.js
// All Supabase queries live here, organized by table/feature.
// Every function returns { data, error } same as the raw Supabase client,
// so calling code can check `if (error)` consistently.

// ============================================================================
// USERS
// ============================================================================
async function fetchAllUsers() {
  return await supabaseClient.from('app_users').select('*').order('created_at');
}

async function fetchUserByPayroll(payrollNo) {
  return await supabaseClient.from('app_users').select('*').eq('payroll_no', payrollNo).maybeSingle();
}

// Calls the create-user Edge Function (handles Supabase Auth user creation +
// profile insert together, using the secure service_role key server-side).
async function createUserViaFunction({ payrollNo, name, role, password, requestingUserId }) {
  try {
    const res = await fetch(CREATE_USER_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ payrollNo, name, role, password, requestingUserId }),
    });
    const result = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: result.error || 'Failed to create user.' } };
    }
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

async function toggleUserActive(id, isActive) {
  return await supabaseClient.from('app_users').update({ is_active: isActive }).eq('id', id);
}

// ============================================================================
// STATIONS MASTER (registry) — checked when adding a station to a request,
// grows from both CSV uploads (SUPER_ADMIN) and new stations added via
// requests (auto-inserted on submit). Uniqueness is on EQ Number + Type
// combined, since the same EQ Number can exist with a different Type.
// ============================================================================
async function fetchStationsMaster() {
  return await supabaseClient.from('stations_master').select('*').order('eq_number');
}

async function checkStationExists(eqNumber, type) {
  return await supabaseClient.from('stations_master').select('*').eq('eq_number', eqNumber).eq('type', type).maybeSingle();
}

async function insertStationsMasterBulk(rows) {
  // rows: [{ eq_number, type, vendor, modem }, ...]
  // Upsert on the eq_number+type combo so re-uploading a CSV updates existing rows instead of erroring
  return await supabaseClient.from('stations_master').upsert(rows, { onConflict: 'eq_number,type' }).select();
}

// ============================================================================
// IP REGISTRY — checked when SCADA assigns an IP, grows from both CSV
// uploads (SUPER_ADMIN) and new IPs assigned through requests.
// ============================================================================
async function fetchIpRegistry() {
  return await supabaseClient.from('ip_registry').select('*').order('ip');
}

async function checkIpExists(ip) {
  return await supabaseClient.from('ip_registry').select('*').eq('ip', ip).maybeSingle();
}

async function insertIpRegistryBulk(rows) {
  // rows: [{ ip }, ...]
  return await supabaseClient.from('ip_registry').upsert(rows, { onConflict: 'ip' }).select();
}

async function insertIpRegistryOne(ip) {
  return await supabaseClient.from('ip_registry').upsert([{ ip }], { onConflict: 'ip' }).select();
}

// ============================================================================
// STATION REQUESTS
// ============================================================================
async function fetchAllRequests() {
  return await supabaseClient.from('station_requests').select('*').order('created_at', { ascending: false });
}

async function fetchRequestById(id) {
  return await supabaseClient.from('station_requests').select('*').eq('id', id).single();
}

async function createRequest({ request_no, title, remarks, submitted_by_name, submitted_by_payroll, total_stations }) {
  return await supabaseClient.from('station_requests').insert([{
    request_no, title, remarks, submitted_by_name, submitted_by_payroll,
    total_stations, status: 'SUBMITTED',
  }]).select().single();
}

async function updateRequest(id, fields) {
  return await supabaseClient.from('station_requests').update(fields).eq('id', id);
}

async function getNextRequestNumber() {
  const year = new Date().getFullYear();
  const { data, error } = await supabaseClient
    .from('station_requests')
    .select('request_no')
    .like('request_no', `REQ-${year}-%`);
  if (error) return `REQ-${year}-0001`;
  const next = (data?.length || 0) + 1;
  return `REQ-${year}-${String(next).padStart(4, '0')}`;
}

// ============================================================================
// REQUEST STATIONS (stations attached to a specific request)
// ============================================================================
async function fetchStationsForRequest(requestId) {
  return await supabaseClient.from('request_stations').select('*').eq('request_id', requestId).order('eq_number');
}

async function insertRequestStationsBulk(rows) {
  // rows: [{ request_id, eq_number, type, vendor, modem }, ...]
  return await supabaseClient.from('request_stations').insert(rows).select();
}

async function updateRequestStation(id, fields) {
  return await supabaseClient.from('request_stations').update(fields).eq('id', id);
}

// ============================================================================
// AUDIT LOG
// ============================================================================
async function writeAuditLog({ user_name, action, request_no = null, eq_number = null, old_value = null, new_value = null, remarks = null }) {
  return await supabaseClient.from('audit_logs').insert([{
    user_name, action, request_no, eq_number, old_value, new_value, remarks,
  }]);
}

async function fetchAuditLogs(filters = {}) {
  let query = supabaseClient.from('audit_logs').select('*');
  if (filters.requestNo) query = query.eq('request_no', filters.requestNo);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.userName) query = query.eq('user_name', filters.userName);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
  return await query.order('created_at', { ascending: false }).limit(500);
}
