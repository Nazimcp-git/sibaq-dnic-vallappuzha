// ExamShield — Database Helpers
// Shared database operations, utilities, and UI components

const Database = {
  // --- CRUD Operations ---
  async get(ref) {
    const snap = await ref.once('value');
    return snap.val();
  },

  async getWithKey(ref) {
    const snap = await ref.once('value');
    if (!snap.exists()) return null;
    return { id: snap.key, ...snap.val() };
  },

  async getList(ref) {
    const snap = await ref.once('value');
    const data = snap.val();
    if (!data) return [];
    return Object.entries(data).map(([id, val]) => ({ id, ...val }));
  },

  async set(ref, data) {
    await ref.set(data);
    return data;
  },

  async update(ref, data) {
    await ref.update(data);
    return data;
  },

  async push(ref, data) {
    const newRef = ref.push();
    await newRef.set(data);
    return { id: newRef.key, ...data };
  },

  async remove(ref) {
    await ref.remove();
  },

  async transaction(ref, updateFn) {
    return ref.transaction(updateFn);
  },

  // Multi-location update
  async multiUpdate(updates) {
    const prefixed = {};
    for (const [path, val] of Object.entries(updates)) {
      prefixed['examshield/' + path] = val;
    }
    await db.ref().update(prefixed);
  },

  // Listen for real-time changes
  listen(ref, callback) {
    ref.on('value', snap => callback(snap.val(), snap.key));
    return () => ref.off('value');
  },

  listenChildAdded(ref, callback) {
    ref.on('child_added', snap => callback({ id: snap.key, ...snap.val() }));
    return () => ref.off('child_added');
  },

  listenChildChanged(ref, callback) {
    ref.on('child_changed', snap => callback({ id: snap.key, ...snap.val() }));
    return () => ref.off('child_changed');
  }
};

// --- Active Listeners Management ---
const ActiveListeners = {
  _listeners: [],

  add(unsubscribe) {
    this._listeners.push(unsubscribe);
    return unsubscribe;
  },

  clearAll() {
    this._listeners.forEach(unsub => {
      try { unsub(); } catch(e) {}
    });
    this._listeners = [];
  }
};

