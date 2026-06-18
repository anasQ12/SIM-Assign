// auth.js
// ============================================================================
// Simple session management using localStorage.
// No passwords — the user picks their email from a dropdown of app_users
// (populated from Supabase). This matches "internal tool, small known
// user list" rather than a public-facing login system.
// ============================================================================

const SESSION_KEY = 'station_sim_session';

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Redirects to login if not signed in. Call at the top of every protected page.
function requireAuth() {
  const user = getSession();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// Redirects to login if not signed in OR not one of the allowed roles.
function requireRole(...allowedRoles) {
  const user = requireAuth();
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    alert('You do not have permission to view this page.');
    window.location.href = 'redirect.html';
    return null;
  }
  return user;
}

function logout() {
  clearSession();
  if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.signOut();
  }
  window.location.href = 'login.html';
}

// Renders the top bar with the current user's name/role and a logout button.
// Call this on every protected page after requireAuth()/requireRole().
function renderTopBar(user, pageTitle) {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  topbar.innerHTML = `
    <div class="flex gap-12" style="align-items:center;">
      <button class="mobile-menu-toggle" onclick="toggleSidebar()" aria-label="Open menu">&#9776;</button>
      <div class="topbar-title">${pageTitle}</div>
    </div>
    <div class="topbar-user">
      <span class="topbar-user-name">${escapeHtml(user.name)}</span>
      <span class="role-badge role-${user.role}">${formatRole(user.role)}</span>
      <button class="btn btn-ghost btn-sm" onclick="openChangePasswordModal()">Change Password</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Sign out</button>
    </div>
  `;
  ensureChangePasswordModal();
}

// Injects the Change Password modal into the page once, if it isn't already there.
function ensureChangePasswordModal() {
  if (document.getElementById('changePasswordModal')) return;

  const modal = document.createElement('div');
  modal.id = 'changePasswordModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Change Password</div>
        <button class="modal-close" onclick="closeChangePasswordModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input type="password" class="form-input" id="newPasswordInput" placeholder="At least 6 characters">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm New Password</label>
          <input type="password" class="form-input" id="confirmPasswordInput" placeholder="Re-type the new password" onkeydown="if(event.key==='Enter') submitChangePassword()">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeChangePasswordModal()">Cancel</button>
        <button class="btn btn-primary" id="changePasswordBtn" onclick="submitChangePassword()">Update Password</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openChangePasswordModal() {
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  document.getElementById('changePasswordModal').classList.add('open');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('open');
}

async function submitChangePassword() {
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;

  if (!newPassword || newPassword.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match.', 'warning');
    return;
  }

  const btn = document.getElementById('changePasswordBtn');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  btn.disabled = false;
  btn.textContent = 'Update Password';

  if (error) {
    showToast('Error updating password: ' + error.message, 'error', 6000);
    return;
  }

  showToast('Password updated successfully.', 'success');
  closeChangePasswordModal();
}

function formatRole(role) {
  const map = {
    SUPER_ADMIN: 'Super Admin',
    STN_ADMIN: 'Station Admin',
    STN_SCADA: 'SCADA',
  };
  return map[role] || role;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
