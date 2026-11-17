// ExamShield — Authentication Module
// Supports Candidate Register ID login (Passwordless) & Staff Email/Password authentication.

import { auth, DB } from '../config/firebase.js';
import { Database, ActiveListeners } from '../services/database.js';
import { UI } from '../utils/helpers.js';
import { createIcons } from '../utils/icons.js';

export const Auth = {
  currentUser: null,
  currentUserData: null,
  _authListener: null,

  init() {
    return new Promise((resolve) => {
      // 1. Check local student candidate session first
      const storedStudent = localStorage.getItem('examshield_student_session');
      if (storedStudent) {
        try {
          const parsed = JSON.parse(storedStudent);
          if (parsed && parsed.uid) {
            Database.get(DB.user(parsed.uid)).then(student => {
              if (student && student.active !== false) {
                student.role = 'student';
                this.currentUser = {
                  uid: student.id,
                  email: student.email || `${student.registerNumber}@examshield.local`,
                  displayName: student.name,
                  isCandidateSession: true
                };
                this.currentUserData = student;
                resolve(this.currentUser);
                if (typeof window.Router !== 'undefined' && window.Router.handleAuthChange) {
                  window.Router.handleAuthChange();
                }
              } else {
                localStorage.removeItem('examshield_student_session');
                this.listenToFirebaseAuth(resolve);
              }
            }).catch(() => {
              this.listenToFirebaseAuth(resolve);
            });
            return;
          }
        } catch (e) {
          localStorage.removeItem('examshield_student_session');
        }
      }

      this.listenToFirebaseAuth(resolve);
    });
  },

  listenToFirebaseAuth(resolve) {
    this._authListener = auth.onAuthStateChanged(async (user) => {
      // NEVER overwrite an active candidate session with Firebase auth state changes
      if (this.currentUser && this.currentUser.isCandidateSession) {
        if (resolve) resolve(this.currentUser);
        return;
      }

      if (user) {
        this.currentUser = user;
        try {
          this.currentUserData = await Database.get(DB.user(user.uid));
          if (!this.currentUserData) {
            console.warn('[Auth] User data not found in database for UID:', user.uid);
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

      if (resolve) resolve(this.currentUser);
      if (typeof window.Router !== 'undefined' && window.Router.handleAuthChange) {
        window.Router.handleAuthChange();
      }
    });
  },

  // Student login using Register ID only (No password required)
  async loginWithRegisterNumber(regNumber) {
    if (!regNumber || !String(regNumber).trim()) {
      throw new Error('Please enter your official candidate Register ID.');
    }
    const clean = String(regNumber).trim().toUpperCase();

    // Query candidate from database
    const users = await Database.getList(DB.users());
    const student = users.find(u => {
      const uRole = String(u.role || '').trim().toLowerCase();
      // Match candidate if role is student or if record has registerNumber
      const userReg = String(u.registerNumber || '').trim().toUpperCase();
      const isRegMatch = userReg === clean || userReg.replace(/[^A-Z0-9]/g, '') === clean.replace(/[^A-Z0-9]/g, '');
      return isRegMatch && (uRole === 'student' || !uRole);
    });

    if (!student) {
      throw new Error(`Candidate with Register ID "${regNumber}" was not found. Please verify your hall ticket number or contact the exam hall controller.`);
    }

    if (student.active === false) {
      throw new Error(`Candidate registration for ${student.name} is currently inactive. Please contact the administrator.`);
    }

    // Explicitly ensure role is 'student'
    student.role = 'student';

    // Set candidate state (Do NOT call auth.signOut or auth.signInAnonymously as they trigger onAuthStateChanged)
    this.currentUser = {
      uid: student.id,
      email: student.email || `${student.registerNumber}@examshield.local`,
      displayName: student.name,
      isCandidateSession: true
    };
    this.currentUserData = student;

    // Persist session across page reloads
    localStorage.setItem('examshield_student_session', JSON.stringify({
      uid: student.id,
      registerNumber: student.registerNumber,
      name: student.name,
      timestamp: Date.now()
    }));

    if (typeof window.Router !== 'undefined' && window.Router.handleAuthChange) {
      window.Router.handleAuthChange();
    }
    return student;
  },

  // Staff (Admin / Invigilator) login with Email & Password
  async login(email, password) {
    localStorage.removeItem('examshield_student_session');
    this.currentUser = null;
    this.currentUserData = null;
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  },

  async logout() {
    localStorage.removeItem('examshield_student_session');
    ActiveListeners.clearAll();
    this.currentUser = null;
    this.currentUserData = null;
    try {
      await auth.signOut();
    } catch (e) {}
    if (typeof window.Router !== 'undefined' && window.Router.handleAuthChange) {
      window.Router.handleAuthChange();
    }
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  getRole() {
    let r = this.currentUserData ? this.currentUserData.role : null;
    if (!r && this.currentUser && this.currentUser.isCandidateSession) {
      r = 'student';
    }
    if (!r) return null;
    r = String(r).trim().toLowerCase();
    if (r === 'admin' || r === 'administrator') return 'admin';
    if (r === 'invigilator' || r === 'faculty' || r === 'supervisor') return 'invigilator';
    return 'student';
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
export function renderLoginScreen() {
  const app = document.getElementById('app');
  if (!app) return;

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

        <!-- Role Switcher Tabs -->
        <div class="auth-tabs" style="display:flex;border-bottom:1px solid var(--border-color);margin-bottom:var(--space-5);">
          <button type="button" class="auth-tab-btn active" id="tab-student" style="flex:1;padding:8px 12px;font-weight:600;font-size:var(--text-xs);border-bottom:2px solid var(--color-green-600);background:transparent;border-top:none;border-left:none;border-right:none;cursor:pointer;color:var(--color-charcoal);">
            <i data-lucide="user" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Student Candidate
          </button>
          <button type="button" class="auth-tab-btn" id="tab-staff" style="flex:1;padding:8px 12px;font-weight:600;font-size:var(--text-xs);border-bottom:2px solid transparent;background:transparent;border-top:none;border-left:none;border-right:none;cursor:pointer;color:var(--color-gray-500);">
            <i data-lucide="shield" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Faculty / Admin
          </button>
        </div>

        <!-- Panel 1: Student Login with Register ID Only -->
        <div id="panel-student-login">
          <div style="margin-bottom:var(--space-4);">
            <div class="font-bold text-sm" style="color:var(--color-charcoal);">Candidate Examination Access</div>
            <div class="text-xs text-muted">Enter your Register ID to view your exam room, seat, and QR pass.</div>
          </div>

          <form id="student-login-form">
            <div class="form-group">
              <label class="form-label font-bold text-xs" style="text-transform:uppercase;letter-spacing:0.04em;">Register ID / Hall Ticket Number</label>
              <div style="position:relative;">
                <input type="text" class="form-input mono font-bold text-base" id="student-reg-id" placeholder="e.g. REG2024001" required autocomplete="off" autofocus style="letter-spacing:0.05em;padding-right:36px;">
                <i data-lucide="hash" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--color-gray-400);"></i>
              </div>
              <div class="form-hint text-xs mt-1">No password needed. Simply enter your assigned registration code.</div>
            </div>

            <div id="student-login-error" class="form-error" style="margin-bottom:var(--space-4);display:none;"></div>

            <button type="submit" class="btn btn-primary btn-full btn-lg" id="btn-student-submit">
              <i data-lucide="log-in" style="width:16px;height:16px;"></i> Access Candidate Desk
            </button>
          </form>
        </div>

        <!-- Panel 2: Staff / Faculty / Admin Login with Email & Password -->
        <div id="panel-staff-login" style="display:none;">
          <div style="margin-bottom:var(--space-4);">
            <div class="font-bold text-sm" style="color:var(--color-charcoal);">Faculty &amp; Administration Access</div>
            <div class="text-xs text-muted">Authorized invigilators and examination controllers sign in here.</div>
          </div>

          <form id="staff-login-form">
            <div class="form-group">
              <label class="form-label text-xs">Official Email Address</label>
              <input type="email" class="form-input text-sm" id="staff-login-email" placeholder="admin@demo.examshield.in" required autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label text-xs">Account Password</label>
              <input type="password" class="form-input text-sm" id="staff-login-password" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <div id="staff-login-error" class="form-error" style="margin-bottom:var(--space-4);display:none;"></div>
            <button type="submit" class="btn btn-primary btn-full btn-lg" id="btn-staff-submit">
              Sign In to Command Center
            </button>
          </form>
        </div>

        <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--border-color);text-align:center;">
          <p class="text-xs text-muted mb-2">
            Looking to setup test data, register accounts, or configure rooms?
          </p>
          <a href="setup.html" class="text-xs font-semibold" style="color:var(--color-green-600);text-decoration:none;">
            Account Provisioning &amp; Demo Setup &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  createIcons();

  const tabStudent = document.getElementById('tab-student');
  const tabStaff = document.getElementById('tab-staff');
  const panelStudent = document.getElementById('panel-student-login');
  const panelStaff = document.getElementById('panel-staff-login');

  if (tabStudent && tabStaff && panelStudent && panelStaff) {
    tabStudent.onclick = () => {
      tabStudent.classList.add('active');
      tabStudent.style.borderBottomColor = 'var(--color-green-600)';
      tabStudent.style.color = 'var(--color-charcoal)';
      tabStaff.classList.remove('active');
      tabStaff.style.borderBottomColor = 'transparent';
      tabStaff.style.color = 'var(--color-gray-500)';

      panelStudent.style.display = 'block';
      panelStaff.style.display = 'none';
      const regInput = document.getElementById('student-reg-id');
      if (regInput) regInput.focus();
    };

    tabStaff.onclick = () => {
      tabStaff.classList.add('active');
      tabStaff.style.borderBottomColor = 'var(--color-green-600)';
      tabStaff.style.color = 'var(--color-charcoal)';
      tabStudent.classList.remove('active');
      tabStudent.style.borderBottomColor = 'transparent';
      tabStudent.style.color = 'var(--color-gray-500)';

      panelStaff.style.display = 'block';
      panelStudent.style.display = 'none';
      const emailInput = document.getElementById('staff-login-email');
      if (emailInput) emailInput.focus();
    };
  }

  const studentForm = document.getElementById('student-login-form');
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-student-submit');
      const errorEl = document.getElementById('student-login-error');
      const regId = document.getElementById('student-reg-id').value.trim();

      errorEl.style.display = 'none';
      UI.setLoading(btn, true);

      try {
        await Auth.loginWithRegisterNumber(regId);
      } catch (err) {
        errorEl.textContent = err.message || 'Candidate authentication failed. Please verify your Register ID.';
        errorEl.style.display = 'block';
        UI.setLoading(btn, false);
      }
    });
  }

  const staffForm = document.getElementById('staff-login-form');
  if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-staff-submit');
      const errorEl = document.getElementById('staff-login-error');
      const email = document.getElementById('staff-login-email').value.trim();
      const password = document.getElementById('staff-login-password').value;

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
}

if (typeof window !== 'undefined') {
  window.Auth = Auth;
  window.renderLoginScreen = renderLoginScreen;
}