// --- UI Helpers ---
const UI = {
  // Show toast notification
  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" style="width:18px;height:18px;flex-shrink:0;color:inherit;"></i>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;

    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  },

  // Show confirmation dialog
  confirm(title, message, onConfirm, confirmText = 'Confirm', danger = false) {
    const dialog = document.getElementById('confirm-dialog');
    dialog.innerHTML = `
      <div class="confirm-box">
        <h3>${this.escapeHtml(title)}</h3>
        <p>${this.escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${this.escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    dialog.classList.add('active');

    document.getElementById('confirm-cancel').onclick = () => dialog.classList.remove('active');
    document.getElementById('confirm-ok').onclick = () => {
      dialog.classList.remove('active');
      onConfirm();
    };
  },

  // Show modal
  showModal(title, contentHtml, footerHtml, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const isLarge = (options && (options.size === 'lg' || options.large)) || title.includes('Campus Map') || title.includes('Room Intelligence');
    overlay.innerHTML = `
      <div class="modal ${isLarge ? 'modal-lg' : ''}">
        <div class="modal-header">
          <h3>${this.escapeHtml(title)}</h3>
          <button class="modal-close" onclick="UI.closeModal()">
            <i data-lucide="x" style="width:20px;height:20px;"></i>
          </button>
        </div>
        <div class="modal-body">${contentHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    overlay.classList.add('active');
    lucide.createIcons({ nodes: [overlay] });
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
  },

  // Loading state for buttons
  setLoading(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Loading...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
  },

  // Show loading placeholder
  showLoading(container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner" style="margin:0 auto var(--space-4);"></div>
        <p class="text-sm text-muted">Loading...</p>
      </div>
    `;
  },

  // Show empty state
  showEmpty(container, icon, title, subtitle) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="${icon}" style="width:48px;height:48px;"></i>
        <h3>${this.escapeHtml(title)}</h3>
        <p>${this.escapeHtml(subtitle)}</p>
      </div>
    `;
    lucide.createIcons({ nodes: [container] });
  },

  // Render page content
  renderPage(contentHtml) {
    let main = document.getElementById('page-content');
    if (!main) {
      if (typeof Router !== 'undefined' && typeof Router.renderAppShell === 'function') {
        Router.renderAppShell();
        main = document.getElementById('page-content');
      }
    }
    if (!main) {
      console.warn('[UI] page-content container not found');
      return null;
    }
    main.innerHTML = contentHtml;
    lucide.createIcons({ nodes: [main] });
    return main;
  },

  // Escape HTML
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  // Format date
  formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  // Format time
  formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  },

  // Format relative time
  formatRelative(ts) {
    if (!ts) return '—';
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  },

  // Format datetime
  formatDateTime(ts) {
    if (!ts) return '—';
    return this.formatDate(ts) + ' ' + this.formatTime(ts);
  },

  // Priority badge
  priorityBadge(priority) {
    const map = {
      critical: '<span class="badge badge-critical">Critical</span>',
      high: '<span class="badge badge-high">High</span>',
      normal: '<span class="badge badge-normal">Normal</span>',
      low: '<span class="badge badge-muted">Low</span>'
    };
    return map[priority] || map.normal;
  },

  // Status badge
  statusBadge(status) {
    const map = {
      submitted: '<span class="badge badge-muted">Submitted</span>',
      pending: '<span class="badge badge-warning">Pending</span>',
      assigned: '<span class="badge badge-normal">Assigned</span>',
      accepted: '<span class="badge badge-normal">Accepted</span>',
      'in-progress': '<span class="badge badge-warning">In Progress</span>',
      resolved: '<span class="badge badge-success">Resolved</span>',
      closed: '<span class="badge badge-muted">Closed</span>',
      present: '<span class="badge badge-success">Present</span>',
      absent: '<span class="badge badge-critical">Absent</span>',
      unmarked: '<span class="badge badge-muted">Not Marked</span>',
      active: '<span class="badge badge-success">Active</span>',
      inactive: '<span class="badge badge-muted">Inactive</span>',
      ready: '<span class="badge badge-success">Ready</span>',
      preparing: '<span class="badge badge-warning">Preparing</span>',
      'not-ready': '<span class="badge badge-muted">Not Ready</span>',
      ongoing: '<span class="badge badge-normal">Ongoing</span>',
      completed: '<span class="badge badge-success">Completed</span>',
      assistance: '<span class="badge badge-critical">Assistance</span>'
    };
    return map[status] || `<span class="badge badge-muted">${this.escapeHtml(status || 'Unknown')}</span>`;
  },

  // Attendance status dot
  attendanceDot(status) {
    return `<span class="status-dot ${status || 'unmarked'}"></span>`;
  },

  // Debounce
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
};

