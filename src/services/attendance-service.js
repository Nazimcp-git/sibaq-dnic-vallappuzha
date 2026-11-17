// ExamShield — Attendance Service (Shared Helpers & Control)
import { DB } from '../config/firebase.js';
import { Database, ActiveListeners } from './database.js';
import { UI } from '../utils/helpers.js';
import { Auth } from '../auth/authentication.js';
import { createIcons } from '../utils/icons.js';

export const AttendanceHelper = {
  // Mark student attendance
  async markAttendance(examId, assignmentId, status, markedBy) {
    if (!examId || !assignmentId) throw new Error('Missing examination or assignment reference');

    const ref = DB.attendanceRecord(examId, assignmentId);
    const existing = await Database.get(ref) || {};

    const history = existing.history || [];
    history.push({
      status: status,
      changedBy: markedBy || Auth.getUid(),
      changedAt: Date.now(),
      reason: 'Standard attendance check'
    });

    const record = {
      status: status, // 'present', 'absent', 'unmarked'
      markedBy: markedBy || Auth.getUid(),
      markedAt: existing.markedAt || DB.serverTimestamp(),
      updatedAt: DB.serverTimestamp(),
      history: history
    };

    await Database.set(ref, record);
    return record;
  },

  // Correct attendance record with audit reason
  async correctAttendance(examId, assignmentId, newStatus, correctedBy, reason) {
    const ref = DB.attendanceRecord(examId, assignmentId);
    const existing = await Database.get(ref) || {};

    const history = existing.history || [];
    history.push({
      status: newStatus,
      changedBy: correctedBy || Auth.getUid(),
      changedAt: Date.now(),
      reason: reason || 'Administrative correction'
    });

    await Database.update(ref, {
      status: newStatus,
      updatedAt: DB.serverTimestamp(),
      history: history
    });
  },

  // Calculate stats for a room or overall
  async getAttendanceStats(examId, roomId = null) {
    const assignmentsMap = await Database.get(DB.assignments(examId)) || {};
    const attendanceMap = await Database.get(DB.attendance(examId)) || {};

    let total = 0;
    let present = 0;
    let absent = 0;
    let unmarked = 0;

    Object.entries(assignmentsMap).forEach(([asgnId, asgn]) => {
      if (roomId && asgn.roomId !== roomId) return;
      total++;
      const att = attendanceMap[asgnId];
      if (att && att.status === 'present') present++;
      else if (att && att.status === 'absent') absent++;
      else unmarked++;
    });

    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, unmarked, percentage };
  },

  // Render stats cards into a container
  renderAttendanceStats(stats, container) {
    if (!container) return;
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Assigned Students</div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-change">Total scheduled</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-label">Present</div>
          <div class="stat-value" style="color:var(--color-green-600);">${stats.present}</div>
          <div class="stat-change">${stats.percentage}% confirmed</div>
        </div>
        <div class="stat-card stat-critical">
          <div class="stat-label">Absent</div>
          <div class="stat-value" style="color:var(--color-critical);">${stats.absent}</div>
          <div class="stat-change">Marked missing</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unmarked</div>
          <div class="stat-value text-muted">${stats.unmarked}</div>
          <div class="stat-change">Pending verification</div>
        </div>
      </div>
    `;
  },

  // Interactive Live Attendance Table
  renderAttendanceTable(examId, roomId, container, options = {}) {
    if (!container) return;
    const canEdit = options.canEdit !== false;
    container.innerHTML = '<div class="text-xs text-muted">Connecting real-time attendance ledger...</div>';

    // Set up real-time listener on both assignments and attendance
    let usersCache = {};
    let assignmentsCache = {};
    let attendanceCache = {};

    const render = () => {
      let rows = Object.entries(assignmentsCache).map(([asgnId, asgn]) => {
        const student = usersCache[asgn.studentId] || {};
        const att = attendanceCache[asgnId] || { status: 'unmarked' };
        return {
          assignmentId: asgnId,
          studentId: asgn.studentId,
          name: student.name || 'Unknown Student',
          registerNumber: asgn.registerNumber || student.registerNumber || '—',
          seatNumber: asgn.seatNumber || '—',
          roomId: asgn.roomId,
          status: att.status || 'unmarked',
          markedAt: att.markedAt,
          markedBy: att.markedBy
        };
      });

      if (roomId) {
        rows = rows.filter(r => r.roomId === roomId);
      }

      // Sort by seat number
      rows.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

      if (!rows.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="users"></i>
            <h3>No students assigned</h3>
            <p>No student assignments found for this selection.</p>
          </div>
        `;
        createIcons({ nodes: [container] });
        return;
      }

      container.innerHTML = `
        <div class="search-box">
          <i data-lucide="search"></i>
          <input type="text" id="att-search-input" class="form-input" placeholder="Search by student name or register number...">
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Student</th>
                <th>Register No.</th>
                <th>Status</th>
                ${canEdit ? '<th style="text-align:right;">Actions</th>' : ''}
              </tr>
            </thead>
            <tbody id="att-table-body">
              ${rows.map(r => `
                <tr data-student-row="${r.assignmentId}" data-search="${UI.escapeHtml(r.name.toLowerCase() + ' ' + r.registerNumber.toLowerCase())}">
                  <td class="font-semibold mono">${UI.escapeHtml(r.seatNumber)}</td>
                  <td>
                    <div class="font-medium">${UI.escapeHtml(r.name)}</div>
                  </td>
                  <td class="mono text-xs text-muted">${UI.escapeHtml(r.registerNumber)}</td>
                  <td>${UI.statusBadge(r.status)}</td>
                  ${canEdit ? `
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:var(--space-1);">
                        <button class="btn btn-sm ${r.status === 'present' ? 'btn-primary' : 'btn-secondary'}" data-action="present" data-asgn="${r.assignmentId}" title="Mark Present">
                          <i data-lucide="check" style="width:14px;height:14px;"></i> Present
                        </button>
                        <button class="btn btn-sm ${r.status === 'absent' ? 'btn-danger' : 'btn-secondary'}" data-action="absent" data-asgn="${r.assignmentId}" title="Mark Absent">
                          <i data-lucide="x" style="width:14px;height:14px;"></i> Absent
                        </button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      createIcons({ nodes: [container] });

      // Search filtering
      const searchInput = document.getElementById('att-search-input');
      if (searchInput) {
        searchInput.oninput = UI.debounce((e) => {
          const query = e.target.value.toLowerCase().trim();
          document.querySelectorAll('#att-table-body tr').forEach(tr => {
            const str = tr.dataset.search || '';
            tr.style.display = str.includes(query) ? '' : 'none';
          });
        }, 200);
      }

      // Actions click delegation
      if (canEdit) {
        container.querySelectorAll('button[data-action]').forEach(btn => {
          btn.onclick = async () => {
            const asgnId = btn.dataset.asgn;
            const newStatus = btn.dataset.action;
            UI.setLoading(btn, true);
            try {
              await AttendanceHelper.markAttendance(examId, asgnId, newStatus, Auth.getUid());
              UI.toast(`Marked ${newStatus}`, 'success', 2000);
            } catch (err) {
              UI.toast('Failed to mark attendance: ' + err.message, 'error');
            } finally {
              UI.setLoading(btn, false);
            }
          };
        });
      }
    };

    // Load users cache first, then set listeners
    Database.get(DB.users()).then(u => {
      usersCache = u || {};
      const unsubAsgn = Database.listen(DB.assignments(examId), asgns => {
        assignmentsCache = asgns || {};
        render();
      });
      const unsubAtt = Database.listen(DB.attendance(examId), atts => {
        attendanceCache = atts || {};
        render();
      });
      ActiveListeners.add(unsubAsgn);
      ActiveListeners.add(unsubAtt);
    });
  }
};

if (typeof window !== 'undefined') {
  window.AttendanceHelper = AttendanceHelper;
}
