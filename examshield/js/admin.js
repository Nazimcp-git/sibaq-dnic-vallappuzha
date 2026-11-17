// ExamShield — Administrator Module
// Enterprise control center for examination lifecycle, room intelligence, incident command, and attendance monitoring.

const AdminModule = {
  // Main route dispatcher
  async render(page) {
    switch (page) {
      case 'dashboard':
        await this.renderDashboard();
        break;
      case 'exams':
        await this.renderExams();
        break;
      case 'rooms':
        await this.renderRooms();
        break;
      case 'students':
        await this.renderStudents();
        break;
      case 'invigilators':
        await this.renderInvigilators();
        break;
      case 'import':
        CSVImport.renderImportPage(document.getElementById('page-content'));
        break;
      case 'seats':
        await this.renderSeatAllocation();
        break;
      case 'incidents':
        await this.renderIncidentsDashboard();
        break;
      case 'attendance':
        await this.renderAttendanceMonitor();
        break;
      case 'announcements':
        await this.renderAnnouncements();
        break;
      case 'room-control':
        await this.renderRoomControlCenter();
        break;
      case 'reports':
        await this.renderReports();
        break;
      case 'settings':
        await this.renderSettings();
        break;
      default:
        await this.renderDashboard();
    }
  },

  // 1. Dashboard View
  async renderDashboard() {
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);">
          <div>
            <h2>Examination Command Center</h2>
            <div class="page-subtitle">${UI.escapeHtml(settings.institutionName || 'National Examination System')} · Live Operations</div>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-primary btn-sm" onclick="AdminModule.renderNewExamModal()">
              <i data-lucide="plus"></i> New Exam
            </button>
            <button class="btn btn-secondary btn-sm" onclick="AnnouncementsHelper.renderCreateModal(() => AdminModule.renderDashboard())">
              <i data-lucide="megaphone"></i> Broadcast Alert
            </button>
          </div>
        </div>
      </div>

      <!-- Real-Time Metrics Grid -->
      <div class="stats-grid" id="admin-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Examinations</div>
          <div class="stat-value" id="stat-exams-count">—</div>
          <div class="stat-change text-xs">Active schedule</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Exam Rooms</div>
          <div class="stat-value" id="stat-rooms-count">—</div>
          <div class="stat-change text-xs">Supervised venues</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-label">Present Candidates</div>
          <div class="stat-value" id="stat-present-count" style="color:var(--color-green-600);">—</div>
          <div class="stat-change text-xs" id="stat-present-pct">0% confirmed</div>
        </div>
        <div class="stat-card stat-critical">
          <div class="stat-label">Active Incidents</div>
          <div class="stat-value" id="stat-incidents-count" style="color:var(--color-critical);">—</div>
          <div class="stat-change text-xs" id="stat-critical-count">0 critical triage</div>
        </div>
      </div>

      <!-- Quick Action Toolbar -->
      <div class="card mb-6">
        <div class="card-body" style="padding:var(--space-3) var(--space-4);">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;">
            <span class="text-xs uppercase font-bold text-muted" style="margin-right:var(--space-2);">Operational Actions:</span>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/room-control')">
              <i data-lucide="monitor"></i> Room Visualization Center
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/incidents')">
              <i data-lucide="alert-circle"></i> Incident Dashboard
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/attendance')">
              <i data-lucide="clipboard-check"></i> Live Attendance Roll
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/import')">
              <i data-lucide="upload"></i> CSV Bulk Import
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/seats')">
              <i data-lucide="grid-3x3"></i> Allocate Seats
            </button>
          </div>
        </div>
      </div>

      <!-- Main Operational Panels -->
      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-2">
        <!-- Live Incidents Control Panel -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Live Incident Stream</h3>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('admin/incidents')">View Full Dashboard</button>
          </div>
          <div class="card-body" id="admin-incidents-stream">
            <div class="text-xs text-muted">Listening for emergency reports...</div>
          </div>
        </div>

        <!-- Room Status & Readiness Overview -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Room Readiness Overview</h3>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('admin/room-control')">Visual Floor Plan</button>
          </div>
          <div class="card-body" id="admin-rooms-overview">
            <div class="text-xs text-muted">Calculating room readiness...</div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    // Set up listeners for real-time counts
    const unsubExams = Database.listen(DB.exams(), exams => {
      const el = document.getElementById('stat-exams-count');
      if (el) el.textContent = Object.keys(exams || {}).length;
    });

    const unsubRooms = Database.listen(DB.rooms(), async (rooms) => {
      const el = document.getElementById('stat-rooms-count');
      if (el) el.textContent = Object.keys(rooms || {}).length;

      // Render room readiness overview
      const overviewContainer = document.getElementById('admin-rooms-overview');
      if (overviewContainer && rooms) {
        const roomsList = Object.entries(rooms).map(([id, val]) => ({ id, ...val }));
        const checklists = await Database.get(DB.ref('roomChecklists')) || {};

        overviewContainer.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:var(--space-3);">
            ${roomsList.map(rm => {
          const cl = checklists[rm.id] || {};
          const score = ReadinessCalc.calculate(cl);
          return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);">
                  <div>
                    <span class="font-bold text-sm">Room ${UI.escapeHtml(rm.name)}</span>
                    <span class="text-xs text-muted ml-2">${UI.escapeHtml(rm.building || 'Main Block')}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:var(--space-3);">
                    <div style="width:100px;">
                      <div class="progress-bar">
                        <div class="progress-fill ${score < 50 ? 'low' : ''}" style="width:${score}%;"></div>
                      </div>
                    </div>
                    <span class="mono text-xs font-bold" style="min-width:36px;text-align:right;">${score}%</span>
                    ${UI.statusBadge(rm.status || ReadinessCalc.getStatus(score))}
                  </div>
                </div>
              `;
        }).join('')}
          </div>
        `;
      }
    });

    const unsubAtt = Database.listen(DB.attendance(activeExamId), async () => {
      const stats = await AttendanceHelper.getAttendanceStats(activeExamId);
      const elPres = document.getElementById('stat-present-count');
      const elPct = document.getElementById('stat-present-pct');
      if (elPres) elPres.textContent = stats.present;
      if (elPct) elPct.textContent = `${stats.percentage}% confirmed (${stats.absent} absent)`;
    });

    const unsubInc = Database.listen(DB.incidents(), (incidentsMap) => {
      const allIncidents = Object.entries(incidentsMap || {}).map(([id, val]) => ({ id, ...val }));
      const active = allIncidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
      const criticalCount = active.filter(i => i.priority === 'critical').length;

      const elCount = document.getElementById('stat-incidents-count');
      const elCrit = document.getElementById('stat-critical-count');
      if (elCount) elCount.textContent = active.length;
      if (elCrit) elCrit.textContent = `${criticalCount} critical alerts`;

      // Live incident stream
      const streamContainer = document.getElementById('admin-incidents-stream');
      if (streamContainer) {
        if (!active.length) {
          streamContainer.innerHTML = '<p class="text-xs text-muted">No unresolved incidents at this time.</p>';
        } else {
          PriorityEngine.sortIncidents(active);
          streamContainer.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:var(--space-2);">
              ${active.slice(0, 5).map(inc => `
                <div class="incident-card priority-${inc.priority}" style="margin-bottom:0;cursor:pointer;" onclick="IncidentsHelper.renderIncidentDetail('${inc.id}')">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <span class="font-bold text-xs">${UI.escapeHtml(INCIDENT_CATEGORIES[inc.category] || inc.category)}</span>
                      <span class="text-xs text-muted ml-2">Room: ${UI.escapeHtml(inc.roomId || '—')}</span>
                    </div>
                    <div style="display:flex;gap:var(--space-1);">
                      ${UI.priorityBadge(inc.priority)}
                      ${UI.statusBadge(inc.status)}
                    </div>
                  </div>
                  <p class="text-xs text-muted truncate mt-1">${UI.escapeHtml(inc.description)}</p>
                </div>
              `).join('')}
            </div>
          `;
        }
      }
    });

    ActiveListeners.add(unsubExams);
    ActiveListeners.add(unsubRooms);
    ActiveListeners.add(unsubAtt);
    ActiveListeners.add(unsubInc);
  },

  // 2. Examination Management View
  async renderExams() {
    const exams = await Database.getList(DB.exams());
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId;

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Examination Schedules</h2>
            <div class="page-subtitle">Configure examination papers, target cohort classes, active sessions, and time slots</div>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderClassManagementModal()">
              <i data-lucide="layers"></i> Manage Classes
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminModule.renderNewExamModal()">
              <i data-lucide="plus"></i> Create Examination
            </button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title / Subject</th>
              <th>Target Classes</th>
              <th>Date</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Active Session</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${exams.map(ex => {
              const targetCls = (ex.targetClasses && ex.targetClasses.length && !ex.targetClasses.includes('all'))
                ? ex.targetClasses
                : null;

              return `
                <tr>
                  <td class="font-semibold">${UI.escapeHtml(ex.title)}</td>
                  <td>
                    ${targetCls
                      ? targetCls.map(c => `<span class="badge badge-normal text-xs mono" style="margin:2px 1px;">Class ${UI.escapeHtml(c)}</span>`).join('')
                      : '<span class="badge badge-muted text-xs">All Classes</span>'}
                  </td>
                  <td>${UI.formatDate(ex.date)}</td>
                  <td class="mono text-xs">${ex.startTime} – ${ex.endTime}</td>
                  <td>${UI.statusBadge(ex.status || 'scheduled')}</td>
                  <td>
                    ${ex.id === activeExamId
                      ? '<span class="badge badge-success">ACTIVE SESSION</span>'
                      : `<button class="btn btn-secondary btn-sm" onclick="AdminModule.setActiveExam('${ex.id}')">Make Active</button>`}
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:var(--space-1);">
                      <button class="btn btn-ghost btn-sm" title="Edit Schedule & Target Classes" onclick="AdminModule.renderEditExamModal('${ex.id}')">
                        <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" title="Delete Examination" style="color:var(--color-critical);" onclick="AdminModule.deleteExam('${ex.id}', '${UI.escapeHtml(ex.title)}')">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    UI.renderPage(html);
  },

  // Modal: Create new exam with Target Classes selection
  async renderNewExamModal() {
    const classes = await ClassHelper.getAllClasses();

    const modalHtml = `
      <form id="new-exam-form">
        <div class="form-group">
          <label class="form-label">Subject / Title <span class="required">*</span></label>
          <input type="text" id="exam-title" class="form-input" placeholder="e.g. CS301 — Data Structures & Algorithms" required>
        </div>

        <!-- Target Classes Multi-Selection -->
        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1);">
            <label class="form-label mb-0">Designated Target Classes / Batches <span class="required">*</span></label>
            <button type="button" class="btn btn-ghost btn-xs" id="btn-toggle-quick-class" style="color:var(--color-green-700);font-weight:600;">
              <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> + New Class
            </button>
          </div>
          <div class="text-xs text-muted mb-2">Select one or more classes eligible for this exam. Seat allocation will only assign candidates from the checked classes.</div>

          <!-- Quick Add Class Panel -->
          <div id="quick-class-panel" style="display:none;background:var(--color-off-white);padding:var(--space-2);border-radius:var(--radius-sm);border:1px dashed var(--border-color);margin-bottom:var(--space-2);">
            <div style="display:flex;gap:var(--space-2);align-items:center;">
              <input type="text" id="quick-class-code" class="form-input text-xs mono" placeholder="Enter new class (e.g. 10-C, CS-302)" style="padding:4px 8px;flex:1;">
              <button type="button" class="btn btn-primary btn-xs" id="btn-save-quick-class">Add Class</button>
              <button type="button" class="btn btn-secondary btn-xs" id="btn-close-quick-class">Cancel</button>
            </div>
          </div>

          <!-- Quick Action Buttons & Live Summary -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);flex-wrap:wrap;gap:var(--space-1);">
            <div class="text-xs" id="exam-class-summary-text">Target: <span class="badge badge-success text-xs">All Classes (Open Campus)</span></div>
            <div style="display:flex;gap:var(--space-1);">
              <button type="button" class="btn btn-ghost btn-xs text-xs" id="btn-select-all-classes">Select All</button>
              <button type="button" class="btn btn-ghost btn-xs text-xs" id="btn-clear-classes">Clear / Open All</button>
            </div>
          </div>

          <!-- Checkboxes Container -->
          <div style="background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);max-height:190px;overflow-y:auto;" id="exam-classes-container">
            <label style="display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-weight:600;font-size:var(--text-xs);border-bottom:1px solid var(--border-color);margin-bottom:6px;cursor:pointer;background:#fff;border-radius:var(--radius-sm);">
              <input type="checkbox" id="exam-class-all" checked>
              <span>All Classes <span class="text-muted font-normal">(Open Campus Examination)</span></span>
            </label>
            <div id="exam-specific-classes-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);">
              ${classes.map(c => `
                <label class="class-card-item" style="display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-size:var(--text-xs);cursor:pointer;background:#fff;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);transition:all 0.2s ease;">
                  <input type="checkbox" name="exam-target-class" value="${UI.escapeHtml(c.code)}" class="exam-cls-chk">
                  <div>
                    <span class="font-bold mono">Class ${UI.escapeHtml(c.code)}</span>
                    <div class="text-muted" style="font-size:10px;">${UI.escapeHtml(c.name || 'Class Batch ' + c.code)}</div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Date <span class="required">*</span></label>
          <input type="date" id="exam-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Start Time <span class="required">*</span></label>
            <input type="time" id="exam-start" class="form-input" value="10:00" required>
          </div>
          <div class="form-group">
            <label class="form-label">End Time <span class="required">*</span></label>
            <input type="time" id="exam-end" class="form-input" value="13:00" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Operational Status</label>
          <select id="exam-status" class="form-select">
            <option value="active">Active (Ongoing Examination)</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-exam">Create Examination</button>
        </div>
      </form>
    `;

    UI.showModal('Create Examination Schedule', modalHtml);

    // Multi-class Selection & Toggle Logic
    const chkAll = document.getElementById('exam-class-all');
    const summaryText = document.getElementById('exam-class-summary-text');
    const grid = document.getElementById('exam-specific-classes-grid');

    const updateClassSummary = () => {
      const checkedChks = Array.from(grid.querySelectorAll('.exam-cls-chk:checked'));
      if (chkAll.checked || checkedChks.length === 0) {
        chkAll.checked = true;
        summaryText.innerHTML = `Target: <span class="badge badge-success text-xs">All Classes (Open Campus)</span>`;
      } else {
        const codes = checkedChks.map(c => c.value);
        summaryText.innerHTML = `Target: <span class="badge badge-outline text-xs" style="background:#fff;font-weight:bold;">${codes.length} Classes Selected</span> (${codes.join(', ')})`;
      }

      grid.querySelectorAll('.class-card-item').forEach(card => {
        const chk = card.querySelector('.exam-cls-chk');
        if (chk && chk.checked) {
          card.style.borderColor = 'var(--color-green-600)';
          card.style.background = '#f0fdf4';
        } else {
          card.style.borderColor = 'var(--border-subtle)';
          card.style.background = '#fff';
        }
      });
    };

    chkAll.onchange = () => {
      if (chkAll.checked) {
        grid.querySelectorAll('.exam-cls-chk').forEach(c => c.checked = false);
      }
      updateClassSummary();
    };

    const attachCheckboxListeners = () => {
      grid.querySelectorAll('.exam-cls-chk').forEach(chk => {
        chk.onchange = () => {
          if (chk.checked) chkAll.checked = false;
          updateClassSummary();
        };
      });
    };
    attachCheckboxListeners();

    document.getElementById('btn-select-all-classes').onclick = () => {
      chkAll.checked = false;
      grid.querySelectorAll('.exam-cls-chk').forEach(c => c.checked = true);
      updateClassSummary();
    };

    document.getElementById('btn-clear-classes').onclick = () => {
      chkAll.checked = true;
      grid.querySelectorAll('.exam-cls-chk').forEach(c => c.checked = false);
      updateClassSummary();
    };

    // Quick Add Class inline
    const quickPanel = document.getElementById('quick-class-panel');
    document.getElementById('btn-toggle-quick-class').onclick = () => {
      quickPanel.style.display = quickPanel.style.display === 'none' ? 'block' : 'none';
      if (quickPanel.style.display === 'block') {
        document.getElementById('quick-class-code').focus();
      }
    };
    document.getElementById('btn-close-quick-class').onclick = () => {
      quickPanel.style.display = 'none';
    };

    document.getElementById('btn-save-quick-class').onclick = async () => {
      const codeInput = document.getElementById('quick-class-code');
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return;

      await ClassHelper.addClass(code);
      UI.toast(`Class ${code} registered!`, 'success');
      codeInput.value = '';
      quickPanel.style.display = 'none';

      // Check if already in grid
      let existingCard = Array.from(grid.querySelectorAll('.exam-cls-chk')).find(c => c.value === code);
      if (existingCard) {
        existingCard.checked = true;
      } else {
        const newCard = document.createElement('label');
        newCard.className = 'class-card-item';
        newCard.style = 'display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-size:var(--text-xs);cursor:pointer;background:#f0fdf4;border:1px solid var(--color-green-600);border-radius:var(--radius-sm);';
        newCard.innerHTML = `
          <input type="checkbox" name="exam-target-class" value="${UI.escapeHtml(code)}" class="exam-cls-chk" checked>
          <div>
            <span class="font-bold mono">Class ${UI.escapeHtml(code)}</span>
            <div class="text-muted" style="font-size:10px;">Class Batch ${UI.escapeHtml(code)}</div>
          </div>
        `;
        grid.appendChild(newCard);
        attachCheckboxListeners();
      }

      chkAll.checked = false;
      updateClassSummary();
    };

    document.getElementById('new-exam-form').onsubmit = async (e) => {
      e.preventDefault();
      const examId = generateId('exam');

      // Determine target classes
      let targetClasses = ['all'];
      if (!chkAll.checked) {
        const checkedValues = Array.from(grid.querySelectorAll('.exam-cls-chk:checked')).map(c => c.value.trim());
        if (checkedValues.length > 0) {
          targetClasses = checkedValues;
        }
      }

      const record = {
        id: examId,
        title: document.getElementById('exam-title').value.trim(),
        date: document.getElementById('exam-date').value,
        startTime: document.getElementById('exam-start').value,
        endTime: document.getElementById('exam-end').value,
        status: document.getElementById('exam-status').value,
        targetClasses: targetClasses,
        createdAt: DB.serverTimestamp()
      };

      await Database.set(DB.exam(examId), record);
      if (record.status === 'active') {
        await Database.update(DB.settings(), { activeExamId: examId });
      }

      UI.closeModal();
      UI.toast(`Examination created designated for ${targetClasses.includes('all') ? 'All Classes' : targetClasses.join(', ')}!`, 'success');
      AdminModule.renderExams();
    };
  },

  // Modal: Edit existing exam and modify designated target classes
  async renderEditExamModal(examId) {
    const exam = await Database.get(DB.exam(examId));
    if (!exam) return;

    const classes = await ClassHelper.getAllClasses();
    const existingTargets = exam.targetClasses || ['all'];
    const isAll = existingTargets.includes('all');

    const modalHtml = `
      <form id="edit-exam-form">
        <div class="form-group">
          <label class="form-label">Subject / Title <span class="required">*</span></label>
          <input type="text" id="edit-exam-title" class="form-input" value="${UI.escapeHtml(exam.title || '')}" required>
        </div>

        <!-- Target Classes Multi-Selection -->
        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1);">
            <label class="form-label mb-0">Designated Target Classes / Batches <span class="required">*</span></label>
            <button type="button" class="btn btn-ghost btn-xs" id="btn-edit-toggle-quick-class" style="color:var(--color-green-700);font-weight:600;">
              <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> + New Class
            </button>
          </div>
          <div class="text-xs text-muted mb-2">Select one or more classes eligible for this exam. Seat allocation will only assign candidates from the checked classes.</div>

          <!-- Quick Add Class Panel -->
          <div id="edit-quick-class-panel" style="display:none;background:var(--color-off-white);padding:var(--space-2);border-radius:var(--radius-sm);border:1px dashed var(--border-color);margin-bottom:var(--space-2);">
            <div style="display:flex;gap:var(--space-2);align-items:center;">
              <input type="text" id="edit-quick-class-code" class="form-input text-xs mono" placeholder="Enter new class (e.g. 10-C, CS-302)" style="padding:4px 8px;flex:1;">
              <button type="button" class="btn btn-primary btn-xs" id="btn-edit-save-quick-class">Add Class</button>
              <button type="button" class="btn btn-secondary btn-xs" id="btn-edit-close-quick-class">Cancel</button>
            </div>
          </div>

          <!-- Quick Action Buttons & Live Summary -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);flex-wrap:wrap;gap:var(--space-1);">
            <div class="text-xs" id="edit-exam-class-summary-text">Target: <span class="badge badge-success text-xs">All Classes (Open Campus)</span></div>
            <div style="display:flex;gap:var(--space-1);">
              <button type="button" class="btn btn-ghost btn-xs text-xs" id="btn-edit-select-all-classes">Select All</button>
              <button type="button" class="btn btn-ghost btn-xs text-xs" id="btn-edit-clear-classes">Clear / Open All</button>
            </div>
          </div>

          <!-- Checkboxes Container -->
          <div style="background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);max-height:190px;overflow-y:auto;" id="edit-exam-classes-container">
            <label style="display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-weight:600;font-size:var(--text-xs);border-bottom:1px solid var(--border-color);margin-bottom:6px;cursor:pointer;background:#fff;border-radius:var(--radius-sm);">
              <input type="checkbox" id="edit-exam-class-all" ${isAll ? 'checked' : ''}>
              <span>All Classes <span class="text-muted font-normal">(Open Campus Examination)</span></span>
            </label>
            <div id="edit-exam-specific-classes-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);">
              ${classes.map(c => {
                const isChecked = !isAll && existingTargets.includes(c.code);
                return `
                  <label class="class-card-item" style="display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-size:var(--text-xs);cursor:pointer;background:${isChecked ? '#f0fdf4' : '#fff'};border:1px solid ${isChecked ? 'var(--color-green-600)' : 'var(--border-subtle)'};border-radius:var(--radius-sm);transition:all 0.2s ease;">
                    <input type="checkbox" name="edit-exam-target-class" value="${UI.escapeHtml(c.code)}" class="edit-exam-cls-chk" ${isChecked ? 'checked' : ''}>
                    <div>
                      <span class="font-bold mono">Class ${UI.escapeHtml(c.code)}</span>
                      <div class="text-muted" style="font-size:10px;">${UI.escapeHtml(c.name || 'Class Batch ' + c.code)}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Date <span class="required">*</span></label>
          <input type="date" id="edit-exam-date" class="form-input" required value="${exam.date || ''}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Start Time <span class="required">*</span></label>
            <input type="time" id="edit-exam-start" class="form-input" value="${exam.startTime || '10:00'}" required>
          </div>
          <div class="form-group">
            <label class="form-label">End Time <span class="required">*</span></label>
            <input type="time" id="edit-exam-end" class="form-input" value="${exam.endTime || '13:00'}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Operational Status</label>
          <select id="edit-exam-status" class="form-select">
            <option value="active" ${exam.status === 'active' ? 'selected' : ''}>Active (Ongoing Examination)</option>
            <option value="scheduled" ${exam.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="completed" ${exam.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;

    UI.showModal(`Edit Examination: ${exam.title}`, modalHtml);

    // Multi-class Selection & Toggle Logic
    const chkAll = document.getElementById('edit-exam-class-all');
    const summaryText = document.getElementById('edit-exam-class-summary-text');
    const grid = document.getElementById('edit-exam-specific-classes-grid');

    const updateClassSummary = () => {
      const checkedChks = Array.from(grid.querySelectorAll('.edit-exam-cls-chk:checked'));
      if (chkAll.checked || checkedChks.length === 0) {
        chkAll.checked = true;
        summaryText.innerHTML = `Target: <span class="badge badge-success text-xs">All Classes (Open Campus)</span>`;
      } else {
        const codes = checkedChks.map(c => c.value);
        summaryText.innerHTML = `Target: <span class="badge badge-outline text-xs" style="background:#fff;font-weight:bold;">${codes.length} Classes Selected</span> (${codes.join(', ')})`;
      }

      grid.querySelectorAll('.class-card-item').forEach(card => {
        const chk = card.querySelector('.edit-exam-cls-chk');
        if (chk && chk.checked) {
          card.style.borderColor = 'var(--color-green-600)';
          card.style.background = '#f0fdf4';
        } else {
          card.style.borderColor = 'var(--border-subtle)';
          card.style.background = '#fff';
        }
      });
    };

    updateClassSummary();

    chkAll.onchange = () => {
      if (chkAll.checked) {
        grid.querySelectorAll('.edit-exam-cls-chk').forEach(c => c.checked = false);
      }
      updateClassSummary();
    };

    const attachEditCheckboxListeners = () => {
      grid.querySelectorAll('.edit-exam-cls-chk').forEach(chk => {
        chk.onchange = () => {
          if (chk.checked) chkAll.checked = false;
          updateClassSummary();
        };
      });
    };
    attachEditCheckboxListeners();

    document.getElementById('btn-edit-select-all-classes').onclick = () => {
      chkAll.checked = false;
      grid.querySelectorAll('.edit-exam-cls-chk').forEach(c => c.checked = true);
      updateClassSummary();
    };

    document.getElementById('btn-edit-clear-classes').onclick = () => {
      chkAll.checked = true;
      grid.querySelectorAll('.edit-exam-cls-chk').forEach(c => c.checked = false);
      updateClassSummary();
    };

    // Quick Add Class inline
    const quickPanel = document.getElementById('edit-quick-class-panel');
    document.getElementById('btn-edit-toggle-quick-class').onclick = () => {
      quickPanel.style.display = quickPanel.style.display === 'none' ? 'block' : 'none';
      if (quickPanel.style.display === 'block') {
        document.getElementById('edit-quick-class-code').focus();
      }
    };
    document.getElementById('btn-edit-close-quick-class').onclick = () => {
      quickPanel.style.display = 'none';
    };

    document.getElementById('btn-edit-save-quick-class').onclick = async () => {
      const codeInput = document.getElementById('edit-quick-class-code');
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return;

      await ClassHelper.addClass(code);
      UI.toast(`Class ${code} registered!`, 'success');
      codeInput.value = '';
      quickPanel.style.display = 'none';

      let existingCard = Array.from(grid.querySelectorAll('.edit-exam-cls-chk')).find(c => c.value === code);
      if (existingCard) {
        existingCard.checked = true;
      } else {
        const newCard = document.createElement('label');
        newCard.className = 'class-card-item';
        newCard.style = 'display:flex;align-items:center;gap:var(--space-2);padding:6px 8px;font-size:var(--text-xs);cursor:pointer;background:#f0fdf4;border:1px solid var(--color-green-600);border-radius:var(--radius-sm);';
        newCard.innerHTML = `
          <input type="checkbox" name="edit-exam-target-class" value="${UI.escapeHtml(code)}" class="edit-exam-cls-chk" checked>
          <div>
            <span class="font-bold mono">Class ${UI.escapeHtml(code)}</span>
            <div class="text-muted" style="font-size:10px;">Class Batch ${UI.escapeHtml(code)}</div>
          </div>
        `;
        grid.appendChild(newCard);
        attachEditCheckboxListeners();
      }

      chkAll.checked = false;
      updateClassSummary();
    };

    document.getElementById('edit-exam-form').onsubmit = async (e) => {
      e.preventDefault();

      let targetClasses = ['all'];
      if (!chkAll.checked) {
        const checkedValues = Array.from(grid.querySelectorAll('.edit-exam-cls-chk:checked')).map(c => c.value.trim());
        if (checkedValues.length > 0) {
          targetClasses = checkedValues;
        }
      }

      const updates = {
        title: document.getElementById('edit-exam-title').value.trim(),
        date: document.getElementById('edit-exam-date').value,
        startTime: document.getElementById('edit-exam-start').value,
        endTime: document.getElementById('edit-exam-end').value,
        status: document.getElementById('edit-exam-status').value,
        targetClasses: targetClasses,
        updatedAt: DB.serverTimestamp()
      };

      await Database.update(DB.exam(examId), updates);

      if (updates.status === 'active') {
        await Database.update(DB.settings(), { activeExamId: examId });
      }

      UI.closeModal();
      UI.toast('Examination schedule and target classes updated!', 'success');
      AdminModule.renderExams();
    };
  },

  // Delete Exam
  deleteExam(examId, title) {
    UI.confirm(
      'Delete Examination',
      `Permanently delete examination "${title}" and its associated room seat allocations?`,
      async () => {
        await Database.remove(DB.exam(examId));
        await Database.remove(DB.assignments(examId));
        await Database.remove(DB.attendance(examId));
        UI.toast(`Examination "${title}" deleted`, 'info');
        AdminModule.renderExams();
      },
      'Delete Exam',
      true
    );
  },

  async setActiveExam(examId) {
    await Database.update(DB.settings(), { activeExamId: examId });
    UI.toast('Active examination updated', 'success');
    AdminModule.renderExams();
  },

  // 3. Room Management View
  async renderRooms() {
    const rooms = await Database.getList(DB.rooms());
    const users = await Database.getList(DB.users());
    const invigilators = users.filter(u => u.role === 'invigilator');

    const invigMap = new Map();
    invigilators.forEach(inv => invigMap.set(inv.id, inv.name));

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Examination Rooms & Venues</h2>
            <div class="page-subtitle">Configure seating matrix dimensions, buildings, and invigilator assignment</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminModule.renderNewRoomModal()">
            <i data-lucide="plus"></i> Add Room
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Room Name</th>
              <th>Building & Block</th>
              <th>Grid (Rows × Cols)</th>
              <th>Capacity</th>
              <th>Assigned Invigilator</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rooms.map(rm => `
              <tr>
                <td class="font-bold">Room ${UI.escapeHtml(rm.name)}</td>
                <td>${UI.escapeHtml(rm.building || 'Main Block')} (Block ${UI.escapeHtml(rm.block || 'A')})</td>
                <td class="mono text-xs">${rm.rows || 5} × ${rm.columns || 6}</td>
                <td class="mono font-semibold">${rm.capacity || (rm.rows * rm.columns)} Desks</td>
                <td>${rm.invigilatorId ? (invigMap.get(rm.invigilatorId) || rm.invigilatorId) : '<span class="text-muted">Unassigned</span>'}</td>
                <td>${UI.statusBadge(rm.status || 'Ready')}</td>
                <td style="text-align:right;">
                  <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderAssignInvigilatorModal('${rm.id}')">
                    Assign Faculty
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    UI.renderPage(html);
  },

  // Modal: Add Room
  renderNewRoomModal() {
    const modalHtml = `
      <form id="new-room-form">
        <div class="form-group">
          <label class="form-label">Room Identifier / Number <span class="required">*</span></label>
          <input type="text" id="rm-name" class="form-input" placeholder="e.g. A-101" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Building Name</label>
            <input type="text" id="rm-building" class="form-input" placeholder="Academic Block A" value="Academic Block A">
          </div>
          <div class="form-group">
            <label class="form-label">Block Code</label>
            <input type="text" id="rm-block" class="form-input" placeholder="A" value="A">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Rows</label>
            <input type="number" id="rm-rows" class="form-input" value="5" min="1" max="20" required>
          </div>
          <div class="form-group">
            <label class="form-label">Columns</label>
            <input type="number" id="rm-cols" class="form-input" value="6" min="1" max="20" required>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Room</button>
        </div>
      </form>
    `;

    UI.showModal('Create Examination Room', modalHtml);

    document.getElementById('new-room-form').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('rm-name').value.trim();
      const rows = parseInt(document.getElementById('rm-rows').value) || 5;
      const cols = parseInt(document.getElementById('rm-cols').value) || 6;
      const roomId = 'room_' + name.replace(/[^a-zA-Z0-9]/g, '');

      await Database.set(DB.room(roomId), {
        id: roomId,
        name: name,
        building: document.getElementById('rm-building').value.trim(),
        block: document.getElementById('rm-block').value.trim(),
        rows: rows,
        columns: cols,
        capacity: rows * cols,
        status: 'not-ready',
        invigilatorId: '',
        floorPlanPosition: { x: 5, y: 5, width: 42, height: 40 },
        createdAt: DB.serverTimestamp(),
        updatedAt: DB.serverTimestamp()
      });

      UI.closeModal();
      UI.toast(`Room ${name} created`, 'success');
      AdminModule.renderRooms();
    };
  },

  // Modal: Assign Invigilator to Room
  async renderAssignInvigilatorModal(roomId) {
    const room = await Database.get(DB.room(roomId));
    const users = await Database.getList(DB.users());
    const invigilators = users.filter(u => u.role === 'invigilator');

    const modalHtml = `
      <form id="assign-inv-form">
        <p class="text-sm mb-4">Assign a faculty invigilator to supervise <strong>Room ${UI.escapeHtml(room.name)}</strong>.</p>
        <div class="form-group">
          <label class="form-label">Select Invigilator</label>
          <select id="select-inv-id" class="form-select">
            <option value="">-- Remove Invigilator --</option>
            ${invigilators.map(inv => `
              <option value="${inv.id}" ${inv.id === room.invigilatorId ? 'selected' : ''}>
                ${UI.escapeHtml(inv.name)} (${UI.escapeHtml(inv.email)})
              </option>
            `).join('')}
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Assignment</button>
        </div>
      </form>
    `;

    UI.showModal(`Assign Invigilator: Room ${room.name}`, modalHtml);

    document.getElementById('assign-inv-form').onsubmit = async (e) => {
      e.preventDefault();
      const newInvId = document.getElementById('select-inv-id').value;

      await Database.update(DB.room(roomId), {
        invigilatorId: newInvId,
        updatedAt: DB.serverTimestamp()
      });

      if (newInvId) {
        await Database.update(DB.invigilator(newInvId), {
          available: true,
          ['assignedRooms/' + roomId]: true
        });
      }

      UI.closeModal();
      UI.toast('Room invigilator assignment updated', 'success');
      AdminModule.renderRooms();
    };
  },

  // 4. Student Management View (Full CRUD, Class Assignment, Bulk Actions)
  selectedStudentUids: new Set(),
  activeStudentClassFilter: 'all',

  async renderStudents() {
    this.selectedStudentUids.clear();
    const users = await Database.getList(DB.users());
    const students = users.filter(u => u.role === 'student');

    // Extract unique classes from registered classes and student records
    const registeredClasses = await ClassHelper.getAllClasses();
    const classSet = new Set(registeredClasses.map(c => c.code));
    students.forEach(s => {
      if (s.classId) classSet.add(s.classId.trim());
    });
    const classes = Array.from(classSet).sort();

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Candidate Roster & Class Management</h2>
            <div class="page-subtitle">Enrolled students, class cohort assignments, and batch operations (${students.length} total)</div>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderClassManagementModal()">
              <i data-lucide="layers"></i> Manage Classes
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminModule.renderAddStudentModal()">
              <i data-lucide="user-plus"></i> Add Candidate
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/import')">
              <i data-lucide="upload"></i> Bulk CSV Import
            </button>
          </div>
        </div>
      </div>

      <!-- Class Batch Filter Chips -->
      <div class="filter-bar mb-4">
        <button class="filter-chip ${this.activeStudentClassFilter === 'all' ? 'active' : ''}" data-class="all">
          All Candidates (${students.length})
        </button>
        ${classes.map(c => `
          <button class="filter-chip ${this.activeStudentClassFilter === c ? 'active' : ''}" data-class="${UI.escapeHtml(c)}">
            Class ${UI.escapeHtml(c)} (${students.filter(s => s.classId === c).length})
          </button>
        `).join('')}
      </div>

      <!-- Bulk Actions Bar (Sticky & Dynamic) -->
      <div id="student-bulk-bar" class="card mb-4" style="display:none;background:var(--color-charcoal);color:white;border:none;">
        <div class="card-body" style="padding:var(--space-3) var(--space-4);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);">
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <i data-lucide="check-square" style="width:16px;height:16px;color:var(--color-green-500);"></i>
            <span class="font-bold text-xs" id="bulk-selected-label">0 Selected</span>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm text-xs" onclick="AdminModule.openBulkAssignClassModal()">
              <i data-lucide="layers"></i> Assign to Class Batch
            </button>
            <button class="btn btn-danger btn-sm text-xs" onclick="AdminModule.executeBulkDelete()">
              <i data-lucide="trash-2"></i> Delete Selected
            </button>
            <button class="btn btn-ghost btn-sm text-xs" style="color:white;" onclick="AdminModule.clearStudentSelection()">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="search-box">
        <i data-lucide="search"></i>
        <input type="text" class="form-input" id="student-search-input" placeholder="Search by name, register number, or class batch...">
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">
                <input type="checkbox" id="chk-select-all-students" title="Select all visible">
              </th>
              <th>Candidate Name</th>
              <th>Register Number</th>
              <th>Class / Batch</th>
              <th>Email Address</th>
              <th>Contact Phone</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="student-table-body">
            <!-- Rendered by renderStudentRows -->
          </tbody>
        </table>
      </div>
    `;

    UI.renderPage(html);

    const renderRows = () => {
      const tbody = document.getElementById('student-table-body');
      if (!tbody) return;

      let filtered = students;
      if (this.activeStudentClassFilter !== 'all') {
        filtered = filtered.filter(s => s.classId === this.activeStudentClassFilter);
      }

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-xs text-muted py-6">No candidates found for this selection.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(s => `
        <tr data-uid="${s.id}" data-search="${UI.escapeHtml((s.name + ' ' + (s.registerNumber || '') + ' ' + (s.classId || '') + ' ' + (s.email || '')).toLowerCase())}">
          <td style="text-align:center;">
            <input type="checkbox" class="student-chk" data-uid="${s.id}" ${this.selectedStudentUids.has(s.id) ? 'checked' : ''}>
          </td>
          <td>
            <div class="font-bold text-dark text-sm">${UI.escapeHtml(s.name)}</div>
          </td>
          <td class="mono font-semibold text-xs">${UI.escapeHtml(s.registerNumber || '—')}</td>
          <td>
            <span class="badge badge-normal font-semibold">${UI.escapeHtml(s.classId || 'Unassigned')}</span>
          </td>
          <td class="text-xs text-muted">${UI.escapeHtml(s.email || '—')}</td>
          <td class="text-xs mono">${UI.escapeHtml(s.phone || '—')}</td>
          <td>${s.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
          <td style="text-align:right;">
            <div style="display:inline-flex;gap:var(--space-1);">
              <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderEditStudentModal('${s.id}')" title="Edit candidate">
                <i data-lucide="edit-2" style="width:13px;height:13px;"></i> Edit
              </button>
              <button class="btn btn-ghost btn-sm" style="color:var(--color-critical);" onclick="AdminModule.deleteStudent('${s.id}', '${UI.escapeHtml(s.name)}')" title="Delete candidate">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      lucide.createIcons({ nodes: [tbody] });

      // Checkbox event listeners
      tbody.querySelectorAll('.student-chk').forEach(chk => {
        chk.onchange = () => {
          const uid = chk.dataset.uid;
          if (chk.checked) this.selectedStudentUids.add(uid);
          else this.selectedStudentUids.delete(uid);
          this.updateBulkBar();
        };
      });
    };

    renderRows();

    // Select all checkbox
    const selectAllChk = document.getElementById('chk-select-all-students');
    if (selectAllChk) {
      selectAllChk.onchange = () => {
        const isChecked = selectAllChk.checked;
        document.querySelectorAll('.student-chk').forEach(chk => {
          chk.checked = isChecked;
          const uid = chk.dataset.uid;
          if (isChecked) this.selectedStudentUids.add(uid);
          else this.selectedStudentUids.delete(uid);
        });
        this.updateBulkBar();
      };
    }

    // Class Filter clicks
    document.querySelectorAll('.filter-bar .filter-chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('.filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeStudentClassFilter = chip.dataset.class;
        renderRows();
      };
    });

    // Search input
    document.getElementById('student-search-input').oninput = UI.debounce((e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#student-table-body tr').forEach(tr => {
        const text = tr.dataset.search || '';
        tr.style.display = text.includes(q) ? '' : 'none';
      });
    }, 200);
  },

  updateBulkBar() {
    const bar = document.getElementById('student-bulk-bar');
    const label = document.getElementById('bulk-selected-label');
    const count = this.selectedStudentUids.size;

    if (count > 0) {
      if (bar) bar.style.display = 'block';
      if (label) label.textContent = `${count} Candidate(s) Selected`;
    } else {
      if (bar) bar.style.display = 'none';
    }
  },

  clearStudentSelection() {
    this.selectedStudentUids.clear();
    document.querySelectorAll('.student-chk').forEach(c => c.checked = false);
    const selectAll = document.getElementById('chk-select-all-students');
    if (selectAll) selectAll.checked = false;
    this.updateBulkBar();
  },

  // Modal: Academic Class & Cohort Management
  async renderClassManagementModal() {
    const classes = await ClassHelper.getAllClasses();
    const users = await Database.getList(DB.users());
    const students = users.filter(u => u.role === 'student');

    const classCountMap = {};
    students.forEach(s => {
      const c = (s.classId || 'UNASSIGNED').trim().toUpperCase();
      classCountMap[c] = (classCountMap[c] || 0) + 1;
    });

    const modalHtml = `
      <div id="class-management-wrapper">
        <div class="card mb-4" style="background:var(--color-off-white);border:1px solid var(--border-subtle);">
          <div class="card-body p-3">
            <h4 class="font-bold text-xs uppercase text-muted mb-2">Create New Academic Class / Cohort</h4>
            <form id="form-create-class" style="display:grid;grid-template-columns:1fr 1fr auto;gap:var(--space-2);align-items:flex-end;">
              <div>
                <label class="form-label text-xs">Class Code <span class="required">*</span></label>
                <input type="text" id="new-class-code" class="form-input text-xs mono" placeholder="e.g. CS-101, 10-A, 12-BIO" required>
              </div>
              <div>
                <label class="form-label text-xs">Class / Course Title</label>
                <input type="text" id="new-class-name" class="form-input text-xs" placeholder="e.g. Computer Science Section A">
              </div>
              <button type="submit" class="btn btn-primary btn-sm text-xs">
                <i data-lucide="plus"></i> Add Class
              </button>
            </form>
          </div>
        </div>

        <div class="table-container" style="max-height:300px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Class Code</th>
                <th>Description / Title</th>
                <th>Department</th>
                <th>Enrolled Candidates</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${classes.map(c => `
                <tr>
                  <td class="font-bold mono text-sm" style="color:var(--color-green-700);">${UI.escapeHtml(c.code)}</td>
                  <td class="font-semibold text-xs">${UI.escapeHtml(c.name || 'Class Batch ' + c.code)}</td>
                  <td class="text-xs text-muted">${UI.escapeHtml(c.department || 'General Academics')}</td>
                  <td class="mono font-semibold text-xs">${classCountMap[c.code.toUpperCase()] || 0} Students</td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost btn-sm text-xs" onclick="AdminModule.deleteClass('${c.id}', '${UI.escapeHtml(c.code)}')" style="color:var(--color-critical);">
                      <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    UI.showModal('Academic Class & Cohort Management', modalHtml);

    document.getElementById('form-create-class').onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById('new-class-code').value.trim();
      const name = document.getElementById('new-class-name').value.trim();
      if (!code) return;

      await ClassHelper.addClass(code, name);
      UI.toast(`Class ${code.toUpperCase()} registered successfully!`, 'success');
      UI.closeModal();
      AdminModule.renderStudents();
    };
  },

  deleteClass(id, code) {
    UI.confirm(
      'Delete Class',
      `Delete class "${code}" from available batches? (Existing students assigned to this class will retain their class code).`,
      async () => {
        await ClassHelper.removeClass(id);
        UI.toast(`Class ${code} removed`, 'info');
        UI.closeModal();
        AdminModule.renderStudents();
      },
      'Delete Class',
      true
    );
  },

  // Modal: Add New Student Candidate with Class Dropdown
  async renderAddStudentModal() {
    const classOptionsHtml = await ClassHelper.renderClassOptions('', { allowAdd: true });

    const modalHtml = `
      <form id="add-student-form">
        <div class="form-group">
          <label class="form-label text-xs">Full Legal Name <span class="required">*</span></label>
          <input type="text" id="add-std-name" class="form-input text-sm" placeholder="e.g. Rahul Sharma" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Register Number <span class="required">*</span></label>
            <input type="text" id="add-std-reg" class="form-input text-sm mono" placeholder="e.g. REG2024099" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Class / Cohort Batch <span class="required">*</span></label>
            <select id="add-std-class" class="form-select text-sm" required>
              ${classOptionsHtml}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Email Address <span class="required">*</span></label>
            <input type="email" id="add-std-email" class="form-input text-sm" placeholder="rahul@examshield.in" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Contact Phone Number</label>
            <input type="tel" id="add-std-phone" class="form-input text-sm" placeholder="9876543210">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label text-xs">Initial Account Password</label>
          <input type="text" id="add-std-password" class="form-input text-sm mono" value="demo123456" minlength="6">
          <div class="form-hint">Default password is set to demo123456</div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-new-std">Create Candidate</button>
        </div>
      </form>
    `;

    UI.showModal('Add Student Candidate', modalHtml);

    // Handle '+ Add New Class...' in dropdown
    const classSelect = document.getElementById('add-std-class');
    classSelect.onchange = async () => {
      if (classSelect.value === '__new__') {
        const newCode = prompt('Enter new Class Code (e.g. CS-103, 10-C):');
        if (newCode && newCode.trim()) {
          const rec = await ClassHelper.addClass(newCode.trim());
          const newOpt = document.createElement('option');
          newOpt.value = rec.code;
          newOpt.textContent = `Class ${rec.code} — ${rec.name}`;
          newOpt.selected = true;
          classSelect.insertBefore(newOpt, classSelect.lastElementChild);
        } else {
          classSelect.value = '';
        }
      }
    };

    document.getElementById('add-student-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-new-std');
      UI.setLoading(btn, true);

      const name = document.getElementById('add-std-name').value.trim();
      const reg = document.getElementById('add-std-reg').value.trim();
      const classId = document.getElementById('add-std-class').value.trim();
      const email = document.getElementById('add-std-email').value.trim().toLowerCase();
      const phone = document.getElementById('add-std-phone').value.trim();
      const password = document.getElementById('add-std-password').value;

      try {
        let uid = 'student_' + generateId();
        // Optional Auth creation
        try {
          const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
          uid = cred.user.uid;
        } catch (authErr) {
          console.warn('[Admin] Auth creation fallback:', authErr.message);
        }

        const record = {
          id: uid,
          name,
          registerNumber: reg,
          classId,
          email,
          phone,
          role: 'student',
          active: true,
          createdAt: DB.serverTimestamp()
        };

        await Database.set(DB.user(uid), record);
        UI.closeModal();
        UI.toast(`Candidate ${name} added successfully!`, 'success');
        AdminModule.renderStudents();
      } catch (err) {
        UI.toast('Failed to create candidate: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  },

  // Modal: Edit Student with Dynamic Class Dropdown
  async renderEditStudentModal(uid) {
    const student = await Database.get(DB.user(uid));
    if (!student) return;

    const classOptionsHtml = await ClassHelper.renderClassOptions(student.classId || '', { allowAdd: true });

    const modalHtml = `
      <form id="edit-student-form">
        <div class="form-group">
          <label class="form-label text-xs">Full Legal Name <span class="required">*</span></label>
          <input type="text" id="edit-std-name" class="form-input text-sm" value="${UI.escapeHtml(student.name || '')}" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Register Number <span class="required">*</span></label>
            <input type="text" id="edit-std-reg" class="form-input text-sm mono" value="${UI.escapeHtml(student.registerNumber || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Class / Cohort Batch <span class="required">*</span></label>
            <select id="edit-std-class" class="form-select text-sm" required>
              ${classOptionsHtml}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Email Address</label>
            <input type="email" id="edit-std-email" class="form-input text-sm" value="${UI.escapeHtml(student.email || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Contact Phone</label>
            <input type="tel" id="edit-std-phone" class="form-input text-sm" value="${UI.escapeHtml(student.phone || '')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label text-xs">Candidate Status</label>
          <select id="edit-std-active" class="form-select text-sm">
            <option value="true" ${student.active !== false ? 'selected' : ''}>Active (Permitted for exams)</option>
            <option value="false" ${student.active === false ? 'selected' : ''}>Inactive / Suspended</option>
          </select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-std">Save Changes</button>
        </div>
      </form>
    `;

    UI.showModal(`Edit Candidate: ${student.name}`, modalHtml);

    // Handle '+ Add New Class...' in dropdown
    const classSelect = document.getElementById('edit-std-class');
    classSelect.onchange = async () => {
      if (classSelect.value === '__new__') {
        const newCode = prompt('Enter new Class Code (e.g. CS-103, 10-C):');
        if (newCode && newCode.trim()) {
          const rec = await ClassHelper.addClass(newCode.trim());
          const newOpt = document.createElement('option');
          newOpt.value = rec.code;
          newOpt.textContent = `Class ${rec.code} — ${rec.name}`;
          newOpt.selected = true;
          classSelect.insertBefore(newOpt, classSelect.lastElementChild);
        } else {
          classSelect.value = student.classId || '';
        }
      }
    };

    document.getElementById('edit-student-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-edit-std');
      UI.setLoading(btn, true);

      try {
        const updates = {
          name: document.getElementById('edit-std-name').value.trim(),
          registerNumber: document.getElementById('edit-std-reg').value.trim(),
          classId: document.getElementById('edit-std-class').value.trim(),
          email: document.getElementById('edit-std-email').value.trim(),
          phone: document.getElementById('edit-std-phone').value.trim(),
          active: document.getElementById('edit-std-active').value === 'true',
          updatedAt: DB.serverTimestamp()
        };

        await Database.update(DB.user(uid), updates);
        UI.closeModal();
        UI.toast('Candidate details updated', 'success');
        AdminModule.renderStudents();
      } catch (err) {
        UI.toast('Failed to update: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  },

  // Delete Individual Student
  deleteStudent(uid, name) {
    UI.confirm(
      'Delete Candidate Record',
      `Permanently delete candidate "${name}" from ExamShield? This will also remove any active seat allocation.`,
      async () => {
        try {
          await Database.remove(DB.user(uid));

          // Cleanup active assignments
          const settings = await Database.get(DB.settings()) || {};
          const examId = settings.activeExamId || 'exam_001';
          const asgns = await Database.get(DB.assignments(examId)) || {};

          for (const [asgnId, asgn] of Object.entries(asgns)) {
            if (asgn.studentId === uid) {
              await Database.remove(DB.assignment(examId, asgnId));
              if (asgn.qrToken) {
                await Database.remove(DB.qrToken(asgn.qrToken));
              }
            }
          }

          UI.toast(`Candidate "${name}" removed`, 'info');
          AdminModule.renderStudents();
        } catch (err) {
          UI.toast('Failed to delete candidate: ' + err.message, 'error');
        }
      },
      'Delete Candidate',
      true
    );
  },

  // Bulk Modal: Assign multiple candidates to Class Batch using Dropdown
  async openBulkAssignClassModal() {
    const selectedCount = this.selectedStudentUids.size;
    if (!selectedCount) return;

    const classOptionsHtml = await ClassHelper.renderClassOptions('', { placeholder: '-- Select Target Class Batch --' });

    const modalHtml = `
      <form id="bulk-assign-class-form">
        <p class="text-xs text-muted mb-3">
          Select target class to assign to <strong>${selectedCount} selected candidate(s)</strong>:
        </p>

        <div class="form-group">
          <label class="form-label text-xs">Target Class Batch <span class="required">*</span></label>
          <select id="bulk-target-class" class="form-select text-sm" required>
            ${classOptionsHtml}
          </select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Apply Class Assignment</button>
        </div>
      </form>
    `;

    UI.showModal(`Assign Class for ${selectedCount} Candidates`, modalHtml);

    document.getElementById('bulk-assign-class-form').onsubmit = async (e) => {
      e.preventDefault();
      const targetClass = document.getElementById('bulk-target-class').value.trim();
      if (!targetClass) return;

      const updates = {};
      this.selectedStudentUids.forEach(uid => {
        updates['users/' + uid + '/classId'] = targetClass;
        updates['users/' + uid + '/updatedAt'] = DB.serverTimestamp();
      });

      await Database.multiUpdate(updates);
      UI.closeModal();
      UI.toast(`Assigned ${selectedCount} candidates to class ${targetClass}!`, 'success');
      AdminModule.renderStudents();
    };
  },

  // Bulk Delete
  executeBulkDelete() {
    const selectedCount = this.selectedStudentUids.size;
    if (!selectedCount) return;

    UI.confirm(
      'Bulk Delete Candidates',
      `Are you sure you want to permanently delete all ${selectedCount} selected candidates? This cannot be undone.`,
      async () => {
        try {
          const updates = {};
          this.selectedStudentUids.forEach(uid => {
            updates['users/' + uid] = null;
          });

          await Database.multiUpdate(updates);
          UI.toast(`Successfully deleted ${selectedCount} candidates`, 'info');
          AdminModule.renderStudents();
        } catch (err) {
          UI.toast('Failed bulk delete: ' + err.message, 'error');
        }
      },
      `Delete ${selectedCount} Students`,
      true
    );
  },

  // 5. Invigilator Management View (Manual Addition, Invite Link, Duties)
  async renderInvigilators() {
    const users = await Database.getList(DB.users());
    const invigilators = users.filter(u => u.role === 'invigilator');
    const invigProfiles = await Database.getList(DB.invigilators());
    const rooms = await Database.getList(DB.rooms());
    const invitations = await Database.getList(DB.invitations());

    const pendingInvites = invitations.filter(inv => inv.role === 'invigilator' && inv.status === 'pending');

    const profMap = new Map();
    invigProfiles.forEach(p => profMap.set(p.id, p));

    const roomMap = new Map();
    rooms.forEach(r => roomMap.set(r.id, r.name));

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Invigilator Registry & Appointment</h2>
            <div class="page-subtitle">Supervising faculty assignments, onboarding invitations, and live workloads</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminModule.renderInviteInvigilatorModal()">
            <i data-lucide="user-plus"></i> Add / Invite Invigilator
          </button>
        </div>
      </div>

      <!-- Pending Onboarding Invitations Section -->
      ${pendingInvites.length > 0 ? `
        <div class="card mb-6" style="border-left:4px solid var(--color-warning);">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3 class="card-title text-sm" style="display:flex;align-items:center;gap:6px;">
              <i data-lucide="mail" style="width:16px;height:16px;color:var(--color-warning);"></i>
              Pending Onboarding Invitations (${pendingInvites.length})
            </h3>
            <span class="badge badge-warning text-xs">Waiting for faculty activation</span>
          </div>
          <div class="card-body p-0">
            <div class="table-container" style="border:none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invitee Name</th>
                    <th>Email Address</th>
                    <th>Assigned Venue</th>
                    <th>Invited On</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingInvites.map(inv => {
      const inviteUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}register.html?invite=${inv.id}`;
      return `
                      <tr>
                        <td class="font-bold text-xs">${UI.escapeHtml(inv.name)}</td>
                        <td class="text-xs text-muted mono">${UI.escapeHtml(inv.email)}</td>
                        <td class="text-xs">${UI.escapeHtml(inv.assignedRoomName || inv.assignedRoom || 'General Hall')}</td>
                        <td class="text-xs text-muted">${UI.formatDateTime(inv.createdAt)}</td>
                        <td style="text-align:right;">
                          <div style="display:inline-flex;gap:var(--space-1);">
                            <button class="btn btn-secondary btn-sm" onclick="AdminModule.copyInviteLink('${inviteUrl}')" title="Copy invitation link">
                              <i data-lucide="copy" style="width:12px;height:12px;"></i> Copy Link
                            </button>
                            <button class="btn btn-ghost btn-sm" style="color:var(--color-critical);" onclick="AdminModule.revokeInvitation('${inv.id}')" title="Revoke">
                              <i data-lucide="x" style="width:12px;height:12px;"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Active Invigilators Registry -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Active Examination Supervisors (${invigilators.length})</h3>
        </div>
        <div class="card-body p-0">
          <div class="table-container" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Faculty Name</th>
                  <th>Official Email</th>
                  <th>Assigned Room</th>
                  <th>Contact</th>
                  <th>Duty Availability</th>
                  <th>Active Incident Load</th>
                  <th style="text-align:right;">Management</th>
                </tr>
              </thead>
              <tbody>
                ${!invigilators.length ? `
                  <tr><td colspan="7" class="text-center text-xs text-muted py-6">No invigilators registered. Click "Add / Invite Invigilator" to onboard faculty.</td></tr>
                ` : invigilators.map(inv => {
      const prof = profMap.get(inv.id) || {};
      const load = prof.activeIncidentCount || 0;
      const isAvail = prof.available !== false;

      // Find room
      let assignedRoomName = 'Unassigned';
      if (inv.assignedRooms) {
        const rId = Object.keys(inv.assignedRooms)[0];
        if (rId) assignedRoomName = 'Room ' + (roomMap.get(rId) || rId);
      }

      return `
                    <tr>
                      <td>
                        <div class="font-bold text-sm">${UI.escapeHtml(inv.name)}</div>
                      </td>
                      <td class="text-xs text-muted mono">${UI.escapeHtml(inv.email)}</td>
                      <td>
                        <span class="badge ${assignedRoomName !== 'Unassigned' ? 'badge-normal' : 'badge-muted'} text-xs font-semibold">
                          ${UI.escapeHtml(assignedRoomName)}
                        </span>
                      </td>
                      <td class="text-xs mono">${UI.escapeHtml(inv.phone || '—')}</td>
                      <td>
                        ${isAvail ? '<span class="badge badge-success">Available</span>' : '<span class="badge badge-muted">Off Duty</span>'}
                      </td>
                      <td class="mono font-bold text-xs" style="color:${load > 0 ? 'var(--color-critical)' : 'inherit'};">
                        ${load} active
                      </td>
                      <td style="text-align:right;">
                        <div style="display:inline-flex;gap:var(--space-1);">
                          <button class="btn btn-secondary btn-sm" onclick="AdminModule.toggleInvigilatorAvailability('${inv.id}', ${!isAvail})">
                            ${isAvail ? 'Off Duty' : 'Set Available'}
                          </button>
                          <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderEditInvigilatorModal('${inv.id}')" title="Edit faculty">
                            <i data-lucide="edit-2" style="width:13px;height:13px;"></i> Edit
                          </button>
                          <button class="btn btn-ghost btn-sm" style="color:var(--color-critical);" onclick="AdminModule.deleteInvigilator('${inv.id}', '${UI.escapeHtml(inv.name)}')" title="Remove supervisor">
                            <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);
  },

  // Modal: Add / Invite Invigilator
  async renderInviteInvigilatorModal() {
    const rooms = await Database.getList(DB.rooms());

    const modalHtml = `
      <form id="invite-inv-form">
        <p class="text-xs text-muted mb-4">
          Add an invigilator manually by generating a secure onboarding invitation link or creating their account directly:
        </p>

        <div class="form-group">
          <label class="form-label text-xs">Faculty Name <span class="required">*</span></label>
          <input type="text" id="inv-name" class="form-input text-sm" placeholder="e.g. Dr. Sarah Khan" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Official Email <span class="required">*</span></label>
            <input type="email" id="inv-email" class="form-input text-sm" placeholder="sarah@university.edu" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Phone Number</label>
            <input type="tel" id="inv-phone" class="form-input text-sm" placeholder="e.g. +91 9876543210">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label text-xs">Assigned Supervision Room</label>
          <select id="inv-room" class="form-select text-sm">
            <option value="">-- Choose Supervision Room --</option>
            ${rooms.map(r => `<option value="${r.id}">Room ${UI.escapeHtml(r.name)} (${UI.escapeHtml(r.building || 'Main Block')})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label text-xs">Onboarding Method</label>
          <div style="display:flex;gap:var(--space-4);margin-top:var(--space-1);">
            <label style="font-size:var(--text-xs);display:flex;align-items:center;gap:4px;">
              <input type="radio" name="inv-mode" value="link" checked> Send Onboarding Invite Link
            </label>
            <label style="font-size:var(--text-xs);display:flex;align-items:center;gap:4px;">
              <input type="radio" name="inv-mode" value="direct"> Create Directly with Password
            </label>
          </div>
        </div>

        <div id="inv-direct-pass-group" class="form-group" style="display:none;">
          <label class="form-label text-xs">Initial Password</label>
          <input type="text" id="inv-direct-pass" class="form-input text-sm mono" value="demo123456" minlength="6">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-inv">
            <i data-lucide="send"></i> Issue Invitation / Account
          </button>
        </div>
      </form>
    `;

    UI.showModal('Add / Invite Faculty Invigilator', modalHtml);

    // Toggle direct password
    document.querySelectorAll('input[name="inv-mode"]').forEach(r => {
      r.onchange = () => {
        document.getElementById('inv-direct-pass-group').style.display = (r.value === 'direct') ? 'block' : 'none';
      };
    });

    document.getElementById('invite-inv-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-inv');
      UI.setLoading(btn, true);

      const name = document.getElementById('inv-name').value.trim();
      const email = document.getElementById('inv-email').value.trim().toLowerCase();
      const phone = document.getElementById('inv-phone').value.trim();
      const room = document.getElementById('inv-room').value;
      const roomObj = rooms.find(r => r.id === room);
      const roomName = roomObj ? roomObj.name : room;
      const mode = document.querySelector('input[name="inv-mode"]:checked').value;

      try {
        if (mode === 'link') {
          // Generate Invitation
          const inviteId = generateId('inv');
          const inviteData = {
            id: inviteId,
            role: 'invigilator',
            name: name,
            email: email,
            phone: phone,
            assignedRoom: room,
            assignedRoomName: roomName ? 'Room ' + roomName : '',
            status: 'pending',
            createdAt: DB.serverTimestamp(),
            createdBy: Auth.getUid()
          };

          await Database.set(DB.invitation(inviteId), inviteData);

          const inviteUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}register.html?invite=${inviteId}`;

          UI.closeModal();

          // Show generated link modal
          UI.showModal(
            'Invitation Link Generated',
            `
              <div>
                <p class="text-xs text-muted mb-3">
                  Share this onboarding link with <strong>${UI.escapeHtml(name)}</strong>. They can set their password and activate their invigilator privileges:
                </p>
                <div style="background:var(--color-off-white);padding:var(--space-3);border:1px solid var(--border-color);border-radius:var(--radius-sm);word-break:break-all;font-family:var(--font-mono);font-size:var(--text-xs);margin-bottom:var(--space-4);">
                  ${inviteUrl}
                </div>
                <div style="display:flex;gap:var(--space-2);justify-content:flex-end;">
                  <button class="btn btn-primary btn-sm" onclick="AdminModule.copyInviteLink('${inviteUrl}')">
                    <i data-lucide="copy"></i> Copy Onboarding Link
                  </button>
                </div>
              </div>
            `
          );
        } else {
          // Direct account creation
          const password = document.getElementById('inv-direct-pass').value;
          let uid = 'invig_' + generateId();

          try {
            const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
            uid = cred.user.uid;
          } catch (authErr) {
            console.warn('[Admin] Auth direct create:', authErr.message);
          }

          const userData = {
            id: uid,
            name: name,
            email: email,
            phone: phone,
            role: 'invigilator',
            active: true,
            assignedRooms: room ? { [room]: true } : {},
            createdAt: DB.serverTimestamp()
          };

          await Database.set(DB.user(uid), userData);
          await Database.set(DB.invigilator(uid), {
            available: true,
            activeIncidentCount: 0,
            assignedRooms: room ? { [room]: true } : {}
          });

          if (room) {
            await Database.update(DB.room(room), {
              invigilatorId: uid,
              updatedAt: DB.serverTimestamp()
            });
          }

          UI.closeModal();
          UI.toast(`Invigilator account for ${name} created directly!`, 'success');
        }

        AdminModule.renderInvigilators();
      } catch (err) {
        UI.toast('Failed: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  },

  copyInviteLink(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      UI.toast('Invitation link copied to clipboard!', 'success');
    } else {
      prompt('Copy invitation link:', url);
    }
  },

  async revokeInvitation(inviteId) {
    UI.confirm('Revoke Invitation', 'Revoke this pending invitation link?', async () => {
      await Database.remove(DB.invitation(inviteId));
      UI.toast('Invitation revoked', 'info');
      AdminModule.renderInvigilators();
    });
  },

  // Modal: Edit Invigilator
  async renderEditInvigilatorModal(uid) {
    const inv = await Database.get(DB.user(uid));
    const rooms = await Database.getList(DB.rooms());
    if (!inv) return;

    let currentRoomId = '';
    if (inv.assignedRooms) {
      currentRoomId = Object.keys(inv.assignedRooms)[0] || '';
    }

    const modalHtml = `
      <form id="edit-inv-form">
        <div class="form-group">
          <label class="form-label text-xs">Faculty Name <span class="required">*</span></label>
          <input type="text" id="edit-inv-name" class="form-input text-sm" value="${UI.escapeHtml(inv.name || '')}" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Email Address</label>
            <input type="email" id="edit-inv-email" class="form-input text-sm" value="${UI.escapeHtml(inv.email || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Contact Phone</label>
            <input type="tel" id="edit-inv-phone" class="form-input text-sm" value="${UI.escapeHtml(inv.phone || '')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label text-xs">Assigned Room Venue</label>
          <select id="edit-inv-room" class="form-select text-sm">
            <option value="">-- Unassigned --</option>
            ${rooms.map(r => `<option value="${r.id}" ${r.id === currentRoomId ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)} (${UI.escapeHtml(r.building || '')})</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-inv">Save Changes</button>
        </div>
      </form>
    `;

    UI.showModal(`Edit Faculty: ${inv.name}`, modalHtml);

    document.getElementById('edit-inv-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-edit-inv');
      UI.setLoading(btn, true);

      try {
        const newRoom = document.getElementById('edit-inv-room').value;
        const updates = {
          name: document.getElementById('edit-inv-name').value.trim(),
          email: document.getElementById('edit-inv-email').value.trim(),
          phone: document.getElementById('edit-inv-phone').value.trim(),
          assignedRooms: newRoom ? { [newRoom]: true } : {},
          updatedAt: DB.serverTimestamp()
        };

        await Database.update(DB.user(uid), updates);
        await Database.update(DB.invigilator(uid), {
          assignedRooms: newRoom ? { [newRoom]: true } : {}
        });

        // Update room record
        if (newRoom) {
          await Database.update(DB.room(newRoom), {
            invigilatorId: uid,
            updatedAt: DB.serverTimestamp()
          });
        }

        UI.closeModal();
        UI.toast('Invigilator profile updated', 'success');
        AdminModule.renderInvigilators();
      } catch (err) {
        UI.toast('Failed to update: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  },

  // Delete Invigilator
  deleteInvigilator(uid, name) {
    UI.confirm(
      'Remove Faculty Supervisor',
      `Permanently remove invigilator "${name}"? This unassigns any supervised rooms.`,
      async () => {
        try {
          // Release rooms
          const rooms = await Database.getList(DB.rooms());
          for (const r of rooms) {
            if (r.invigilatorId === uid) {
              await Database.update(DB.room(r.id), { invigilatorId: '' });
            }
          }

          await Database.remove(DB.user(uid));
          await Database.remove(DB.invigilator(uid));

          UI.toast(`Invigilator "${name}" removed`, 'info');
          AdminModule.renderInvigilators();
        } catch (err) {
          UI.toast('Failed to delete: ' + err.message, 'error');
        }
      },
      'Remove Invigilator',
      true
    );
  },

  async toggleInvigilatorAvailability(uid, newStatus) {
    await Database.update(DB.invigilator(uid), { available: newStatus });
    UI.toast('Invigilator status updated', 'info');
    AdminModule.renderInvigilators();
  },

  // 6. Seat Allocation Management View
  async renderSeatAllocation() {
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const exams = await Database.getList(DB.exams());
    const rooms = await Database.getList(DB.rooms());

    const html = `
      <div class="page-header">
        <h2>Automated Seat Allocation & QR Minting</h2>
        <div class="page-subtitle">Distribute registered candidates across room seating matrices with cryptographic QR tokens</div>
      </div>

      <div class="card mb-6">
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:var(--space-3);align-items:flex-end;">
            <div class="form-group mb-0">
              <label class="form-label text-xs">Target Examination</label>
              <select class="form-select text-xs" id="alloc-exam-select">
                ${exams.map(ex => `<option value="${ex.id}" ${ex.id === activeExamId ? 'selected' : ''}>${UI.escapeHtml(ex.title)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group mb-0">
              <label class="form-label text-xs">Target Room</label>
              <select class="form-select text-xs" id="alloc-room-select">
                ${rooms.map(rm => `<option value="${rm.id}">Room ${UI.escapeHtml(rm.name)} (${rm.capacity} Desks)</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-auto-allocate">
              <i data-lucide="zap"></i> Auto-Allocate Unassigned
            </button>
          </div>
          <!-- Designated Target Classes Banner -->
          <div id="alloc-exam-target-info" class="mt-3 p-2 text-xs" style="background:var(--color-off-white);border-radius:var(--radius-sm);border:1px solid var(--border-color);display:flex;align-items:center;gap:var(--space-2);">
            <i data-lucide="layers" style="width:14px;height:14px;color:var(--color-green-600);"></i>
            <span id="alloc-target-classes-text" class="text-muted">Loading target batches...</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Current Room Seat Allocation</h3>
        </div>
        <div class="card-body" id="alloc-table-container">
          <div class="text-xs text-muted">Select room to inspect allocation ledger...</div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const examSelect = document.getElementById('alloc-exam-select');
    const roomSelect = document.getElementById('alloc-room-select');
    const tableContainer = document.getElementById('alloc-table-container');
    const targetClassesText = document.getElementById('alloc-target-classes-text');

    const loadAllocations = async () => {
      const exId = examSelect.value;
      const rmId = roomSelect.value;
      const exam = exams.find(e => e.id === exId) || {};
      const targetClasses = Array.isArray(exam.targetClasses) ? exam.targetClasses : [];
      const isRestricted = targetClasses.length > 0 && !targetClasses.includes('all');

      if (targetClassesText) {
        if (isRestricted) {
          targetClassesText.innerHTML = `<strong>Restricted Examination:</strong> Seat allocation is strictly limited to candidates in class/batch: <span class="badge badge-outline text-xs" style="background:#fff;margin-left:4px;">${targetClasses.map(c => UI.escapeHtml(c)).join('</span> <span class="badge badge-outline text-xs" style="background:#fff;">')}</span>`;
        } else {
          targetClassesText.innerHTML = `<strong>Open Campus Examination:</strong> Eligible for candidates from <em>All Classes / Batches</em>.`;
        }
      }

      const asgns = await Database.get(DB.assignments(exId)) || {};
      const users = await Database.getList(DB.users());
      const userMap = new Map(users.map(u => [u.id, u]));

      const roomAsgns = Object.entries(asgns)
        .map(([id, val]) => ({ id, ...val }))
        .filter(a => a.roomId === rmId)
        .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));

      if (!roomAsgns.length) {
        tableContainer.innerHTML = '<p class="text-xs text-muted">No candidate seat assignments found for this room yet.</p>';
        return;
      }

      tableContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Seat Desk</th>
                <th>Candidate Name</th>
                <th>Class / Batch</th>
                <th>Register Number</th>
                <th>QR Pass Token</th>
                <th>Allocation State</th>
              </tr>
            </thead>
            <tbody>
              ${roomAsgns.map(a => {
        const s = userMap.get(a.studentId) || {};
        const sClass = s.classId || s.class || '—';
        return `
                  <tr>
                    <td class="font-bold mono text-sm" style="color:var(--color-green-600);">${UI.escapeHtml(a.seatNumber)}</td>
                    <td class="font-semibold">${UI.escapeHtml(s.name || 'Candidate')}</td>
                    <td><span class="badge badge-outline text-xs">${UI.escapeHtml(sClass)}</span></td>
                    <td class="mono text-xs">${UI.escapeHtml(a.registerNumber || s.registerNumber || '—')}</td>
                    <td class="mono text-xs text-muted">${UI.escapeHtml((a.qrToken || '').substring(0, 16))}...</td>
                    <td><span class="badge badge-success">Assigned</span></td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    examSelect.onchange = loadAllocations;
    roomSelect.onchange = loadAllocations;
    loadAllocations();

    // Auto-allocate button
    document.getElementById('btn-auto-allocate').onclick = async () => {
      const exId = examSelect.value;
      const rmId = roomSelect.value;
      const room = rooms.find(r => r.id === rmId);
      if (!room) return;

      const exam = exams.find(e => e.id === exId) || {};
      const targetClasses = Array.isArray(exam.targetClasses) ? exam.targetClasses : [];
      const isRestricted = targetClasses.length > 0 && !targetClasses.includes('all');

      const users = await Database.getList(DB.users());
      const students = users.filter(u => u.role === 'student');

      let eligibleStudents = students;
      if (isRestricted) {
        const allowedUpper = targetClasses.map(c => String(c).trim().toUpperCase());
        eligibleStudents = students.filter(s => {
          const sClass = String(s.classId || s.class || '').trim().toUpperCase();
          return sClass && allowedUpper.includes(sClass);
        });
      }

      if (!eligibleStudents.length) {
        UI.toast(`No candidates found registered in designated target classes (${targetClasses.join(', ')}).`, 'warning');
        return;
      }

      const existingAsgns = await Database.get(DB.assignments(exId)) || {};
      const assignedStudentIds = new Set(Object.values(existingAsgns).map(a => a.studentId));
      const unassignedStudents = eligibleStudents.filter(s => !assignedStudentIds.has(s.id));

      if (!unassignedStudents.length) {
        UI.toast(`All candidates in designated target classes (${isRestricted ? targetClasses.join(', ') : 'all classes'}) already possess seat allocations!`, 'info');
        return;
      }

      const occupiedSeats = new Set(Object.values(existingAsgns).filter(a => a.roomId === rmId).map(a => a.seatNumber));
      const rows = room.rows || 5;
      const cols = room.columns || 6;
      const freeSeats = [];

      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + r);
        for (let c = 1; c <= cols; c++) {
          const seatId = `${rowChar}${c}`;
          if (!occupiedSeats.has(seatId)) freeSeats.push(seatId);
        }
      }

      if (!freeSeats.length) {
        UI.toast('No unoccupied desks remaining in this room!', 'warning');
        return;
      }

      const countToAllocate = Math.min(unassignedStudents.length, freeSeats.length);
      const classInfoLabel = isRestricted ? `target classes: ${targetClasses.join(', ')}` : 'all classes';
      UI.confirm(
        'Confirm Auto-Allocation',
        `Allocate ${countToAllocate} unassigned candidates (${classInfoLabel}) to Room ${room.name}? QR tokens will be generated automatically.`,
        async () => {
          const updates = {};
          for (let i = 0; i < countToAllocate; i++) {
            const student = unassignedStudents[i];
            const seatNumber = freeSeats[i];
            const assignId = 'asgn_' + (student.registerNumber || student.id);
            const token = generateQRToken();

            updates['assignments/' + exId + '/' + assignId] = {
              id: assignId,
              studentId: student.id,
              registerNumber: student.registerNumber || 'REG_' + student.id,
              roomId: rmId,
              seatNumber: seatNumber,
              qrToken: token,
              status: 'active',
              createdAt: DB.serverTimestamp()
            };

            updates['qrTokens/' + token] = {
              assignmentId: assignId,
              examId: exId,
              studentId: student.id,
              roomId: rmId,
              active: true,
              createdAt: DB.serverTimestamp()
            };
          }

          await Database.multiUpdate(updates);
          UI.toast(`Successfully allocated ${countToAllocate} candidates!`, 'success');
          loadAllocations();
        }
      );
    };
  },

  // 7. Live Incident Dashboard View
  async renderIncidentsDashboard() {
    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Live Incident Command Center</h2>
            <div class="page-subtitle">Real-time emergency triage, automatic responder dispatch, and incident history</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/announcements')">
            <i data-lucide="megaphone"></i> Broadcast Incident Advisory
          </button>
        </div>
      </div>

      <!-- Live Incident Metrics -->
      <div class="stats-grid" id="admin-inc-stats">
        <div class="stat-card">
          <div class="stat-label">Total Reports</div>
          <div class="stat-value" id="stat-inc-total">0</div>
        </div>
        <div class="stat-card stat-critical">
          <div class="stat-label">Critical Priority</div>
          <div class="stat-value" id="stat-inc-crit" style="color:var(--color-critical);">0</div>
        </div>
        <div class="stat-card stat-high">
          <div class="stat-label">High Priority</div>
          <div class="stat-value" id="stat-inc-high" style="color:var(--color-high);">0</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-label">Resolved</div>
          <div class="stat-value" id="stat-inc-res" style="color:var(--color-green-600);">0</div>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="card mb-6">
        <div class="card-body" style="padding:var(--space-3) var(--space-4);">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;">
            <span class="text-xs uppercase font-bold text-muted">Filter:</span>
            <select class="form-select text-xs" id="filter-inc-priority" style="width:auto;">
              <option value="all">All Priorities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="normal">Normal Only</option>
            </select>
            <select class="form-select text-xs" id="filter-inc-status" style="width:auto;">
              <option value="all">All Statuses</option>
              <option value="active">Active (Unresolved)</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select class="form-select text-xs" id="filter-inc-category" style="width:auto;">
              <option value="all">All Categories</option>
              <option value="medical">Medical Emergency</option>
              <option value="wrong-room">Wrong Room</option>
              <option value="wrong-seat">Wrong Seat</option>
              <option value="admit-card">Admit Card Issue</option>
              <option value="missing-stationery">Missing Stationery</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Incidents Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Real-Time Incident Ledger</h3>
        </div>
        <div class="card-body p-0">
          <div class="table-container" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Category</th>
                  <th>Room</th>
                  <th>Priority</th>
                  <th>Assigned Responder</th>
                  <th>Reported</th>
                  <th>Status</th>
                  <th style="text-align:right;">Inspect</th>
                </tr>
              </thead>
              <tbody id="admin-inc-table-body">
                <tr><td colspan="8" class="text-xs text-muted">Connecting real-time incident monitor...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const tbody = document.getElementById('admin-inc-table-body');
    const priFilter = document.getElementById('filter-inc-priority');
    const statFilter = document.getElementById('filter-inc-status');
    const catFilter = document.getElementById('filter-inc-category');

    let cachedIncidents = [];

    const applyFiltersAndRender = () => {
      let filtered = [...cachedIncidents];

      if (priFilter.value !== 'all') {
        filtered = filtered.filter(i => i.priority === priFilter.value);
      }
      if (statFilter.value !== 'all') {
        if (statFilter.value === 'active') {
          filtered = filtered.filter(i => i.status !== 'resolved' && i.status !== 'closed');
        } else {
          filtered = filtered.filter(i => i.status === statFilter.value);
        }
      }
      if (catFilter.value !== 'all') {
        filtered = filtered.filter(i => i.category === catFilter.value);
      }

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-xs text-muted py-6">No matching incidents found.</td></tr>';
        return;
      }

      PriorityEngine.sortIncidents(filtered);

      tbody.innerHTML = filtered.map(inc => `
        <tr style="cursor:pointer;" onclick="IncidentsHelper.renderIncidentDetail('${inc.id}')">
          <td class="mono font-bold text-xs">${UI.escapeHtml(inc.id)}</td>
          <td class="font-semibold text-xs">${UI.escapeHtml(INCIDENT_CATEGORIES[inc.category] || inc.category)}</td>
          <td class="font-medium text-xs">${UI.escapeHtml(inc.roomId || '—')}</td>
          <td>${UI.priorityBadge(inc.priority)}</td>
          <td class="text-xs">${inc.assignedTo ? UI.escapeHtml(inc.assignedTo) : '<span class="text-muted">Unassigned</span>'}</td>
          <td class="text-xs text-muted">${UI.formatRelative(inc.createdAt)}</td>
          <td>${UI.statusBadge(inc.status)}</td>
          <td style="text-align:right;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); IncidentsHelper.renderIncidentDetail('${inc.id}')">
              Manage
            </button>
          </td>
        </tr>
      `).join('');
    };

    priFilter.onchange = applyFiltersAndRender;
    statFilter.onchange = applyFiltersAndRender;
    catFilter.onchange = applyFiltersAndRender;

    // Real-time listener
    const unsub = Database.listen(DB.incidents(), (incidentsMap) => {
      cachedIncidents = Object.entries(incidentsMap || {}).map(([id, val]) => ({ id, ...val }));
      const stats = IncidentsHelper.getIncidentStats(cachedIncidents);

      document.getElementById('stat-inc-total').textContent = stats.total;
      document.getElementById('stat-inc-crit').textContent = stats.critical;
      document.getElementById('stat-inc-high').textContent = stats.high;
      document.getElementById('stat-inc-res').textContent = stats.resolved;

      applyFiltersAndRender();
    });

    ActiveListeners.add(unsub);
  },

  // 8. Overall Attendance Monitor View
  async renderAttendanceMonitor() {
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const exam = await Database.get(DB.exam(activeExamId));
    const rooms = await Database.getList(DB.rooms());

    const html = `
      <div class="page-header">
        <h2>Live Attendance Command Roll</h2>
        <div class="page-subtitle">Overall attendance statistics and per-room roll confirmation for ${exam ? UI.escapeHtml(exam.title) : 'Active Examination'}</div>
      </div>

      <div id="admin-overall-stats-holder" class="mb-6"></div>

      <div class="card mb-6">
        <div class="card-header">
          <h3 class="card-title">Room-by-Room Attendance Breakdown</h3>
        </div>
        <div class="card-body p-0">
          <div class="table-container" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Room Name</th>
                  <th>Building / Block</th>
                  <th>Capacity</th>
                  <th>Assigned</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Unmarked</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody id="admin-room-att-body">
                <tr><td colspan="8" class="text-xs text-muted">Calculating room attendance figures...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Interactive Roster Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Full Examination Candidate Roll</h3>
        </div>
        <div class="card-body" id="admin-full-att-table"></div>
      </div>
    `;

    UI.renderPage(html);

    // Compute room-by-room breakdown
    const computeBreakdown = async () => {
      const overallStats = await AttendanceHelper.getAttendanceStats(activeExamId);
      AttendanceHelper.renderAttendanceStats(overallStats, document.getElementById('admin-overall-stats-holder'));

      const tbody = document.getElementById('admin-room-att-body');
      const roomRows = [];

      for (const rm of rooms) {
        const stats = await AttendanceHelper.getAttendanceStats(activeExamId, rm.id);
        roomRows.push(`
          <tr>
            <td class="font-bold">Room ${UI.escapeHtml(rm.name)}</td>
            <td>${UI.escapeHtml(rm.building || 'Main Block')} (Block ${UI.escapeHtml(rm.block || 'A')})</td>
            <td class="mono text-xs">${rm.capacity}</td>
            <td class="mono text-xs font-semibold">${stats.total}</td>
            <td class="mono text-xs font-semibold" style="color:var(--color-green-600);">${stats.present}</td>
            <td class="mono text-xs font-semibold" style="color:var(--color-critical);">${stats.absent}</td>
            <td class="mono text-xs text-muted">${stats.unmarked}</td>
            <td>
              <div style="display:flex;align-items:center;gap:var(--space-2);">
                <div class="progress-bar" style="width:70px;">
                  <div class="progress-fill" style="width:${stats.percentage}%;"></div>
                </div>
                <span class="mono text-xs font-bold">${stats.percentage}%</span>
              </div>
            </td>
          </tr>
        `);
      }

      tbody.innerHTML = roomRows.join('') || '<tr><td colspan="8" class="text-xs text-muted">No rooms configured.</td></tr>';
    };

    computeBreakdown();

    // Render full interactive attendance table (view-only for admin)
    AttendanceHelper.renderAttendanceTable(activeExamId, null, document.getElementById('admin-full-att-table'), {
      canEdit: true
    });

    const unsub = Database.listen(DB.attendance(activeExamId), () => computeBreakdown());
    ActiveListeners.add(unsub);
  },

  // 9. Instant Announcements Management View
  async renderAnnouncements() {
    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Broadcast Announcements</h2>
            <div class="page-subtitle">Publish targeted bulletins to students, rooms, or invigilators</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AnnouncementsHelper.renderCreateModal(() => AdminModule.renderAnnouncements())">
            <i data-lucide="plus"></i> New Announcement
          </button>
        </div>
      </div>

      <div id="admin-announcements-container">
        <div class="text-xs text-muted">Loading active announcements...</div>
      </div>
    `;

    UI.renderPage(html);

    const container = document.getElementById('admin-announcements-container');
    const unsub = Database.listen(DB.announcements(), async () => {
      const all = await AnnouncementsHelper.getAll();
      AnnouncementsHelper.renderAnnouncementsList(all, container, { showAdminActions: true });
    });

    ActiveListeners.add(unsub);
  },

  // 10. Additional Module — Interactive Room Visualization & Room Intelligence
  activeRoomControlView: 'matrix', // 'matrix', 'map', 'cards'
  activeRoomBuildingFilter: 'all',
  activeRoomStatusFilter: 'all',

  async renderRoomControlCenter() {
    const rooms = await Database.getList(DB.rooms());
    const buildingsFromDb = await Database.getList(DB.buildings());
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    // Extract unique buildings dynamically from both DB and room objects
    const buildingMap = new Map();
    buildingsFromDb.forEach(b => buildingMap.set(b.id || b.name, b.name));
    rooms.forEach(r => {
      if (r.building && !buildingMap.has(r.building)) {
        buildingMap.set(r.building, r.building);
      }
    });

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Room Control & Campus Spatial Center</h2>
            <div class="page-subtitle">Interactive architectural mapping, physical floor plans, and real-time room readiness intelligence</div>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="AdminModule.renderNewRoomModal()">
              <i data-lucide="plus"></i> Add Room
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CampusMap.openModal()">
              <i data-lucide="map"></i> Fullscreen Campus Map
            </button>
          </div>
        </div>
      </div>

      <!-- Real-Time Metric Strip -->
      <div class="stats-grid mb-6" id="room-ctrl-stats-strip">
        <div class="stat-card">
          <div class="stat-label">Total Examination Venues</div>
          <div class="stat-value mono" id="stat-total-rooms">${rooms.length}</div>
          <div class="stat-change text-xs">Campus-wide coverage</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-label">Fully Ready Venues</div>
          <div class="stat-value mono" id="stat-ready-rooms" style="color:var(--color-green-600);">—</div>
          <div class="stat-change text-xs">Readiness confirmed</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Venues in Preparation</div>
          <div class="stat-value mono" id="stat-prep-rooms">—</div>
          <div class="stat-change text-xs">Pre-flight checks active</div>
        </div>
        <div class="stat-card" id="stat-card-alerts">
          <div class="stat-label">Active Venue Alerts</div>
          <div class="stat-value mono" id="stat-alert-rooms">—</div>
          <div class="stat-change text-xs">Assistance dispatched</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Seating Capacity</div>
          <div class="stat-value mono" id="stat-total-seats">—</div>
          <div class="stat-change text-xs">Across all exam halls</div>
        </div>
      </div>

      <!-- Control Toolbar: Mode Switcher & Filter Bar -->
      <div class="card mb-6">
        <div class="card-body" style="padding:var(--space-3) var(--space-4);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);">
            <!-- View Mode Switcher -->
            <div style="display:flex;gap:4px;background:var(--color-off-white);padding:4px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <button class="btn btn-sm ${this.activeRoomControlView === 'matrix' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-matrix">
                <i data-lucide="grid-3x3"></i> Floor Plan Matrix
              </button>
              <button class="btn btn-sm ${this.activeRoomControlView === 'map' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-map">
                <i data-lucide="map"></i> Campus Spatial Map
              </button>
              <button class="btn btn-sm ${this.activeRoomControlView === 'cards' ? 'btn-primary' : 'btn-ghost'}" id="btn-view-cards">
                <i data-lucide="layers"></i> Venue Directory
              </button>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;">
              <select class="form-select text-xs" id="ctrl-building-select" style="min-width:180px;">
                <option value="all">All Buildings & Wings</option>
                ${Array.from(buildingMap.entries()).map(([id, name]) => `
                  <option value="${id}" ${this.activeRoomBuildingFilter === id ? 'selected' : ''}>${UI.escapeHtml(name)}</option>
                `).join('')}
              </select>

              <select class="form-select text-xs" id="ctrl-status-select" style="min-width:150px;">
                <option value="all">All Statuses</option>
                <option value="ready" ${this.activeRoomStatusFilter === 'ready' ? 'selected' : ''}>Ready / Operational</option>
                <option value="preparing" ${this.activeRoomStatusFilter === 'preparing' ? 'selected' : ''}>In Preparation</option>
                <option value="not-ready" ${this.activeRoomStatusFilter === 'not-ready' ? 'selected' : ''}>Not Ready</option>
                <option value="alert" ${this.activeRoomStatusFilter === 'alert' ? 'selected' : ''}>Has Active Alerts</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Dynamic View Container -->
      <div id="room-ctrl-view-container">
        <!-- Rendered based on activeRoomControlView -->
      </div>
    `;

    UI.renderPage(html);

    // Render active view and bind live listeners
    const viewContainer = document.getElementById('room-ctrl-view-container');
    const bldgSelect = document.getElementById('ctrl-building-select');
    const statusSelect = document.getElementById('ctrl-status-select');

    const btnMatrix = document.getElementById('btn-view-matrix');
    const btnMap = document.getElementById('btn-view-map');
    const btnCards = document.getElementById('btn-view-cards');

    const setView = (mode) => {
      this.activeRoomControlView = mode;
      [btnMatrix, btnMap, btnCards].forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      });
      if (mode === 'matrix') { btnMatrix.classList.add('btn-primary'); btnMatrix.classList.remove('btn-ghost'); }
      if (mode === 'map') { btnMap.classList.add('btn-primary'); btnMap.classList.remove('btn-ghost'); }
      if (mode === 'cards') { btnCards.classList.add('btn-primary'); btnCards.classList.remove('btn-ghost'); }
      renderActiveView();
    };

    btnMatrix.onclick = () => setView('matrix');
    btnMap.onclick = () => setView('map');
    btnCards.onclick = () => setView('cards');

    bldgSelect.onchange = (e) => {
      this.activeRoomBuildingFilter = e.target.value;
      renderActiveView();
    };

    statusSelect.onchange = (e) => {
      this.activeRoomStatusFilter = e.target.value;
      renderActiveView();
    };

    const renderActiveView = async () => {
      const allRooms = await Database.getList(DB.rooms());
      const allIncidents = await Database.getList(DB.incidents());
      const activeIncidents = allIncidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
      const checklists = await Database.get(DB.ref('roomChecklists')) || {};
      const users = await Database.getList(DB.users());
      const userMap = new Map(users.map(u => [u.id, u.name]));
      const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};
      const attendanceMap = await Database.get(DB.attendance(activeExamId)) || {};

      // Filter rooms according to dropdown selections
      let filteredRooms = allRooms;
      if (this.activeRoomBuildingFilter !== 'all') {
        filteredRooms = filteredRooms.filter(r => (r.building === this.activeRoomBuildingFilter || r.buildingId === this.activeRoomBuildingFilter));
      }
      if (this.activeRoomStatusFilter !== 'all') {
        if (this.activeRoomStatusFilter === 'alert') {
          filteredRooms = filteredRooms.filter(r => activeIncidents.some(i => i.roomId === r.id));
        } else {
          filteredRooms = filteredRooms.filter(r => (r.status || 'not-ready') === this.activeRoomStatusFilter);
        }
      }

      // Update Metric Strip
      let readyCount = 0;
      let prepCount = 0;
      let alertRoomsCount = 0;
      let totalCapacity = 0;

      allRooms.forEach(rm => {
        totalCapacity += (rm.capacity || (rm.rows * rm.columns) || 30);
        const hasInc = activeIncidents.some(i => i.roomId === rm.id);
        if (hasInc) alertRoomsCount++;
        if (rm.status === 'ready') readyCount++;
        else if (rm.status === 'preparing') prepCount++;
      });

      const statTotalEl = document.getElementById('stat-total-rooms');
      const statReadyEl = document.getElementById('stat-ready-rooms');
      const statPrepEl = document.getElementById('stat-prep-rooms');
      const statAlertEl = document.getElementById('stat-alert-rooms');
      const statSeatsEl = document.getElementById('stat-total-seats');
      const statAlertCard = document.getElementById('stat-card-alerts');

      if (statTotalEl) statTotalEl.textContent = allRooms.length;
      if (statReadyEl) statReadyEl.textContent = readyCount;
      if (statPrepEl) statPrepEl.textContent = prepCount;
      if (statAlertEl) statAlertEl.textContent = alertRoomsCount;
      if (statSeatsEl) statSeatsEl.textContent = totalCapacity;

      if (statAlertCard) {
        if (alertRoomsCount > 0) {
          statAlertCard.classList.add('stat-critical');
          statAlertCard.classList.remove('stat-success');
        } else {
          statAlertCard.classList.remove('stat-critical');
          statAlertCard.classList.add('stat-success');
        }
      }

      // Render the selected view mode
      if (this.activeRoomControlView === 'map') {
        viewContainer.innerHTML = `<div id="ctrl-campus-map-embed"></div>`;
        await CampusMap.render(document.getElementById('ctrl-campus-map-embed'), { canInspect: true });
        return;
      }

      if (this.activeRoomControlView === 'matrix') {
        // Floor Plan Spatial Matrix View (Grouped by Building)
        if (!filteredRooms.length) {
          viewContainer.innerHTML = `
            <div class="card p-8 text-center">
              <i data-lucide="door-closed" style="width:36px;height:36px;margin:0 auto var(--space-2);color:var(--color-gray-400);"></i>
              <h4 class="font-bold">No Examination Rooms Match Filters</h4>
              <p class="text-xs text-muted mt-1">Try resetting the building or status filter above, or create a new room.</p>
              <button class="btn btn-secondary btn-sm mt-3" onclick="AdminModule.renderNewRoomModal()">Add Examination Room</button>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ nodes: [viewContainer] });
          return;
        }

        // Group rooms by building
        const groups = new Map();
        filteredRooms.forEach(rm => {
          const bldg = rm.building || 'Main Academic Complex';
          if (!groups.has(bldg)) groups.set(bldg, []);
          groups.get(bldg).push(rm);
        });

        let matrixHtml = '';
        groups.forEach((bldgRooms, bldgName) => {
          matrixHtml += `
            <div class="card mb-6">
              <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <h3 class="card-title">${UI.escapeHtml(bldgName)}</h3>
                  <div class="text-xs text-muted">${bldgRooms.length} Examination Venue(s) Active</div>
                </div>
                <span class="badge badge-normal text-xs font-semibold">${bldgRooms.reduce((acc, r) => acc + (r.capacity || 0), 0)} Total Desks</span>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(290px, 1fr));gap:var(--space-4);">
                  ${bldgRooms.map(rm => {
                    const roomIncidents = activeIncidents.filter(i => i.roomId === rm.id);
                    const hasCritical = roomIncidents.some(i => i.priority === 'critical');
                    const invigName = rm.invigilatorId ? (userMap.get(rm.invigilatorId) || 'Faculty Assigned') : 'Unassigned';

                    // Calculate live occupancy
                    let assignedCount = 0;
                    let presentCount = 0;
                    Object.entries(assignmentsMap).forEach(([asgnId, asgn]) => {
                      if (asgn.roomId === rm.id) {
                        assignedCount++;
                        const att = attendanceMap[asgnId];
                        if (att && att.status === 'present') presentCount++;
                      }
                    });
                    const cap = rm.capacity || (rm.rows * rm.columns) || 30;
                    const occPct = cap > 0 ? Math.round((presentCount / cap) * 100) : 0;

                    let borderTop = '3px solid var(--color-green-600)';
                    if (roomIncidents.length > 0) borderTop = '3px solid var(--color-critical)';
                    else if (rm.status === 'preparing') borderTop = '3px solid var(--color-warning)';
                    else if (rm.status === 'not-ready') borderTop = '3px solid var(--border-color)';

                    return `
                      <div class="card p-4" style="border-top:${borderTop};background:var(--color-white);cursor:pointer;transition:transform 0.15s ease, box-shadow 0.15s ease;"
                           onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)';"
                           onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.transform='none';"
                           onclick="AdminModule.openRoomInspectorModal('${rm.id}')">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3);">
                          <div>
                            <div style="display:flex;align-items:center;gap:6px;">
                              <span class="status-dot ${roomIncidents.length > 0 ? 'critical' : (rm.status === 'ready' ? 'present' : 'unmarked')}"></span>
                              <h4 class="font-bold text-base text-black">Room ${UI.escapeHtml(rm.name)}</h4>
                            </div>
                            <div class="text-xs text-muted mt-0.5">Block ${UI.escapeHtml(rm.block || 'A')} · Grid: ${rm.rows || 5} × ${rm.columns || 6}</div>
                          </div>
                          ${roomIncidents.length > 0 ? `
                            <span class="badge ${hasCritical ? 'badge-critical' : 'badge-warning'} text-xs font-bold">
                              ${roomIncidents.length} Alert(s)
                            </span>
                          ` : UI.statusBadge(rm.status || 'ready')}
                        </div>

                        <!-- Occupancy & Verification Gauge -->
                        <div style="background:var(--color-off-white);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-3);border:1px solid var(--border-subtle);">
                          <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);margin-bottom:4px;">
                            <span class="text-muted">Attendance Verified</span>
                            <span class="font-bold mono">${presentCount} / ${cap} (${occPct}%)</span>
                          </div>
                          <div class="progress-bar">
                            <div class="progress-fill ${occPct < 50 ? 'medium' : ''}" style="width:${occPct}%;"></div>
                          </div>
                        </div>

                        <!-- Invigilator & Actions Row -->
                        <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs);padding-top:var(--space-2);border-top:1px solid var(--border-subtle);">
                          <div style="display:flex;align-items:center;gap:4px;">
                            <i data-lucide="user-check" style="width:13px;height:13px;color:var(--color-gray-500);"></i>
                            <span class="text-muted truncate" style="max-width:140px;">${UI.escapeHtml(invigName)}</span>
                          </div>
                          <span class="font-semibold text-xs" style="color:var(--color-green-700);">
                            Inspect Seating & Roll &rarr;
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        });

        viewContainer.innerHTML = matrixHtml;
        if (window.lucide) window.lucide.createIcons({ nodes: [viewContainer] });
        return;
      }

      if (this.activeRoomControlView === 'cards') {
        // Venue Intelligence Cards View
        if (!filteredRooms.length) {
          viewContainer.innerHTML = `<div class="card p-8 text-center text-xs text-muted">No rooms match filter criteria.</div>`;
          return;
        }

        viewContainer.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(290px, 1fr));gap:var(--space-4);">
            ${filteredRooms.map(rm => {
              const cl = checklists[rm.id] || {};
              const score = ReadinessCalc.calculate(cl);
              const roomIncidents = activeIncidents.filter(i => i.roomId === rm.id);
              const invigName = rm.invigilatorId ? (userMap.get(rm.invigilatorId) || 'Faculty Assigned') : 'Unassigned';

              return `
                <div class="card" style="border-top:3px solid ${roomIncidents.length > 0 ? 'var(--color-critical)' : 'var(--color-green-600)'};cursor:pointer;" onclick="AdminModule.openRoomInspectorModal('${rm.id}')">
                  <div class="card-header">
                    <h4 class="font-bold text-sm">Room ${UI.escapeHtml(rm.name)}</h4>
                    ${UI.statusBadge(roomIncidents.length > 0 ? 'assistance' : (rm.status || 'ready'))}
                  </div>
                  <div class="card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);font-size:var(--text-xs);margin-bottom:var(--space-3);">
                      <div><span class="text-muted">Building:</span> <span class="font-semibold">${UI.escapeHtml(rm.building || 'Main Block')}</span></div>
                      <div><span class="text-muted">Capacity:</span> <span class="font-semibold mono">${rm.capacity || 30} Seats</span></div>
                      <div><span class="text-muted">Invigilator:</span> <span class="font-semibold">${UI.escapeHtml(invigName)}</span></div>
                      <div><span class="text-muted">Incidents:</span> <span class="font-semibold" style="color:${roomIncidents.length > 0 ? 'var(--color-critical)' : 'inherit'};">${roomIncidents.length} active</span></div>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs);margin-bottom:var(--space-1);">
                      <span class="text-muted">Readiness Score</span>
                      <span class="font-bold mono">${score}%</span>
                    </div>
                    <div class="progress-bar mb-3">
                      <div class="progress-fill ${score < 50 ? 'low' : ''}" style="width:${score}%;"></div>
                    </div>

                    <button class="btn btn-secondary btn-sm btn-full">
                      Inspect Seating & Roll &rarr;
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ nodes: [viewContainer] });
      }
    };

    // Initial render
    await renderActiveView();

    // Attach real-time listeners for live updates
    const unsubRooms = Database.listen(DB.rooms(), () => renderActiveView());
    const unsubInc = Database.listen(DB.incidents(), () => renderActiveView());
    const unsubAtt = Database.listen(DB.attendance(activeExamId), () => renderActiveView());

    ActiveListeners.add(unsubRooms);
    ActiveListeners.add(unsubInc);
    ActiveListeners.add(unsubAtt);
  },

  // Modal: Comprehensive Full Room Intelligence Inspector
  async openRoomInspectorModal(roomId) {
    const room = await Database.get(DB.room(roomId));
    if (!room) {
      UI.toast('Room not found', 'error');
      return;
    }

    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const stats = await AttendanceHelper.getAttendanceStats(activeExamId, roomId);
    let checklist = await Database.get(DB.roomChecklist(roomId)) || {};
    let score = ReadinessCalc.calculate(checklist);

    const users = await Database.getList(DB.users());
    const userMap = new Map(users.map(u => [u.id, u.name]));
    const invigName = room.invigilatorId ? (userMap.get(room.invigilatorId) || 'Faculty Assigned') : 'Unassigned';

    const modalBody = `
      <div id="inspector-modal-wrapper">
        <!-- Room Status & Quick Actions Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);border:1px solid var(--border-subtle);">
          <div>
            <div class="text-xs text-muted">${UI.escapeHtml(room.building || 'Main Academic Block')} · Block ${UI.escapeHtml(room.block || 'A')}</div>
            <div class="text-xs font-semibold mt-0.5">Faculty: <span style="color:var(--color-charcoal);">${UI.escapeHtml(invigName)}</span></div>
          </div>
          <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm text-xs" id="btn-toggle-room-ready">
              ${room.status === 'ready' ? '<i data-lucide="clock"></i> Mark Preparing' : '<i data-lucide="check-circle"></i> Mark Ready'}
            </button>
            <button class="btn btn-secondary btn-sm text-xs" onclick="AdminModule.renderAssignInvigilatorModal('${room.id}')">
              <i data-lucide="user-check"></i> Assign Faculty
            </button>
            <button class="btn btn-danger btn-sm text-xs" onclick="AdminModule.renderNewIncidentModal('${room.id}')">
              <i data-lucide="alert-triangle"></i> Dispatch Alert
            </button>
          </div>
        </div>

        <!-- 4-Pillar Stat Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:var(--space-2);margin-bottom:var(--space-4);">
          <div class="stat-card p-3">
            <div class="stat-label text-xs">Total Capacity</div>
            <div class="stat-value text-lg mono">${room.capacity || (room.rows * room.columns) || 30}</div>
          </div>
          <div class="stat-card p-3 stat-success">
            <div class="stat-label text-xs">Verified Present</div>
            <div class="stat-value text-lg mono" style="color:var(--color-green-600);">${stats.present}</div>
          </div>
          <div class="stat-card p-3 stat-critical">
            <div class="stat-label text-xs">Marked Absent</div>
            <div class="stat-value text-lg mono" style="color:var(--color-critical);">${stats.absent}</div>
          </div>
          <div class="stat-card p-3">
            <div class="stat-label text-xs">Readiness Score</div>
            <div class="stat-value text-lg mono" id="inspector-readiness-val">${score}%</div>
          </div>
        </div>

        <!-- Inspector Tabs -->
        <div class="tabs mb-4">
          <button class="tab active" id="modal-tab-matrix">Seating Grid</button>
          <button class="tab" id="modal-tab-roll">Attendance Roll</button>
          <button class="tab" id="modal-tab-checklist">Readiness Checklist</button>
        </div>

        <!-- Dynamic Content Body -->
        <div id="inspector-tab-content" style="min-height:280px;">
          <!-- Loaded dynamically -->
        </div>
      </div>
    `;

    UI.showModal(`Room Intelligence: Room ${room.name}`, modalBody);

    const tabMatrix = document.getElementById('modal-tab-matrix');
    const tabRoll = document.getElementById('modal-tab-roll');
    const tabCheck = document.getElementById('modal-tab-checklist');
    const tabContent = document.getElementById('inspector-tab-content');
    const btnToggleReady = document.getElementById('btn-toggle-room-ready');

    // Toggle Room Status Handler
    if (btnToggleReady) {
      btnToggleReady.onclick = async () => {
        const nextStatus = room.status === 'ready' ? 'preparing' : 'ready';
        await Database.update(DB.room(room.id), {
          status: nextStatus,
          updatedAt: DB.serverTimestamp()
        });
        room.status = nextStatus;
        UI.toast(`Room status updated to ${nextStatus}`, 'success');
        UI.closeModal();
        AdminModule.renderRoomControlCenter();
      };
    }

    // 1. Tab: Desk Seating Matrix
    const showSeatingMatrix = async () => {
      tabMatrix.classList.add('active');
      tabRoll.classList.remove('active');
      tabCheck.classList.remove('active');

      tabContent.innerHTML = '<div class="text-xs text-muted">Loading seating matrix...</div>';

      const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};
      const attendanceMap = await Database.get(DB.attendance(activeExamId)) || {};
      const usersMap = await Database.get(DB.users()) || {};

      const seatMap = {};
      Object.entries(assignmentsMap).forEach(([asgnId, asgn]) => {
        if (asgn.roomId === room.id && asgn.seatNumber) {
          const att = attendanceMap[asgnId] || { status: 'unmarked' };
          const std = usersMap[asgn.studentId] || {};
          seatMap[asgn.seatNumber] = {
            assignmentId: asgnId,
            student: std,
            status: att.status
          };
        }
      });

      const rows = room.rows || 5;
      const cols = room.columns || 6;

      let gridHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);font-size:var(--text-xs);">
          <div style="display:flex;gap:var(--space-2);align-items:center;">
            <span class="legend-pill"><span class="legend-dot status-ready"></span> Present</span>
            <span class="legend-pill"><span class="legend-dot status-alert"></span> Absent</span>
            <span class="legend-pill"><span class="legend-dot status-prep"></span> Unmarked</span>
            <span class="legend-pill"><span class="legend-dot" style="background:#cbd5e1;"></span> Empty</span>
          </div>
          <span class="mono text-muted">${rows} Rows × ${cols} Columns</span>
        </div>

        <div class="modal-desk-grid" style="grid-template-columns:repeat(${cols}, 1fr);">
      `;

      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + r);
        for (let c = 1; c <= cols; c++) {
          const seatId = `${rowChar}${c}`;
          const seatData = seatMap[seatId];

          let seatClass = 'empty';
          let tooltip = `Desk ${seatId}: Empty`;

          if (seatData) {
            if (seatData.status === 'present') seatClass = 'present';
            else if (seatData.status === 'absent') seatClass = 'absent';
            else seatClass = 'assigned';
            tooltip = `Desk ${seatId}: ${seatData.student.name || 'Candidate'} (${seatData.status})`;
          }

          gridHtml += `
            <div class="desk-item ${seatClass}" data-seat-id="${seatId}" title="${UI.escapeHtml(tooltip)}">
              <span class="mono font-bold" style="font-size:0.6875rem;">${seatId}</span>
              ${seatData ? `<span class="truncate" style="font-size:0.5625rem;max-width:100%;">${UI.escapeHtml(seatData.student.name ? seatData.student.name.split(' ')[0] : 'Assigned')}</span>` : ''}
            </div>
          `;
        }
      }

      gridHtml += `</div><div id="inspector-seat-detail" class="mt-3"></div>`;
      tabContent.innerHTML = gridHtml;

      // Click on desk shows candidate dossier
      tabContent.querySelectorAll('.desk-item').forEach(desk => {
        desk.onclick = () => {
          const seatId = desk.dataset.seatId;
          const data = seatMap[seatId];
          const detailEl = document.getElementById('inspector-seat-detail');

          if (!data) {
            detailEl.innerHTML = `
              <div class="card p-3 text-xs text-muted" style="background:var(--color-off-white);">
                <strong>Desk ${seatId}:</strong> Unassigned seat. Available for emergency relocation.
              </div>
            `;
          } else {
            detailEl.innerHTML = `
              <div class="card p-3" style="background:var(--color-off-white);border-left:3px solid var(--color-green-600);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div class="font-bold text-sm">${UI.escapeHtml(data.student.name || 'Candidate')}</div>
                    <div class="text-xs text-muted mt-0.5">Reg No: <span class="mono font-semibold">${UI.escapeHtml(data.student.registerNumber || '—')}</span> · Desk: <span class="mono font-bold">${seatId}</span></div>
                  </div>
                  ${UI.statusBadge(data.status)}
                </div>
              </div>
            `;
          }
        };
      });
    };

    // 2. Tab: Attendance Roll
    const showAttendanceRoll = () => {
      tabRoll.classList.add('active');
      tabMatrix.classList.remove('active');
      tabCheck.classList.remove('active');
      AttendanceHelper.renderAttendanceTable(activeExamId, room.id, tabContent, { canEdit: false });
    };

    // 3. Tab: Pre-Flight Readiness Checklist
    const showChecklist = () => {
      tabCheck.classList.add('active');
      tabMatrix.classList.remove('active');
      tabRoll.classList.remove('active');

      tabContent.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${ReadinessCalc.CHECKLIST_ITEMS.map(item => {
            const isDone = checklist[item.id] && checklist[item.id].completed;
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) var(--space-3);background:var(--color-off-white);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:var(--text-xs);">
                <div style="display:flex;align-items:center;gap:var(--space-2);">
                  <i data-lucide="${isDone ? 'check-circle' : 'circle'}" style="width:16px;height:16px;color:${isDone ? 'var(--color-green-600)' : 'var(--color-gray-400)'};"></i>
                  <span class="${isDone ? 'font-semibold' : 'text-muted'}">${UI.escapeHtml(item.label)}</span>
                </div>
                <button class="btn btn-sm ${isDone ? 'btn-ghost text-xs' : 'btn-secondary text-xs'}" data-checklist-id="${item.id}">
                  ${isDone ? 'Verified' : 'Mark Done'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ nodes: [tabContent] });

      // Admin toggle checklist items
      tabContent.querySelectorAll('button[data-checklist-id]').forEach(btn => {
        btn.onclick = async () => {
          const itemId = btn.dataset.checklistId;
          const curr = checklist[itemId] && checklist[itemId].completed;
          const updatedItem = {
            completed: !curr,
            updatedBy: Auth.getUid(),
            updatedAt: Date.now()
          };

          await Database.update(DB.roomChecklist(room.id), {
            [itemId]: updatedItem
          });

          checklist[itemId] = updatedItem;
          score = ReadinessCalc.calculate(checklist);
          const scoreEl = document.getElementById('inspector-readiness-val');
          if (scoreEl) scoreEl.textContent = `${score}%`;
          showChecklist();
        };
      });
    };

    tabMatrix.onclick = showSeatingMatrix;
    tabRoll.onclick = showAttendanceRoll;
    tabCheck.onclick = showChecklist;

    // Default to Seating Grid tab
    showSeatingMatrix();
  },

  // Modal: Dispatch Administrative Room Incident / Alert
  async renderNewIncidentModal(roomId = '') {
    const rooms = await Database.getList(DB.rooms());
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const modalHtml = `
      <form id="admin-new-incident-form">
        <p class="text-xs text-muted mb-3">Broadcast an emergency incident or operational assistance dispatch to the invigilator and emergency teams.</p>
        
        <div class="form-group">
          <label class="form-label">Affected Room / Venue <span class="required">*</span></label>
          <select id="inc-room-select" class="form-select" required>
            <option value="">-- Select Examination Room --</option>
            ${rooms.map(r => `
              <option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)} (${UI.escapeHtml(r.building || 'Main Block')})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Incident Category <span class="required">*</span></label>
          <select id="inc-category-select" class="form-select" required>
            <option value="medical">Medical Distress / First Aid (Critical)</option>
            <option value="stationery">Question Paper / Stationery Shortage (High)</option>
            <option value="wrong_room">Seating Conflict / Unauthorized Desk (High)</option>
            <option value="admit_card">Admit Card / Identity Verification (Medium)</option>
            <option value="room_issue">Infrastructure / Lighting / Power (Medium)</option>
            <option value="other">General Operational Query (Low)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Detailed Incident Situation <span class="required">*</span></label>
          <textarea id="inc-description-input" class="form-textarea" rows="3" placeholder="Describe the immediate assistance or equipment required..." required></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-danger">
            <i data-lucide="send"></i> Dispatch Emergency Alert
          </button>
        </div>
      </form>
    `;

    UI.showModal('Dispatch Room Emergency Alert', modalHtml);

    document.getElementById('admin-new-incident-form').onsubmit = async (e) => {
      e.preventDefault();
      const rId = document.getElementById('inc-room-select').value;
      const cat = document.getElementById('inc-category-select').value;
      const desc = document.getElementById('inc-description-input').value.trim();

      if (!rId || !desc) return;

      try {
        await IncidentsHelper.createIncident({
          roomId: rId,
          category: cat,
          description: desc,
          examId: activeExamId,
          studentId: Auth.getUid()
        });

        UI.closeModal();
        UI.toast('Emergency incident dispatched and assigned', 'success');
        if (AdminModule.activeRoomControlView) {
          AdminModule.renderRoomControlCenter();
        }
      } catch (err) {
        console.error('[Incident Dispatch] Error:', err);
        UI.toast('Failed to dispatch alert: ' + err.message, 'error');
      }
    };
  },

  // 11. Reports & Examination Summary View
  async renderReports() {
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const exam = await Database.get(DB.exam(activeExamId));
    const rooms = await Database.getList(DB.rooms());
    const overallStats = await AttendanceHelper.getAttendanceStats(activeExamId);
    const allIncidents = await Database.getList(DB.incidents());
    const incStats = IncidentsHelper.getIncidentStats(allIncidents);

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Official Examination Day Summary</h2>
            <div class="page-subtitle">Generated executive audit report for ${exam ? UI.escapeHtml(exam.title) : 'Active Examination'}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i data-lucide="printer"></i> Print Official Report
          </button>
        </div>
      </div>

      <div class="card mb-6" style="border-top:4px solid var(--color-green-600);">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border-color);padding-bottom:var(--space-4);margin-bottom:var(--space-4);">
            <div>
              <h3 class="font-bold text-xl">${UI.escapeHtml(settings.institutionName || 'ExamShield Controller')}</h3>
              <div class="text-sm text-muted">Examination Audit Dossier · Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</div>
            </div>
            <span class="badge badge-success text-xs font-bold uppercase">Official Certified Report</span>
          </div>

          <!-- High-level figures -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:var(--space-4);background:var(--color-off-white);padding:var(--space-4);border-radius:var(--radius-sm);margin-bottom:var(--space-6);">
            <div>
              <div class="text-xs text-muted">Total Registered</div>
              <div class="font-bold text-xl mono">${overallStats.total}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Present Candidates</div>
              <div class="font-bold text-xl mono" style="color:var(--color-green-600);">${overallStats.present}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Absent Marked</div>
              <div class="font-bold text-xl mono" style="color:var(--color-critical);">${overallStats.absent}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Turnout Percentage</div>
              <div class="font-bold text-xl mono">${overallStats.percentage}%</div>
            </div>
            <div>
              <div class="text-xs text-muted">Emergency Incidents</div>
              <div class="font-bold text-xl mono">${incStats.total} (${incStats.resolved} Resolved)</div>
            </div>
          </div>

          <!-- Room-by-Room Roll Breakdown -->
          <div class="mb-6">
            <h4 class="font-bold text-sm uppercase text-muted mb-3">Room Turnout Verification Breakdown</h4>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Location</th>
                    <th>Scheduled</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Turnout %</th>
                  </tr>
                </thead>
                <tbody id="report-rooms-tbody">
                  <!-- Populated async -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Incident Breakdown by Priority -->
          <div>
            <h4 class="font-bold text-sm uppercase text-muted mb-3">Emergency Incidents Operational Summary</h4>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:var(--space-3);text-align:center;">
              <div style="background:var(--color-critical-bg);border:1px solid var(--color-critical);padding:var(--space-3);border-radius:var(--radius-sm);">
                <div class="text-xs font-bold" style="color:var(--color-critical);">CRITICAL EMERGENCY</div>
                <div class="font-bold text-xl mono mt-1" style="color:var(--color-critical);">${incStats.critical}</div>
              </div>
              <div style="background:var(--color-high-bg);border:1px solid var(--color-high);padding:var(--space-3);border-radius:var(--radius-sm);">
                <div class="text-xs font-bold" style="color:var(--color-high);">HIGH PRIORITY</div>
                <div class="font-bold text-xl mono mt-1" style="color:var(--color-high);">${incStats.high}</div>
              </div>
              <div style="background:var(--color-normal-bg);border:1px solid var(--color-normal);padding:var(--space-3);border-radius:var(--radius-sm);">
                <div class="text-xs font-bold" style="color:var(--color-normal);">NORMAL / INFORMATIONAL</div>
                <div class="font-bold text-xl mono mt-1" style="color:var(--color-normal);">${incStats.normal}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    // Populate room breakdown
    const tbody = document.getElementById('report-rooms-tbody');
    const rows = [];
    for (const rm of rooms) {
      const stats = await AttendanceHelper.getAttendanceStats(activeExamId, rm.id);
      rows.push(`
        <tr>
          <td class="font-bold">Room ${UI.escapeHtml(rm.name)}</td>
          <td>${UI.escapeHtml(rm.building || '')} (Block ${UI.escapeHtml(rm.block || 'A')})</td>
          <td class="mono">${stats.total}</td>
          <td class="mono" style="color:var(--color-green-600);">${stats.present}</td>
          <td class="mono" style="color:var(--color-critical);">${stats.absent}</td>
          <td class="mono font-semibold">${stats.percentage}%</td>
        </tr>
      `);
    }
    tbody.innerHTML = rows.join('');
  },

  // 12. Settings & System Administration View
  async renderSettings() {
    const settings = await Database.get(DB.settings()) || {};
    const exams = await Database.getList(DB.exams());

    const html = `
      <div class="page-header">
        <h2>System Configuration & Diagnostics</h2>
        <div class="page-subtitle">Institution parameters, session overrides, and test demonstration tooling</div>
      </div>

      <div class="card mb-6" style="max-width:640px;">
        <div class="card-header">
          <h3 class="card-title">Institution Profile</h3>
        </div>
        <div class="card-body">
          <form id="settings-profile-form">
            <div class="form-group">
              <label class="form-label">Institution / University Name</label>
              <input type="text" id="set-inst-name" class="form-input" value="${UI.escapeHtml(settings.institutionName || 'National Examination Center')}">
            </div>
            <div class="form-group">
              <label class="form-label">Active Examination Session</label>
              <select id="set-active-exam" class="form-select">
                ${exams.map(e => `<option value="${e.id}" ${e.id === settings.activeExamId ? 'selected' : ''}>${UI.escapeHtml(e.title)}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="btn btn-primary" id="btn-save-settings">Save Parameters</button>
          </form>
        </div>
      </div>

      <!-- Buildathon Demo Data Loader Section -->
      <div class="card" style="max-width:640px;border-left:4px solid var(--color-green-600);">
        <div class="card-header">
          <h3 class="card-title">Buildathon Demonstration Data Seed</h3>
        </div>
        <div class="card-body">
          <p class="text-sm text-muted mb-4">
            Populate your Firebase Realtime Database with a realistic multi-room demonstration dataset: 1 exam, 3 rooms, 3 invigilators, 25 student seat allocations, pre-marked attendance, and emergency incident tickets.
          </p>
          <button class="btn btn-secondary" onclick="window.loadDemoData ? window.loadDemoData() : alert('Load demo-data.js script first')">
            <i data-lucide="database"></i> Load Complete Demo Dataset
          </button>
        </div>
      </div>
    `;

    UI.renderPage(html);

    document.getElementById('settings-profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-settings');
      UI.setLoading(btn, true);

      await Database.update(DB.settings(), {
        institutionName: document.getElementById('set-inst-name').value.trim(),
        activeExamId: document.getElementById('set-active-exam').value,
        updatedAt: DB.serverTimestamp()
      });

      UI.setLoading(btn, false);
      UI.toast('System settings saved', 'success');
    };
  }
};

console.log('[ExamShield] Admin module loaded');