// --- Priority Engine ---
const PriorityEngine = {
  RULES: {
    'medical': 'critical',
    'safety': 'critical',
    'wrong-room': 'high',
    'admit-card': 'high',
    'wrong-seat': 'high',
    'missing-stationery': 'normal',
    'exam-info': 'normal',
    'other': 'normal'
  },

  PRIORITY_ORDER: { critical: 0, high: 1, normal: 2, low: 3 },

  calculate(category) {
    return this.RULES[category] || 'normal';
  },

  compare(a, b) {
    const pa = this.PRIORITY_ORDER[a] ?? 3;
    const pb = this.PRIORITY_ORDER[b] ?? 3;
    return pa - pb;
  },

  sortIncidents(incidents) {
    return incidents.sort((a, b) => {
      const pc = this.compare(a.priority, b.priority);
      if (pc !== 0) return pc;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
};

// --- Room Readiness Calculator ---
const ReadinessCalc = {
  CHECKLIST_ITEMS: [
    { id: 'invigilator', label: 'Invigilator assigned' },
    { id: 'seating', label: 'Student seating prepared' },
    { id: 'attendance', label: 'Attendance list available' },
    { id: 'materials', label: 'Examination materials ready' },
    { id: 'inspection', label: 'Room inspection completed' },
    { id: 'qr', label: 'QR verification ready' },
    { id: 'emergency', label: 'Emergency contact info available' }
  ],

  calculate(checklist) {
    if (!checklist) return 0;
    const total = this.CHECKLIST_ITEMS.length;
    let completed = 0;
    this.CHECKLIST_ITEMS.forEach(item => {
      if (checklist[item.id] && checklist[item.id].completed) completed++;
    });
    return Math.round((completed / total) * 100);
  },

  getStatus(score) {
    if (score >= 100) return 'ready';
    if (score >= 50) return 'preparing';
    return 'not-ready';
  }
};

// --- Incident Category Labels ---
const INCIDENT_CATEGORIES = {
  'medical': 'Medical Emergency',
  'safety': 'Safety Emergency',
  'wrong-room': 'Wrong Room',
  'admit-card': 'Admit Card Problem',
  'wrong-seat': 'Wrong Seat',
  'missing-stationery': 'Missing Stationery',
  'exam-info': 'Examination Information',
  'other': 'Other Issue'
};

// --- Auto Assignment Engine ---
const AssignmentEngine = {
  async findBestInvigilator(incident) {
    const invigilators = await Database.getList(DB.invigilators());
    if (!invigilators.length) return null;

    // Get available invigilators
    let eligible = invigilators.filter(inv => inv.available !== false);
    if (!eligible.length) return null;

    // Prefer invigilator assigned to incident's room
    if (incident.roomId) {
      const roomInvig = eligible.find(inv => {
        const rooms = inv.assignedRooms || {};
        return Object.values(rooms).includes(incident.roomId) || rooms[incident.roomId];
      });
      if (roomInvig) return roomInvig;
    }

    // Sort by active incident count (ascending)
    eligible.sort((a, b) => (a.activeIncidentCount || 0) - (b.activeIncidentCount || 0));

    return eligible[0];
  },

  async assignIncident(incidentId, incident) {
    const invigilator = await this.findBestInvigilator(incident);

    if (!invigilator) {
      // No eligible invigilator, leave as pending
      await Database.update(DB.incident(incidentId), {
        status: 'pending',
        updatedAt: DB.serverTimestamp()
      });

      await Database.push(DB.incidentHistory(incidentId), {
        action: 'No eligible invigilator found — incident pending',
        actorId: 'system',
        actorRole: 'system',
        timestamp: DB.serverTimestamp(),
        details: 'Automatic assignment could not find an available invigilator'
      });

      return null;
    }

    // Assign to the invigilator
    const updates = {};
    updates['incidents/' + incidentId + '/assignedTo'] = invigilator.id;
    updates['incidents/' + incidentId + '/assignmentType'] = 'automatic';
    updates['incidents/' + incidentId + '/status'] = 'assigned';
    updates['incidents/' + incidentId + '/updatedAt'] = DB.serverTimestamp();

    await Database.multiUpdate(updates);

    // Increment active incident count using transaction
    await Database.transaction(
      DB.invigilator(invigilator.id).child('activeIncidentCount'),
      (current) => (current || 0) + 1
    );

    // Add timeline event
    await Database.push(DB.incidentHistory(incidentId), {
      action: 'Incident automatically assigned',
      actorId: 'system',
      actorRole: 'system',
      timestamp: DB.serverTimestamp(),
      details: 'Assigned to invigilator: ' + (invigilator.id)
    });

    return invigilator;
  }
};

// --- Class Batch Management Helper ---
const ClassHelper = {
  // Retrieve all configured classes, with continuous auto-discovery from student records & seed defaults
  async getAllClasses() {
    let rawClasses = await Database.getList(DB.classes()) || [];
    const classMap = new Map();

    // 1. Process stored classes (normalize code & name)
    rawClasses.forEach(c => {
      const code = String(c.code || c.name || c.id || '').replace(/^class_/, '').trim().toUpperCase();
      if (code && !classMap.has(code)) {
        classMap.set(code, {
          id: c.id || ('class_' + code.replace(/[^a-zA-Z0-9]/g, '')),
          code: code,
          name: c.name && c.name !== code ? c.name : `Class Batch ${code}`,
          department: c.department || (code.startsWith('CS') ? 'Computer Science' : (code.startsWith('EC') ? 'Electronics' : 'General Academics'))
        });
      }
    });

    // 2. Discover from registered student accounts
    try {
      const users = await Database.getList(DB.users()) || [];
      users.forEach(u => {
        if (u.role === 'student') {
          const cCode = String(u.classId || u.class || '').trim().toUpperCase();
          if (cCode && cCode !== 'DEFAULT' && cCode !== 'UNASSIGNED' && !classMap.has(cCode)) {
            classMap.set(cCode, {
              id: 'class_' + cCode.replace(/[^a-zA-Z0-9]/g, ''),
              code: cCode,
              name: `Class Batch ${cCode}`,
              department: cCode.startsWith('CS') ? 'Computer Science' : (cCode.startsWith('EC') ? 'Electronics' : 'General Academics')
            });
          }
        }
      });
    } catch (e) {
      console.warn('[ClassHelper] Could not scan users for classes:', e);
    }

    // 3. Ensure baseline demo cohorts exist so admins always have diverse batches to test
    const baseBatches = ['CS-101', 'CS-102', 'CS-A', 'CS-B', '10-A', '10-B', 'EC-201'];
    baseBatches.forEach(code => {
      if (!classMap.has(code)) {
        classMap.set(code, {
          id: 'class_' + code.replace(/[^a-zA-Z0-9]/g, ''),
          code: code,
          name: `Class Batch ${code}`,
          department: code.startsWith('CS') ? 'Computer Science' : (code.startsWith('EC') ? 'Electronics' : 'General Academics')
        });
      }
    });

    // 4. Persist any newly discovered classes to Firebase RTDB
    const updates = {};
    classMap.forEach((cObj, code) => {
      const existsInDb = rawClasses.some(rc => {
        const rcCode = String(rc.code || rc.name || rc.id || '').replace(/^class_/, '').trim().toUpperCase();
        return rcCode === code;
      });
      if (!existsInDb) {
        updates['classes/' + cObj.id] = {
          id: cObj.id,
          code: cObj.code,
          name: cObj.name,
          department: cObj.department,
          createdAt: DB.serverTimestamp()
        };
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await Database.multiUpdate(updates);
      } catch (err) {
        console.warn('[ClassHelper] Class auto-sync warning:', err);
      }
    }

    return Array.from(classMap.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  },

  // Add new class
  async addClass(code, name = '', department = '') {
    const cleanCode = String(code).trim().toUpperCase();
    if (!cleanCode) return null;
    const id = 'class_' + cleanCode.replace(/[^a-zA-Z0-9]/g, '');

    const record = {
      id: id,
      code: cleanCode,
      name: name.trim() || `Class Batch ${cleanCode}`,
      department: department.trim() || 'General Academics',
      createdAt: DB.serverTimestamp(),
      updatedAt: DB.serverTimestamp()
    };

    await Database.set(DB.classItem(id), record);
    return record;
  },

  // Delete a class
  async removeClass(id) {
    await Database.remove(DB.classItem(id));
  },

  // Helper to generate options HTML for select dropdowns
  async renderClassOptions(selectedCode = '', options = {}) {
    const classes = await this.getAllClasses();
    let html = '';

    if (options.includeAll) {
      html += `<option value="all" ${selectedCode === 'all' ? 'selected' : ''}>All Classes (Open Examination)</option>`;
    } else if (options.placeholder !== false) {
      html += `<option value="">${options.placeholder || '-- Select Class Batch --'}</option>`;
    }

    classes.forEach(c => {
      const isSel = (c.code === selectedCode || c.id === selectedCode);
      html += `<option value="${UI.escapeHtml(c.code)}" ${isSel ? 'selected' : ''}>Class ${UI.escapeHtml(c.code)} — ${UI.escapeHtml(c.name)}</option>`;
    });

    if (options.allowAdd) {
      html += `<option value="__new__">+ Add New Class...</option>`;
    }

    return html;
  }
};

console.log('[ExamShield] Database helpers loaded');
