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
      case 'whatsapp':
        WhatsAppHelper.renderWhatsAppPage(document.getElementById('page-content'));
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
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/whatsapp')">
              <i data-lucide="message-circle"></i> WhatsApp Broadcast
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
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Examination Schedules</h2>
            <div class="page-subtitle">Configure examination papers, active sessions, and time slots</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminModule.renderNewExamModal()">
            <i data-lucide="plus"></i> Create Examination
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title / Subject</th>
              <th>Date</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Active Session</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${exams.map(ex => `
              <tr>
                <td class="font-semibold">${UI.escapeHtml(ex.title)}</td>
                <td>${UI.formatDate(ex.date)}</td>
                <td class="mono text-xs">${ex.startTime} – ${ex.endTime}</td>
                <td>${UI.statusBadge(ex.status || 'scheduled')}</td>
                <td>
                  ${ex.id === activeExamId
                    ? '<span class="badge badge-success">ACTIVE SESSION</span>'
                    : `<button class="btn btn-secondary btn-sm" onclick="AdminModule.setActiveExam('${ex.id}')">Make Active</button>`}
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-ghost btn-sm" onclick="AdminModule.renderEditExamModal('${ex.id}')">
                    <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
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

  // Modal: Create new exam
  renderNewExamModal() {
    const modalHtml = `
      <form id="new-exam-form">
        <div class="form-group">
          <label class="form-label">Subject / Title <span class="required">*</span></label>
          <input type="text" id="exam-title" class="form-input" placeholder="e.g. CS301 — Data Structures & Algorithms" required>
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

    document.getElementById('new-exam-form').onsubmit = async (e) => {
      e.preventDefault();
      const examId = generateId('exam');
      const record = {
        id: examId,
        title: document.getElementById('exam-title').value.trim(),
        date: document.getElementById('exam-date').value,
        startTime: document.getElementById('exam-start').value,
        endTime: document.getElementById('exam-end').value,
        status: document.getElementById('exam-status').value,
        createdAt: DB.serverTimestamp()
      };

      await Database.set(DB.exam(examId), record);
      // Auto set as active if chosen
      if (record.status === 'active') {
        await Database.update(DB.settings(), { activeExamId: examId });
      }

      UI.closeModal();
      UI.toast('Examination created successfully', 'success');
      AdminModule.renderExams();
    };
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

  // 4. Student Management View
  async renderStudents() {
    const users = await Database.getList(DB.users());
    const students = users.filter(u => u.role === 'student');

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2>Candidate Roster</h2>
            <div class="page-subtitle">Enrolled students eligible for examination sitting</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('admin/import')">
            <i data-lucide="upload"></i> Bulk CSV Import
          </button>
        </div>
      </div>

      <div class="search-box">
        <i data-lucide="search"></i>
        <input type="text" class="form-input" id="student-search-input" placeholder="Search by name, register number, or class...">
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Candidate Name</th>
              <th>Register Number</th>
              <th>Email</th>
              <th>Class / Batch</th>
              <th>Account Status</th>
            </tr>
          </thead>
          <tbody id="student-table-body">
            ${students.map(s => `
              <tr data-search="${UI.escapeHtml((s.name + ' ' + (s.registerNumber || '') + ' ' + (s.classId || '')).toLowerCase())}">
                <td class="font-semibold">${UI.escapeHtml(s.name)}</td>
                <td class="mono font-semibold text-xs">${UI.escapeHtml(s.registerNumber || '—')}</td>
                <td class="text-xs text-muted">${UI.escapeHtml(s.email)}</td>
                <td><span class="badge badge-muted">${UI.escapeHtml(s.classId || 'Standard')}</span></td>
                <td>${s.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    UI.renderPage(html);

    document.getElementById('student-search-input').oninput = UI.debounce((e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#student-table-body tr').forEach(tr => {
        const text = tr.dataset.search || '';
        tr.style.display = text.includes(q) ? '' : 'none';
      });
    }, 200);
  },

  // 5. Invigilator Management View
  async renderInvigilators() {
    const users = await Database.getList(DB.users());
    const invigilators = users.filter(u => u.role === 'invigilator');
    const invigProfiles = await Database.getList(DB.invigilators());
    const profMap = new Map();
    invigProfiles.forEach(p => profMap.set(p.id, p));

    const html = `
      <div class="page-header">
        <h2>Invigilator Registry & Workload</h2>
        <div class="page-subtitle">Supervising faculty availability and active incident distribution</div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Faculty Name</th>
              <th>Email Address</th>
              <th>Availability</th>
              <th>Active Incidents Load</th>
              <th>Duty Status</th>
            </tr>
          </thead>
          <tbody>
            ${invigilators.map(inv => {
              const prof = profMap.get(inv.id) || {};
              const load = prof.activeIncidentCount || 0;
              const isAvail = prof.available !== false;
              return `
                <tr>
                  <td class="font-semibold">${UI.escapeHtml(inv.name)}</td>
                  <td class="text-xs text-muted">${UI.escapeHtml(inv.email)}</td>
                  <td>
                    ${isAvail ? '<span class="badge badge-success">Available</span>' : '<span class="badge badge-muted">Off Duty</span>'}
                  </td>
                  <td class="mono font-bold text-xs" style="color:${load > 0 ? 'var(--color-critical)' : 'inherit'};">
                    ${load} active
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="AdminModule.toggleInvigilatorAvailability('${inv.id}', ${!isAvail})">
                      Set ${isAvail ? 'Off Duty' : 'Available'}
                    </button>
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

    const loadAllocations = async () => {
      const exId = examSelect.value;
      const rmId = roomSelect.value;
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
                <th>Register Number</th>
                <th>QR Pass Token</th>
                <th>Allocation State</th>
              </tr>
            </thead>
            <tbody>
              ${roomAsgns.map(a => {
                const s = userMap.get(a.studentId) || {};
                return `
                  <tr>
                    <td class="font-bold mono text-sm" style="color:var(--color-green-600);">${UI.escapeHtml(a.seatNumber)}</td>
                    <td class="font-semibold">${UI.escapeHtml(s.name || 'Candidate')}</td>
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

      const users = await Database.getList(DB.users());
      const students = users.filter(u => u.role === 'student');
      const existingAsgns = await Database.get(DB.assignments(exId)) || {};

      const assignedStudentIds = new Set(Object.values(existingAsgns).map(a => a.studentId));
      const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id));

      if (!unassignedStudents.length) {
        UI.toast('All registered students already possess seat allocations!', 'info');
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
      UI.confirm(
        'Confirm Auto-Allocation',
        `Allocate ${countToAllocate} unassigned candidates to Room ${room.name}? QR tokens will be generated automatically.`,
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
  async renderRoomControlCenter() {
    const rooms = await Database.getList(DB.rooms());
    const buildings = await Database.getList(DB.buildings());
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Room Visualization Center</h2>
            <div class="page-subtitle">Interactive floor plan mapping, physical room intelligence, and live occupancy</div>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <select class="form-select text-xs" id="ctrl-building-select">
              <option value="all">All Buildings (Composite View)</option>
              ${buildings.map(b => `<option value="${b.id}">${UI.escapeHtml(b.name)}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-sm" onclick="AdminModule.renderNewRoomModal()">
              <i data-lucide="plus"></i> Add Room
            </button>
          </div>
        </div>
      </div>

      <!-- Interactive Visual Floor Plan -->
      <div class="card mb-6">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3 class="card-title">Campus Floor Plan & Spatial Room Mapping</h3>
          <div style="display:flex;gap:var(--space-3);align-items:center;font-size:var(--text-xs);">
            <span style="display:flex;align-items:center;gap:4px;"><span class="status-dot present"></span> Ready / Ongoing</span>
            <span style="display:flex;align-items:center;gap:4px;"><span class="status-dot critical"></span> Assistance Required</span>
            <span style="display:flex;align-items:center;gap:4px;"><span class="status-dot unmarked"></span> Preparing</span>
          </div>
        </div>
        <div class="card-body">
          <div class="floor-plan" id="campus-floor-plan" style="min-height:360px;">
            <!-- Dynamic room blocks positioned via floorPlanPosition -->
          </div>
        </div>
      </div>

      <!-- Room Intelligence Grid -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Live Venue Intelligence Directory</h3>
        </div>
        <div class="card-body" id="room-intelligence-grid">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    UI.renderPage(html);

    const floorPlan = document.getElementById('campus-floor-plan');
    const intelGrid = document.getElementById('room-intelligence-grid');

    const updateVisualization = async () => {
      const allRooms = await Database.getList(DB.rooms());
      const allIncidents = await Database.getList(DB.incidents());
      const activeIncidents = allIncidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
      const checklists = await Database.get(DB.ref('roomChecklists')) || {};
      const users = await Database.getList(DB.users());
      const userMap = new Map(users.map(u => [u.id, u.name]));

      // Render Floor Plan
      floorPlan.innerHTML = allRooms.map((rm, idx) => {
        const pos = rm.floorPlanPosition || { x: (idx % 2) * 50 + 5, y: Math.floor(idx / 2) * 45 + 5, width: 42, height: 40 };
        const roomIncidents = activeIncidents.filter(i => i.roomId === rm.id);
        const hasCritical = roomIncidents.some(i => i.priority === 'critical');

        let statusClass = 'status-ready';
        if (hasCritical) statusClass = 'status-assistance';
        else if (rm.status === 'not-ready') statusClass = 'status-not-ready';
        else if (rm.status === 'preparing') statusClass = 'status-preparing';

        return `
          <div class="floor-plan-room ${statusClass}" style="left:${pos.x}%;top:${pos.y}%;width:${pos.width}%;height:${pos.height}%;" onclick="AdminModule.openRoomInspectorModal('${rm.id}')">
            <span class="room-status-indicator"></span>
            <div class="room-label">Room ${UI.escapeHtml(rm.name)}</div>
            <div class="room-occupancy">${rm.capacity} Seats · Block ${UI.escapeHtml(rm.block || 'A')}</div>
            ${roomIncidents.length > 0 ? `
              <div style="margin-top:4px;">
                <span class="badge ${hasCritical ? 'badge-critical' : 'badge-warning'}" style="font-size:0.625rem;">
                  ${roomIncidents.length} Alert(s)
                </span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Render Intelligence Grid Cards
      intelGrid.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:var(--space-4);">
          ${allRooms.map(rm => {
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
                    <div><span class="text-muted">Capacity:</span> <span class="font-semibold mono">${rm.capacity} Seats</span></div>
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
                    Inspect Room Seating & Roll &rarr;
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    };

    updateVisualization();

    const unsub = Database.listen(DB.rooms(), () => updateVisualization());
    const unsubInc = Database.listen(DB.incidents(), () => updateVisualization());
    ActiveListeners.add(unsub);
    ActiveListeners.add(unsubInc);
  },

  // Modal: Full Room Intelligence Inspector
  async openRoomInspectorModal(roomId) {
    const room = await Database.get(DB.room(roomId));
    if (!room) return;

    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const stats = await AttendanceHelper.getAttendanceStats(activeExamId, roomId);
    const checklist = await Database.get(DB.roomChecklist(roomId)) || {};
    const score = ReadinessCalc.calculate(checklist);

    const modalBody = `
      <div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:var(--space-2);margin-bottom:var(--space-4);">
          <div class="stat-card p-3">
            <div class="stat-label text-xs">Capacity</div>
            <div class="stat-value text-lg mono">${room.capacity}</div>
          </div>
          <div class="stat-card p-3 stat-success">
            <div class="stat-label text-xs">Present</div>
            <div class="stat-value text-lg mono" style="color:var(--color-green-600);">${stats.present}</div>
          </div>
          <div class="stat-card p-3 stat-critical">
            <div class="stat-label text-xs">Absent</div>
            <div class="stat-value text-lg mono" style="color:var(--color-critical);">${stats.absent}</div>
          </div>
          <div class="stat-card p-3">
            <div class="stat-label text-xs">Readiness</div>
            <div class="stat-value text-lg mono">${score}%</div>
          </div>
        </div>

        <div class="tabs mb-4">
          <button class="tab active" id="modal-tab-roll">Attendance Roll</button>
          <button class="tab" id="modal-tab-checklist">Checklist</button>
        </div>

        <div id="modal-tab-content">
          <!-- Loaded dynamically -->
        </div>
      </div>
    `;

    UI.showModal(`Room Intelligence: Room ${room.name}`, modalBody);

    const tabRoll = document.getElementById('modal-tab-roll');
    const tabCheck = document.getElementById('modal-tab-checklist');
    const tabContent = document.getElementById('modal-tab-content');

    const showRoll = () => {
      tabRoll.classList.add('active');
      tabCheck.classList.remove('active');
      AttendanceHelper.renderAttendanceTable(activeExamId, roomId, tabContent, { canEdit: false });
    };

    const showChecklist = () => {
      tabCheck.classList.add('active');
      tabRoll.classList.remove('active');
      tabContent.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${ReadinessCalc.CHECKLIST_ITEMS.map(item => {
            const isDone = checklist[item.id] && checklist[item.id].completed;
            return `
              <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-xs);">
                <i data-lucide="${isDone ? 'check-circle' : 'circle'}" style="width:16px;height:16px;color:${isDone ? 'var(--color-green-600)' : 'var(--color-gray-300)'};"></i>
                <span class="${isDone ? 'line-through text-muted' : 'font-medium'}">${UI.escapeHtml(item.label)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      lucide.createIcons({ nodes: [tabContent] });
    };

    tabRoll.onclick = showRoll;
    tabCheck.onclick = showChecklist;
    showRoll();
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
