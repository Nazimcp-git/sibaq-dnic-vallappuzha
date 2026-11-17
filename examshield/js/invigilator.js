// ExamShield — Invigilator Module
// Operational cockpit for room invigilators: verification, live roll, seating occupancy, readiness, and incident handling.

const InvigilatorModule = {
  selectedRoomId: null,

  // Main dispatcher
  async render(page) {
    switch (page) {
      case 'dashboard':
        await this.renderDashboard();
        break;
      case 'rooms':
        await this.renderRooms();
        break;
      case 'scanner':
        await this.renderScanner();
        break;
      case 'attendance':
        await this.renderAttendance();
        break;
      case 'seat-map':
        await this.renderSeatMap();
        break;
      case 'readiness':
        await this.renderReadiness();
        break;
      case 'incidents':
        await this.renderIncidents();
        break;
      case 'announcements':
        await this.renderAnnouncements();
        break;
      default:
        await this.renderDashboard();
    }
  },

  // Helper: get invigilator's authorized rooms
  async getAuthorizedRooms() {
    const uid = Auth.getUid();
    const rooms = await Database.getList(DB.rooms());
    const invData = await Database.get(DB.invigilator(uid)) || {};
    const assignedRoomsMap = invData.assignedRooms || {};

    // Filter rooms where invigilatorId matches or listed in assignedRooms map
    const myRooms = rooms.filter(r => {
      return r.invigilatorId === uid || assignedRoomsMap[r.id] === true || Object.values(assignedRoomsMap).includes(r.id);
    });

    // Default fallback to first room if none assigned
    if (!myRooms.length && rooms.length) {
      myRooms.push(rooms[0]);
    }

    if (!this.selectedRoomId && myRooms.length) {
      this.selectedRoomId = myRooms[0].id;
    }

    return myRooms;
  },

  // 1. Dashboard View
  async renderDashboard() {
    const myRooms = await this.getAuthorizedRooms();
    const currentRoom = myRooms.find(r => r.id === this.selectedRoomId) || myRooms[0];
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';
    const exam = await Database.get(DB.exam(activeExamId));

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);">
          <div>
            <h2>Invigilator Command Center</h2>
            <div class="page-subtitle">Welcome, ${UI.escapeHtml(Auth.getUserName())} · Active Examination Operations</div>
          </div>
          ${myRooms.length > 1 ? `
            <div>
              <select class="form-select text-xs font-semibold" id="inv-room-selector">
                ${myRooms.map(r => `<option value="${r.id}" ${r.id === currentRoom.id ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)} (${UI.escapeHtml(r.building || '')})</option>`).join('')}
              </select>
            </div>
          ` : `<span class="badge badge-normal font-semibold">Room ${UI.escapeHtml(currentRoom ? currentRoom.name : '—')}</span>`}
        </div>
      </div>

      <!-- Urgent Incidents Alert Banner if applicable -->
      <div id="inv-urgent-alert-banner"></div>

      <!-- Live Operational Stats -->
      <div id="inv-stats-cards-container">
        <div class="text-xs text-muted">Calculating real-time occupancy and readiness metrics...</div>
      </div>

      <!-- Action Grid -->
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:var(--space-3);margin-bottom:var(--space-6);" class="md:grid-cols-4">
        <button class="btn btn-primary" onclick="Router.navigate('invigilator/scanner')">
          <i data-lucide="scan"></i> Launch QR Scanner
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('invigilator/attendance')">
          <i data-lucide="clipboard-check"></i> Roll Call Attendance
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('invigilator/seat-map')">
          <i data-lucide="grid-3x3"></i> Visual Seat Map
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('invigilator/readiness')">
          <i data-lucide="check-circle"></i> Room Readiness
        </button>
      </div>

      <!-- Two-Column Operational Panels -->
      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-2">
        <!-- Assigned Incidents Panel -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Assigned Emergency Incidents</h3>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('invigilator/incidents')">View All</button>
          </div>
          <div class="card-body" id="inv-incidents-mini-container">
            <div class="text-xs text-muted">Connecting incident ledger...</div>
          </div>
        </div>

        <!-- Room Readiness Status -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Room Readiness & Pre-Flight</h3>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('invigilator/readiness')">Open Checklist</button>
          </div>
          <div class="card-body" id="inv-readiness-mini-container">
            <div class="text-xs text-muted">Loading checklist state...</div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    // Room selector change
    const roomSelector = document.getElementById('inv-room-selector');
    if (roomSelector) {
      roomSelector.onchange = () => {
        this.selectedRoomId = roomSelector.value;
        this.renderDashboard();
      };
    }

    if (!currentRoom) return;

    // Listeners for live stats and incidents
    const unsubAtt = Database.listen(DB.attendance(activeExamId), async () => {
      const stats = await AttendanceHelper.getAttendanceStats(activeExamId, currentRoom.id);
      const container = document.getElementById('inv-stats-cards-container');
      if (container) {
        AttendanceHelper.renderAttendanceStats(stats, container);
      }
    });

    const unsubInc = Database.listen(DB.incidents(), (incidentsMap) => {
      const miniContainer = document.getElementById('inv-incidents-mini-container');
      const urgentBanner = document.getElementById('inv-urgent-alert-banner');
      if (!miniContainer) return;

      const uid = Auth.getUid();
      const allIncidents = Object.entries(incidentsMap || {}).map(([id, val]) => ({ id, ...val }));
      const myIncidents = allIncidents.filter(inc => inc.assignedTo === uid || (inc.roomId === currentRoom.id && inc.status === 'submitted'));

      // Check for critical incidents
      const criticalPending = myIncidents.filter(i => i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed');
      if (urgentBanner) {
        if (criticalPending.length > 0) {
          urgentBanner.innerHTML = `
            <div style="background:var(--color-critical-bg);border:2px solid var(--color-critical);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-6);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div class="font-bold text-sm" style="color:var(--color-critical);display:flex;align-items:center;gap:6px;">
                  <span class="status-dot critical"></span> URGENT MEDICAL / SAFETY INCIDENT REPORTED
                </div>
                <div class="text-xs text-muted mt-1">${criticalPending[0].description}</div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="IncidentsHelper.renderIncidentDetail('${criticalPending[0].id}')">Respond Immediately</button>
            </div>
          `;
        } else {
          urgentBanner.innerHTML = '';
        }
      }

      if (!myIncidents.length) {
        miniContainer.innerHTML = '<p class="text-xs text-muted">No pending incidents reported in your room.</p>';
      } else {
        PriorityEngine.sortIncidents(myIncidents);
        miniContainer.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            ${myIncidents.slice(0, 4).map(inc => `
              <div class="incident-card priority-${inc.priority}" style="margin-bottom:0;cursor:pointer;" onclick="IncidentsHelper.renderIncidentDetail('${inc.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div class="font-semibold text-xs text-dark">${UI.escapeHtml(INCIDENT_CATEGORIES[inc.category] || inc.category)}</div>
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
    });

    // Room readiness mini score
    const unsubReady = Database.listen(DB.roomChecklists(currentRoom.id), (checklist) => {
      const miniContainer = document.getElementById('inv-readiness-mini-container');
      if (!miniContainer) return;

      const score = ReadinessCalc.calculate(checklist);
      const status = ReadinessCalc.getStatus(score);

      miniContainer.innerHTML = `
        <div style="text-align:center;padding:var(--space-4) 0;">
          <div class="font-bold" style="font-size:2.5rem;color:${score >= 100 ? 'var(--color-green-600)' : 'var(--color-charcoal)'};">${score}%</div>
          <div class="text-xs text-muted mt-1">Pre-examination Readiness Score</div>
          <div class="mt-2">${UI.statusBadge(status)}</div>
        </div>
        <div class="progress-bar mb-3">
          <div class="progress-fill ${score < 50 ? 'low' : (score < 100 ? 'medium' : '')}" style="width:${score}%;"></div>
        </div>
        <div style="text-align:center;">
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('invigilator/readiness')">Review Checklist Items</button>
        </div>
      `;
    });

    ActiveListeners.add(unsubAtt);
    ActiveListeners.add(unsubInc);
    ActiveListeners.add(unsubReady);
  },

  // 2. Rooms List View
  async renderRooms() {
    const myRooms = await this.getAuthorizedRooms();

    const html = `
      <div class="page-header">
        <h2>Assigned Examination Rooms</h2>
        <div class="page-subtitle">Venues under your supervision and invigilation responsibility</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:var(--space-4);">
        ${myRooms.map(rm => `
          <div class="card" style="border-top:3px solid var(--color-green-600);">
            <div class="card-header">
              <h3 class="card-title">Room ${UI.escapeHtml(rm.name)}</h3>
              <span class="badge badge-normal">Block ${UI.escapeHtml(rm.block || 'A')}</span>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);font-size:var(--text-xs);">
                <div>
                  <div class="text-muted">Building</div>
                  <div class="font-semibold">${UI.escapeHtml(rm.building || 'Main Block')}</div>
                </div>
                <div>
                  <div class="text-muted">Seating Capacity</div>
                  <div class="font-semibold mono">${rm.capacity || (rm.rows * rm.columns)} Desks</div>
                </div>
                <div>
                  <div class="text-muted">Grid Dimensions</div>
                  <div class="font-semibold mono">${rm.rows || 5} × ${rm.columns || 6}</div>
                </div>
                <div>
                  <div class="text-muted">Operational State</div>
                  <div class="font-semibold capitalize">${UI.escapeHtml(rm.status || 'Ready')}</div>
                </div>
              </div>

              <div style="display:flex;gap:var(--space-2);">
                <button class="btn btn-primary btn-sm btn-full" onclick="InvigilatorModule.selectedRoomId='${rm.id}'; Router.navigate('invigilator/scanner');">
                  <i data-lucide="scan"></i> Scan Room
                </button>
                <button class="btn btn-secondary btn-sm btn-full" onclick="InvigilatorModule.selectedRoomId='${rm.id}'; Router.navigate('invigilator/attendance');">
                  <i data-lucide="clipboard-check"></i> Attendance
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    UI.renderPage(html);
  },

  // 3. QR Verification Scanner View
  async renderScanner() {
    const myRooms = await this.getAuthorizedRooms();
    const currentRoom = myRooms.find(r => r.id === this.selectedRoomId) || myRooms[0];
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>QR Candidate Verification</h2>
            <div class="page-subtitle">Verifying for Room: <span class="font-bold text-dark">${UI.escapeHtml(currentRoom ? currentRoom.name : '—')}</span></div>
          </div>
          ${myRooms.length > 1 ? `
            <select class="form-select text-xs" id="scanner-room-select">
              ${myRooms.map(r => `<option value="${r.id}" ${r.id === currentRoom.id ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)}</option>`).join('')}
            </select>
          ` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-2">
        <!-- Live Scanner Viewport -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Biometric QR Camera Scanner</h3>
            <span class="badge badge-success">Live Viewport</span>
          </div>
          <div class="card-body">
            <div id="qr-reader" style="width:100%;border-radius:var(--radius-sm);overflow:hidden;background:var(--color-black);"></div>

            <!-- Manual Register Number Fallback -->
            <div style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-color);">
              <label class="form-label text-xs font-semibold">Manual Roll Number Verification Fallback</label>
              <div style="display:flex;gap:var(--space-2);">
                <input type="text" class="form-input text-xs mono" id="manual-verify-reg" placeholder="Enter register number (e.g. REG2024001)">
                <button class="btn btn-secondary btn-sm" id="btn-manual-verify">Verify</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Verification Result Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Candidate Identity Feedback</h3>
          </div>
          <div class="card-body" id="qr-result-display">
            <div class="empty-state">
              <i data-lucide="scan"></i>
              <h3>Scanner Ready</h3>
              <p>Position candidate's digital or printed QR pass in front of the lens.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const roomSelect = document.getElementById('scanner-room-select');
    if (roomSelect) {
      roomSelect.onchange = () => {
        this.selectedRoomId = roomSelect.value;
        QRHelper.stopScanner();
        this.renderScanner();
      };
    }

    const resultContainer = document.getElementById('qr-result-display');

    // Handle token verification
    const handleVerifyToken = async (tokenString) => {
      UI.toast('Processing QR cryptographic token...', 'info', 1500);
      const result = await QRHelper.verifyToken(tokenString, currentRoom ? currentRoom.id : null);

      QRHelper.renderVerificationResult(result, resultContainer, async (validResult) => {
        // Invigilator clicked "Mark Present"
        try {
          await AttendanceHelper.markAttendance(
            activeExamId,
            validResult.assignment.id || ('asgn_' + validResult.assignment.registerNumber),
            'present',
            Auth.getUid()
          );
          UI.toast(`Candidate ${validResult.student.name} confirmed present!`, 'success');
          // Re-render as confirmed present
          validResult.status = 'already-present';
          validResult.message = 'Candidate confirmed present in official attendance roll.';
          QRHelper.renderVerificationResult(validResult, resultContainer, null);
        } catch (err) {
          UI.toast('Failed to record attendance: ' + err.message, 'error');
        }
      });
    };

    // Initialize scanner
    setTimeout(() => {
      QRHelper.initScanner('qr-reader', (decodedText) => {
        handleVerifyToken(decodedText);
      });
    }, 200);

    // Manual fallback
    document.getElementById('btn-manual-verify').onclick = async () => {
      const reg = document.getElementById('manual-verify-reg').value.trim();
      if (!reg) return;

      const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};
      let foundAsgn = null;
      for (const asgn of Object.values(assignmentsMap)) {
        if (asgn.registerNumber && asgn.registerNumber.toUpperCase() === reg.toUpperCase()) {
          foundAsgn = asgn;
          break;
        }
      }

      if (!foundAsgn || !foundAsgn.qrToken) {
        QRHelper.renderVerificationResult({
          valid: false,
          status: 'not-found',
          message: `No candidate assignment found for register number ${reg}`
        }, resultContainer);
        return;
      }

      await handleVerifyToken(foundAsgn.qrToken);
    };
  },

  // 4. Live Attendance View
  async renderAttendance() {
    const myRooms = await this.getAuthorizedRooms();
    const currentRoom = myRooms.find(r => r.id === this.selectedRoomId) || myRooms[0];
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Room Attendance Ledger</h2>
            <div class="page-subtitle">Mark present/absent candidates with cryptographic audit trail</div>
          </div>
          ${myRooms.length > 1 ? `
            <select class="form-select text-xs" id="att-room-select">
              ${myRooms.map(r => `<option value="${r.id}" ${r.id === currentRoom.id ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)}</option>`).join('')}
            </select>
          ` : `<span class="badge badge-normal">Room ${UI.escapeHtml(currentRoom ? currentRoom.name : '—')}</span>`}
        </div>
      </div>

      <div id="inv-attendance-stats-holder" class="mb-4"></div>
      <div id="inv-attendance-table-holder"></div>
    `;

    UI.renderPage(html);

    const roomSelect = document.getElementById('att-room-select');
    if (roomSelect) {
      roomSelect.onchange = () => {
        this.selectedRoomId = roomSelect.value;
        this.renderAttendance();
      };
    }

    if (!currentRoom) return;

    // Load room stats
    AttendanceHelper.getAttendanceStats(activeExamId, currentRoom.id).then(stats => {
      const statsHolder = document.getElementById('inv-attendance-stats-holder');
      if (statsHolder) AttendanceHelper.renderAttendanceStats(stats, statsHolder);
    });

    // Render interactive attendance table with edit buttons
    AttendanceHelper.renderAttendanceTable(activeExamId, currentRoom.id, document.getElementById('inv-attendance-table-holder'), {
      canEdit: true
    });
  },

  // 5. Seat Occupancy Map View
  async renderSeatMap() {
    const myRooms = await this.getAuthorizedRooms();
    const currentRoom = myRooms.find(r => r.id === this.selectedRoomId) || myRooms[0];
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Interactive Seat Occupancy Map</h2>
            <div class="page-subtitle">Visual grid of desks and live student presence for Room ${UI.escapeHtml(currentRoom ? currentRoom.name : '—')}</div>
          </div>
          ${myRooms.length > 1 ? `
            <select class="form-select text-xs" id="map-room-select">
              ${myRooms.map(r => `<option value="${r.id}" ${r.id === currentRoom.id ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)}</option>`).join('')}
            </select>
          ` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-3">
        <!-- Main Seating Canvas -->
        <div class="card lg:col-span-2">
          <div class="card-header">
            <h3 class="card-title">Seating Matrix (${currentRoom ? `${currentRoom.rows} rows × ${currentRoom.columns} columns` : ''})</h3>
          </div>
          <div class="card-body">
            <div style="background:var(--color-gray-100);padding:8px;border-radius:var(--radius-sm);text-align:center;font-size:var(--text-xs);font-weight:600;margin-bottom:var(--space-4);color:var(--color-gray-600);">
              BOARD / FRONT OF EXAMINATION HALL (INVIGILATOR DESK)
            </div>

            <div style="overflow-x:auto;padding-bottom:var(--space-4);display:flex;justify-content:center;">
              <div id="inv-seating-grid" class="seat-grid"></div>
            </div>

            <div style="background:var(--color-gray-100);padding:6px;border-radius:var(--radius-sm);text-align:center;font-size:var(--text-xs);margin-top:var(--space-3);color:var(--color-gray-500);">
              REAR ENTRANCE / CORRIDOR ACCESS
            </div>

            <div class="seat-legend mt-4">
              <div class="legend-item"><span class="legend-color" style="background:var(--color-green-100);border-color:var(--color-green-500);"></span> Present</div>
              <div class="legend-item"><span class="legend-color" style="background:var(--color-critical-bg);border-color:var(--color-critical);"></span> Absent</div>
              <div class="legend-item"><span class="legend-color" style="background:var(--color-gray-100);border-color:var(--color-gray-300);"></span> Assigned (Unmarked)</div>
              <div class="legend-item"><span class="legend-color" style="background:var(--color-off-white);border-color:var(--border-subtle);"></span> Empty Desk</div>
            </div>
          </div>
        </div>

        <!-- Selected Seat Inspector Panel -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Seat Inspector</h3>
          </div>
          <div class="card-body" id="seat-inspector-panel">
            <div class="empty-state">
              <i data-lucide="info"></i>
              <h3>Select a Desk</h3>
              <p class="text-xs">Click any desk position in the grid to inspect candidate identity and attendance status.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const roomSelect = document.getElementById('map-room-select');
    if (roomSelect) {
      roomSelect.onchange = () => {
        this.selectedRoomId = roomSelect.value;
        this.renderSeatMap();
      };
    }

    if (!currentRoom) return;

    // Load data and set up real-time listener
    const gridContainer = document.getElementById('inv-seating-grid');
    const inspector = document.getElementById('seat-inspector-panel');

    const renderGrid = async () => {
      const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};
      const attendanceMap = await Database.get(DB.attendance(activeExamId)) || {};
      const usersMap = await Database.get(DB.users()) || {};

      // Build seat lookup
      const seatAssignmentMap = {};
      Object.entries(assignmentsMap).forEach(([asgnId, asgn]) => {
        if (asgn.roomId === currentRoom.id && asgn.seatNumber) {
          const att = attendanceMap[asgnId] || { status: 'unmarked' };
          const student = usersMap[asgn.studentId] || {};
          seatAssignmentMap[asgn.seatNumber] = {
            assignmentId: asgnId,
            assignment: asgn,
            student: student,
            status: att.status
          };
        }
      });

      const rows = currentRoom.rows || 5;
      const cols = currentRoom.columns || 6;
      gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

      let gridHtml = '';
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + r);
        for (let c = 1; c <= cols; c++) {
          const seatId = `${rowChar}${c}`;
          const seatData = seatAssignmentMap[seatId];

          let seatClass = 'empty';
          if (seatData) {
            if (seatData.status === 'present') seatClass = 'present';
            else if (seatData.status === 'absent') seatClass = 'absent';
            else seatClass = 'assigned';
          }

          gridHtml += `
            <div class="seat ${seatClass}" data-seat="${seatId}" title="Seat ${seatId}">
              ${seatId}
            </div>
          `;
        }
      }

      gridContainer.innerHTML = gridHtml;

      // Click seat inspection
      gridContainer.querySelectorAll('.seat').forEach(seatEl => {
        seatEl.onclick = () => {
          gridContainer.querySelectorAll('.seat').forEach(s => s.classList.remove('selected'));
          seatEl.classList.add('selected');

          const seatId = seatEl.dataset.seat;
          const seatData = seatAssignmentMap[seatId];

          if (!seatData) {
            inspector.innerHTML = `
              <div style="text-align:center;padding:var(--space-6) 0;">
                <div class="mono font-bold text-3xl text-muted mb-2">${seatId}</div>
                <span class="badge badge-muted">Unassigned Desk</span>
                <p class="text-xs text-muted mt-3">This seat is currently empty with no student assigned.</p>
              </div>
            `;
            return;
          }

          const { student, assignment, status, assignmentId } = seatData;
          inspector.innerHTML = `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border-color);padding-bottom:var(--space-3);margin-bottom:var(--space-3);">
                <div>
                  <div class="text-xs uppercase text-muted">Desk Allocation</div>
                  <h3 class="font-bold mono text-2xl" style="color:var(--color-green-600);">${seatId}</h3>
                </div>
                ${UI.statusBadge(status)}
              </div>

              <div style="display:flex;flex-direction:column;gap:var(--space-3);font-size:var(--text-sm);margin-bottom:var(--space-6);">
                <div>
                  <div class="text-xs text-muted">Student Name</div>
                  <div class="font-semibold text-base">${UI.escapeHtml(student.name || 'Candidate')}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">Register Number</div>
                  <div class="font-semibold mono">${UI.escapeHtml(assignment.registerNumber || student.registerNumber || '—')}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">Class Batch</div>
                  <div>${UI.escapeHtml(student.classId || 'Standard')}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">QR Pass State</div>
                  <div class="mono text-xs">${assignment.qrToken ? '<span class="badge badge-success">Token Issued</span>' : '<span class="badge badge-warning">No Token</span>'}</div>
                </div>
              </div>

              <div style="display:flex;gap:var(--space-2);">
                <button class="btn btn-primary btn-sm btn-full" id="btn-inspect-present">
                  <i data-lucide="check"></i> Mark Present
                </button>
                <button class="btn btn-danger btn-sm btn-full" id="btn-inspect-absent">
                  <i data-lucide="x"></i> Mark Absent
                </button>
              </div>
            </div>
          `;

          lucide.createIcons({ nodes: [inspector] });

          document.getElementById('btn-inspect-present').onclick = async () => {
            await AttendanceHelper.markAttendance(activeExamId, assignmentId, 'present', Auth.getUid());
            UI.toast(`Seat ${seatId} marked present`, 'success');
            renderGrid();
          };

          document.getElementById('btn-inspect-absent').onclick = async () => {
            await AttendanceHelper.markAttendance(activeExamId, assignmentId, 'absent', Auth.getUid());
            UI.toast(`Seat ${seatId} marked absent`, 'info');
            renderGrid();
          };
        };
      });
    };

    renderGrid();

    // Listen for real-time attendance changes
    const unsub = Database.listen(DB.attendance(activeExamId), () => renderGrid());
    ActiveListeners.add(unsub);
  },

  // 6. Room Readiness Checklist View
  async renderReadiness() {
    const myRooms = await this.getAuthorizedRooms();
    const currentRoom = myRooms.find(r => r.id === this.selectedRoomId) || myRooms[0];

    const html = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div>
            <h2>Room Readiness Checklist</h2>
            <div class="page-subtitle">Verify operational pre-flight safety, materials, and seating requirements</div>
          </div>
          ${myRooms.length > 1 ? `
            <select class="form-select text-xs" id="readiness-room-select">
              ${myRooms.map(r => `<option value="${r.id}" ${r.id === currentRoom.id ? 'selected' : ''}>Room ${UI.escapeHtml(r.name)}</option>`).join('')}
            </select>
          ` : `<span class="badge badge-normal">Room ${UI.escapeHtml(currentRoom ? currentRoom.name : '—')}</span>`}
        </div>
      </div>

      <div class="card" style="max-width:680px;margin:0 auto;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 class="card-title">Pre-Examination Protocol — Room ${UI.escapeHtml(currentRoom ? currentRoom.name : '')}</h3>
            <div id="readiness-score-header" class="text-xs text-muted mt-1"></div>
          </div>
          <div id="readiness-status-badge"></div>
        </div>
        <div class="card-body">
          <div class="progress-bar mb-4">
            <div id="readiness-progress-fill" class="progress-fill" style="width:0%;"></div>
          </div>

          <div id="checklist-items-container">
            <!-- Items rendered via listener -->
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const roomSelect = document.getElementById('readiness-room-select');
    if (roomSelect) {
      roomSelect.onchange = () => {
        this.selectedRoomId = roomSelect.value;
        this.renderReadiness();
      };
    }

    if (!currentRoom) return;

    const checklistContainer = document.getElementById('checklist-items-container');
    const scoreHeader = document.getElementById('readiness-score-header');
    const badgeHolder = document.getElementById('readiness-status-badge');
    const progressFill = document.getElementById('readiness-progress-fill');

    // Real-time listener on checklist
    const unsub = Database.listen(DB.roomChecklists(currentRoom.id), (checklist) => {
      checklist = checklist || {};
      const score = ReadinessCalc.calculate(checklist);
      const status = ReadinessCalc.getStatus(score);

      scoreHeader.textContent = `Overall Readiness: ${score}% Complete`;
      badgeHolder.innerHTML = UI.statusBadge(status);
      progressFill.style.width = `${score}%`;
      progressFill.className = `progress-fill ${score < 50 ? 'low' : (score < 100 ? 'medium' : '')}`;

      checklistContainer.innerHTML = ReadinessCalc.CHECKLIST_ITEMS.map(item => {
        const record = checklist[item.id] || { completed: false };
        const isDone = record.completed === true;

        return `
          <div class="checklist-item ${isDone ? 'completed' : ''}" data-item-id="${item.id}">
            <div class="checklist-checkbox ${isDone ? 'checked' : ''}" data-toggle="${item.id}">
              ${isDone ? '<i data-lucide="check" style="width:14px;height:14px;"></i>' : ''}
            </div>
            <div style="flex:1;">
              <div class="checklist-label font-medium">${UI.escapeHtml(item.label)}</div>
              ${isDone && record.updatedAt ? `<div class="text-xs text-muted" style="font-size:0.625rem;">Verified at ${UI.formatDateTime(record.updatedAt)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      lucide.createIcons({ nodes: [checklistContainer] });

      // Click to toggle
      checklistContainer.querySelectorAll('.checklist-checkbox').forEach(box => {
        box.onclick = async () => {
          const itemId = box.dataset.toggle;
          const current = checklist[itemId] || { completed: false };
          const nextState = !current.completed;

          await Database.set(DB.roomChecklist(currentRoom.id, itemId), {
            completed: nextState,
            updatedBy: Auth.getUid(),
            updatedAt: Date.now()
          });

          // Also update room status in room record
          const newChecklist = { ...checklist, [itemId]: { completed: nextState } };
          const newScore = ReadinessCalc.calculate(newChecklist);
          const newStatus = ReadinessCalc.getStatus(newScore);

          await Database.update(DB.room(currentRoom.id), {
            status: newStatus,
            updatedAt: DB.serverTimestamp()
          });

          UI.toast(`Checklist item updated (${nextState ? 'Completed' : 'Pending'})`, 'info', 1500);
        };
      });
    });

    ActiveListeners.add(unsub);
  },

  // 7. Incident Inbox View
  async renderIncidents() {
    const myRooms = await this.getAuthorizedRooms();
    const myRoomIds = new Set(myRooms.map(r => r.id));
    const uid = Auth.getUid();

    const html = `
      <div class="page-header">
        <h2>Assigned Emergency Incidents</h2>
        <div class="page-subtitle">Immediate triage and resolution inbox for candidate alerts</div>
      </div>

      <div class="filter-bar" id="inv-inc-filter-bar">
        <button class="filter-chip active" data-filter="all">All Incidents</button>
        <button class="filter-chip" data-filter="critical">Critical First</button>
        <button class="filter-chip" data-filter="active">Needs Action</button>
        <button class="filter-chip" data-filter="resolved">Resolved</button>
      </div>

      <div id="inv-incidents-feed">
        <div class="text-xs text-muted">Connecting incident ledger...</div>
      </div>
    `;

    UI.renderPage(html);

    let activeFilter = 'all';
    const feed = document.getElementById('inv-incidents-feed');

    const renderList = (incidentsMap) => {
      const all = Object.entries(incidentsMap || {}).map(([id, val]) => ({ id, ...val }));
      let filtered = all.filter(inc => inc.assignedTo === uid || myRoomIds.has(inc.roomId));

      if (activeFilter === 'critical') {
        filtered = filtered.filter(i => i.priority === 'critical');
      } else if (activeFilter === 'active') {
        filtered = filtered.filter(i => i.status !== 'resolved' && i.status !== 'closed');
      } else if (activeFilter === 'resolved') {
        filtered = filtered.filter(i => i.status === 'resolved' || i.status === 'closed');
      }

      if (!filtered.length) {
        feed.innerHTML = `
          <div class="empty-state">
            <i data-lucide="check-circle" style="color:var(--color-green-600);"></i>
            <h3>No incidents pending</h3>
            <p>All emergency alerts in your supervised rooms are resolved.</p>
          </div>
        `;
        lucide.createIcons({ nodes: [feed] });
        return;
      }

      PriorityEngine.sortIncidents(filtered);

      feed.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
          ${filtered.map(inc => `
            <div class="incident-card priority-${inc.priority}" data-inc-id="${inc.id}" style="cursor:pointer;">
              <div class="incident-card-header">
                <div>
                  <span class="incident-id">${UI.escapeHtml(inc.id)}</span>
                  <h4 class="font-bold text-sm mt-1">${UI.escapeHtml(INCIDENT_CATEGORIES[inc.category] || inc.category)}</h4>
                </div>
                <div style="display:flex;gap:var(--space-2);">
                  ${UI.priorityBadge(inc.priority)}
                  ${UI.statusBadge(inc.status)}
                </div>
              </div>
              <p class="incident-card-body">${UI.escapeHtml(inc.description)}</p>
              <div class="incident-card-meta">
                <span>Room: ${UI.escapeHtml(inc.roomId || 'Unspecified')}</span>
                <span>Assignment: ${inc.assignmentType ? UI.escapeHtml(inc.assignmentType) : 'Direct'}</span>
                <span>Reported ${UI.formatRelative(inc.createdAt)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      lucide.createIcons({ nodes: [feed] });

      feed.querySelectorAll('.incident-card[data-inc-id]').forEach(card => {
        card.onclick = () => {
          IncidentsHelper.renderIncidentDetail(card.dataset.incId);
        };
      });
    };

    const unsub = Database.listen(DB.incidents(), (incidentsMap) => renderList(incidentsMap));
    ActiveListeners.add(unsub);

    // Filter chip clicks
    const chips = document.querySelectorAll('#inv-inc-filter-bar .filter-chip');
    chips.forEach(chip => {
      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        Database.get(DB.incidents()).then(m => renderList(m));
      };
    });
  },

  // 8. Announcements View
  async renderAnnouncements() {
    const html = `
      <div class="page-header">
        <h2>Invigilator Bulletins</h2>
        <div class="page-subtitle">Official administrative instructions and examination protocol updates</div>
      </div>

      <div id="inv-announcements-list">
        <div class="text-xs text-muted">Loading announcements...</div>
      </div>
    `;

    UI.renderPage(html);

    const container = document.getElementById('inv-announcements-list');

    const unsub = Database.listen(DB.announcements(), async () => {
      const list = await AnnouncementsHelper.getForInvigilator(Auth.getUid());
      AnnouncementsHelper.renderAnnouncementsList(list, container);
    });

    ActiveListeners.add(unsub);
  }
};

console.log('[ExamShield] Invigilator module loaded');
