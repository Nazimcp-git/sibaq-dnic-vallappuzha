// ExamShield — UI Components, Priority Engine & Readiness Calculator
import { Database } from '../services/database.js';
import { db, DB } from '../config/firebase.js';
import { createIcons } from './icons.js';
import { INCIDENT_CATEGORIES, PRIORITY_RULES, PRIORITY_ORDER, READINESS_CHECKLIST_ITEMS } from '../config/app-config.js';

// --- UI Helpers ---
export const UI = {
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
    createIcons({ nodes: [toast] });

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
    if (!dialog) return;
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

    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');
    if (cancelBtn) cancelBtn.onclick = () => dialog.classList.remove('active');
    if (okBtn) {
      okBtn.onclick = () => {
        dialog.classList.remove('active');
        onConfirm();
      };
    }
  },

  // Show modal
  showModal(title, contentHtml, footerHtml, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
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
    createIcons({ nodes: [overlay] });
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  // Loading state for buttons
  setLoading(btn, loading) {
    if (!btn) return;
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
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner" style="margin:0 auto var(--space-4);"></div>
        <p class="text-sm text-muted">Loading...</p>
      </div>
    `;
  },

  // Show empty state
  showEmpty(container, icon, title, subtitle) {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="${icon}" style="width:48px;height:48px;"></i>
        <h3>${this.escapeHtml(title)}</h3>
        <p>${this.escapeHtml(subtitle)}</p>
      </div>
    `;
    createIcons({ nodes: [container] });
  },

  // Render page content
  renderPage(contentHtml) {
    let main = document.getElementById('page-content');
    if (!main) {
      if (typeof window.Router !== 'undefined' && typeof window.Router.renderAppShell === 'function') {
        window.Router.renderAppShell();
        main = document.getElementById('page-content');
      }
    }
    if (!main) {
      console.warn('[UI] page-content container not found');
      return null;
    }
    main.innerHTML = contentHtml;
    createIcons({ nodes: [main] });
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
export const PriorityEngine = {
  RULES: PRIORITY_RULES,
  PRIORITY_ORDER: PRIORITY_ORDER,

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
export const ReadinessCalc = {
  CHECKLIST_ITEMS: READINESS_CHECKLIST_ITEMS,

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

// --- Auto Assignment Engine ---
export const AssignmentEngine = {
  async findBestInvigilator(incident) {
    const invigilators = await Database.getList(DB.invigilators());
    if (!invigilators.length) return null;

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

    const updates = {};
    updates['incidents/' + incidentId + '/assignedTo'] = invigilator.id;
    updates['incidents/' + incidentId + '/assignmentType'] = 'automatic';
    updates['incidents/' + incidentId + '/status'] = 'assigned';
    updates['incidents/' + incidentId + '/updatedAt'] = DB.serverTimestamp();

    await Database.multiUpdate(updates);

    await Database.transaction(
      DB.invigilator(invigilator.id).child('activeIncidentCount'),
      (current) => (current || 0) + 1
    );

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

if (typeof window !== 'undefined') {
  window.UI = UI;
  window.PriorityEngine = PriorityEngine;
  window.ReadinessCalc = ReadinessCalc;
  window.AssignmentEngine = AssignmentEngine;
}
