// ExamShield — Authentication Module

const Auth = {
  currentUser: null,
  currentUserData: null,
  _authListener: null,

  init() {
    return new Promise((resolve) => {
      this._authListener = auth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          try {
            this.currentUserData = await Database.get(DB.user(user.uid));
            if (!this.currentUserData) {
              console.warn('[Auth] User data not found in database');
              this.currentUserData = { name: user.email, email: user.email, role: null };
            }
          } catch (e) {
            console.error('[Auth] Failed to load user data:', e);
            this.currentUserData = { name: user.email, email: user.email, role: null };
          }
        } else {
          this.currentUser = null;
          this.currentUserData = null;
        }
        resolve(user);
        Router.handleAuthChange();
      });
    });
  },

  async login(email, password) {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  },

  async logout() {
    ActiveListeners.clearAll();
    await auth.signOut();
    this.currentUser = null;
    this.currentUserData = null;
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  getRole() {
    return this.currentUserData ? this.currentUserData.role : null;
  },

  getUid() {
    return this.currentUser ? this.currentUser.uid : null;
  },

  getUserName() {
    return this.currentUserData ? (this.currentUserData.name || this.currentUser.email) : '';
  },

  getUserInitials() {
    const name = this.getUserName();
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
};

// --- Login Screen ---
function renderLoginScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-icon">
            <i data-lucide="shield-check" style="width:22px;height:22px;"></i>
          </div>
          <div>
            <h1>ExamShield</h1>
            <div class="auth-tagline">One Examination. One Command Center.</div>
          </div>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email address</label>
            <input type="email" class="form-input" id="login-email" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="login-password" placeholder="Enter password" required autocomplete="current-password">
          </div>
          <div id="login-error" class="form-error" style="margin-bottom:var(--space-4);display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full btn-lg" id="login-btn">
            Sign in
          </button>
        </form>

        <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--border-color);text-align:center;">
          <p class="text-xs text-muted mb-2">
            Contact your examination administrator for account credentials.
          </p>
          <a href="setup.html" class="text-xs font-semibold" style="color:var(--color-green-600);text-decoration:none;">
            Account Provisioning &amp; Demo Setup &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    errorEl.style.display = 'none';
    UI.setLoading(btn, true);

    try {
      await Auth.login(email, password);
    } catch (err) {
      let msg = 'Sign in failed. Please check your credentials.';
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/invalid-email') msg = 'Invalid email format.';
      if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      UI.setLoading(btn, false);
    }
  });
}

console.log('[ExamShield] Auth module loaded');
