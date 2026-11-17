// ExamShield — SPA Router & Navigation

const Router = {
  currentRoute: '',
  currentRole: null,

  // Navigation structures for each role
  NAV: {
    student: [
      { section: 'Overview', items: [
        { id: 'student-dashboard', label: 'Dashboard', icon: 'layout-dashboard', route: 'student/dashboard' },
      ]},
      { section: 'Examination', items: [
        { id: 'student-seat', label: 'Seat Finder', icon: 'map-pin', route: 'student/seat-finder' },
        { id: 'student-qr', label: 'QR Exam Pass', icon: 'qr-code', route: 'student/qr-pass' },
        { id: 'student-attendance', label: 'Attendance', icon: 'check-square', route: 'student/attendance' },
      ]},
      { section: 'Support', items: [
        { id: 'student-help', label: 'Emergency Help', icon: 'life-buoy', route: 'student/help-desk' },
        { id: 'student-incidents', label: 'My Incidents', icon: 'file-text', route: 'student/incidents' },
        { id: 'student-announcements', label: 'Announcements', icon: 'megaphone', route: 'student/announcements' },
      ]},
    ],
    invigilator: [
      { section: 'Overview', items: [
        { id: 'inv-dashboard', label: 'Dashboard', icon: 'layout-dashboard', route: 'invigilator/dashboard' },
      ]},
      { section: 'Room Management', items: [
        { id: 'inv-rooms', label: 'My Rooms', icon: 'door-open', route: 'invigilator/rooms' },
        { id: 'inv-scanner', label: 'QR Scanner', icon: 'scan', route: 'invigilator/scanner' },
        { id: 'inv-attendance', label: 'Attendance', icon: 'clipboard-check', route: 'invigilator/attendance' },
        { id: 'inv-seat-map', label: 'Seat Map', icon: 'grid-3x3', route: 'invigilator/seat-map' },
        { id: 'inv-readiness', label: 'Room Readiness', icon: 'check-circle', route: 'invigilator/readiness' },
      ]},
      { section: 'Incidents', items: [
        { id: 'inv-incidents', label: 'Incident Inbox', icon: 'alert-circle', route: 'invigilator/incidents' },
        { id: 'inv-announcements', label: 'Announcements', icon: 'megaphone', route: 'invigilator/announcements' },
      ]},
    ],
    admin: [
      { section: 'Overview', items: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: 'layout-dashboard', route: 'admin/dashboard' },
      ]},
      { section: 'Exam Setup', items: [
        { id: 'admin-exams', label: 'Examinations', icon: 'book-open', route: 'admin/exams' },
        { id: 'admin-rooms', label: 'Rooms', icon: 'door-open', route: 'admin/rooms' },
        { id: 'admin-students', label: 'Students', icon: 'users', route: 'admin/students' },
        { id: 'admin-invigilators', label: 'Invigilators', icon: 'user-check', route: 'admin/invigilators' },
        { id: 'admin-import', label: 'CSV Import', icon: 'upload', route: 'admin/import' },
        { id: 'admin-seats', label: 'Seat Allocation', icon: 'grid-3x3', route: 'admin/seats' },
      ]},
      { section: 'Operations', items: [
        { id: 'admin-incidents', label: 'Incidents', icon: 'alert-circle', route: 'admin/incidents' },
        { id: 'admin-attendance', label: 'Attendance', icon: 'clipboard-check', route: 'admin/attendance' },
        { id: 'admin-announcements', label: 'Announcements', icon: 'megaphone', route: 'admin/announcements' },
        { id: 'admin-room-control', label: 'Room Control', icon: 'monitor', route: 'admin/room-control' },
      ]},
      { section: 'Communication', items: [
        { id: 'admin-whatsapp', label: 'WhatsApp', icon: 'message-circle', route: 'admin/whatsapp' },
      ]},
      { section: 'Reports', items: [
        { id: 'admin-reports', label: 'Reports', icon: 'bar-chart-2', route: 'admin/reports' },
        { id: 'admin-settings', label: 'Settings', icon: 'settings', route: 'admin/settings' },
      ]},
    ]
  },

  init() {
    window.addEventListener('hashchange', () => this.route());
  },

  handleAuthChange() {
    if (Auth.isAuthenticated()) {
      const role = Auth.getRole();
      if (!role) {
        this.renderUnauthorized();
        return;
      }
      this.currentRole = role;
      this.renderAppShell();
      this.route();
    } else {
      ActiveListeners.clearAll();
      this.currentRole = null;
      renderLoginScreen();
    }
  },

  navigate(route) {
    window.location.hash = '#/' + route;
  },

  route() {
    if (!Auth.isAuthenticated()) return;

    const hash = window.location.hash.replace('#/', '') || '';
    const role = Auth.getRole();

    // Default routes
    if (!hash || hash === '') {
      this.navigate(role + '/dashboard');
      return;
    }

    // Verify route matches role
    const routeRole = hash.split('/')[0];
    if (routeRole !== role) {
      this.navigate(role + '/dashboard');
      return;
    }

    // Clear previous listeners
    ActiveListeners.clearAll();

    this.currentRoute = hash;
    this.updateActiveNav(hash);
    this.updateHeaderTitle(hash);
    this.renderRoute(hash);
  },

  renderRoute(route) {
    const parts = route.split('/');
    const role = parts[0];
    const page = parts.slice(1).join('/');

    try {
      switch (role) {
        case 'student':
          StudentModule.render(page);
          break;
        case 'invigilator':
          InvigilatorModule.render(page);
          break;
        case 'admin':
          AdminModule.render(page);
          break;
        default:
          this.render404();
      }
    } catch (e) {
      console.error('[Router] Error rendering route:', e);
      UI.renderPage(`<div class="empty-state"><h3>Error loading page</h3><p>${UI.escapeHtml(e.message)}</p></div>`);
    }
  },

  renderAppShell() {
    const role = Auth.getRole();
    const nav = this.NAV[role] || [];

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="offline-bar" id="offline-bar">
        <i data-lucide="wifi-off" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>
        You are offline — viewing cached data
      </div>

      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <div class="app-container">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="brand-icon">
              <i data-lucide="shield-check" style="width:18px;height:18px;"></i>
            </div>
            <div>
              <h1>ExamShield</h1>
              <div class="brand-role">${UI.escapeHtml(role)}</div>
            </div>
          </div>

          <nav class="sidebar-nav" id="sidebar-nav">
            ${nav.map(section => `
              <div class="nav-section">
                <div class="nav-section-title">${UI.escapeHtml(section.section)}</div>
                ${section.items.map(item => `
                  <button class="nav-item" data-route="${item.route}" id="nav-${item.id}" onclick="Router.navigate('${item.route}'); Router.closeSidebar();">
                    <i data-lucide="${item.icon}"></i>
                    <span>${UI.escapeHtml(item.label)}</span>
                  </button>
                `).join('')}
              </div>
            `).join('')}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="user-avatar">${Auth.getUserInitials()}</div>
              <div class="user-info">
                <div class="user-name">${UI.escapeHtml(Auth.getUserName())}</div>
                <div class="user-role">${UI.escapeHtml(role)}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="Auth.logout()" title="Sign out">
                <i data-lucide="log-out" style="width:16px;height:16px;"></i>
              </button>
            </div>
          </div>
        </aside>

        <main class="main-content">
          <header class="mobile-header">
            <button class="menu-btn" onclick="Router.toggleSidebar()">
              <i data-lucide="menu" style="width:22px;height:22px;"></i>
            </button>
            <span class="header-title" id="header-title">ExamShield</span>
            <div class="header-actions">
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('${role}/announcements')" title="Announcements">
                <i data-lucide="bell" style="width:18px;height:18px;"></i>
              </button>
            </div>
          </header>

          <div class="page-content" id="page-content">
            <div class="empty-state">
              <div class="loading-spinner" style="margin:0 auto;"></div>
            </div>
          </div>
        </main>
      </div>

      <div id="toast-container" class="toast-container"></div>
      <div id="modal-overlay" class="modal-overlay"></div>
      <div id="confirm-dialog" class="confirm-dialog"></div>
    `;

    lucide.createIcons();

    // Sidebar overlay close
    document.getElementById('sidebar-overlay').addEventListener('click', () => this.closeSidebar());
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  },

  updateActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
  },

  updateHeaderTitle(route) {
    const titleEl = document.getElementById('header-title');
    if (!titleEl) return;
    const role = Auth.getRole();
    const nav = this.NAV[role] || [];
    for (const section of nav) {
      for (const item of section.items) {
        if (item.route === route) {
          titleEl.textContent = item.label;
          return;
        }
      }
    }
    titleEl.textContent = 'ExamShield';
  },

  renderUnauthorized() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card text-center">
          <i data-lucide="shield-off" style="width:48px;height:48px;color:var(--color-gray-300);margin:0 auto var(--space-4);display:block;"></i>
          <h2 style="font-size:var(--text-xl);margin-bottom:var(--space-2);">Access Denied</h2>
          <p class="text-sm text-muted" style="margin-bottom:var(--space-6);">Your account has not been assigned a role. Contact your administrator.</p>
          <button class="btn btn-secondary" onclick="Auth.logout()">Sign out</button>
        </div>
      </div>
    `;
    lucide.createIcons();
  },

  render404() {
    UI.renderPage(`
      <div class="empty-state">
        <i data-lucide="file-question" style="width:48px;height:48px;"></i>
        <h3>Page not found</h3>
        <p>The page you're looking for doesn't exist.</p>
        <button class="btn btn-primary mt-4" onclick="Router.navigate('${Auth.getRole()}/dashboard')">Go to Dashboard</button>
      </div>
    `);
  }
};

console.log('[ExamShield] Router loaded');
