// sidebar.js
// Renders the role-based sidebar navigation. Call renderSidebar(user, currentPage)
// on every protected page.

const NAV_ITEMS = {
  SUPER_ADMIN: [
    { page: 'dashboard.html', icon: '&#128202;', label: 'Dashboard' },
    { page: 'requests.html', icon: '&#128203;', label: 'All Requests' },
    { page: 'new-request.html', icon: '&#10133;', label: 'New Request' },
    { page: 'upload-stations.html', icon: '&#128190;', label: 'Upload Stations CSV' },
    { page: 'upload-ips.html', icon: '&#127760;', label: 'Upload IPs CSV' },
    { page: 'stations-master.html', icon: '&#127959;', label: 'Stations Master List' },
    { page: 'users.html', icon: '&#128101;', label: 'Users' },
    { page: 'audit-log.html', icon: '&#128220;', label: 'Audit Log' },
  ],
  STN_ADMIN: [
    { page: 'requests.html', icon: '&#128203;', label: 'My Requests' },
    { page: 'new-request.html', icon: '&#10133;', label: 'New Request' },
  ],
  STN_SCADA: [
    { page: 'requests.html', icon: '&#128203;', label: 'Requests Queue' },
    { page: 'audit-log.html', icon: '&#128220;', label: 'Audit Log' },
  ],
};

function renderSidebar(user, currentPage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const items = NAV_ITEMS[user.role] || [];
  const linksHtml = items.map(item => `
    <div class="sidebar-link ${item.page === currentPage ? 'active' : ''}" onclick="navigateAndCloseSidebar('${item.page}')">
      <span>${item.icon}</span>
      <span>${item.label}</span>
    </div>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-logo">Station <span>SIM/IP</span></div>
    <div class="sidebar-nav">${linksHtml}</div>
  `;

  ensureSidebarOverlay();
}

// Creates a dark overlay element used behind the sidebar on mobile when it's open.
// Clicking the overlay closes the sidebar.
function ensureSidebarOverlay() {
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function navigateAndCloseSidebar(page) {
  closeSidebar();
  window.location.href = page;
}
