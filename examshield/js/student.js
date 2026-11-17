// ExamShield — Student Module
// Manages candidate seat location, digital QR pass, emergency incident reporting, and real-time alerts.

const StudentModule = {
  // Main entry dispatcher
  async render(page) {
    switch (page) {
      case 'dashboard':
        await this.renderDashboard();
        break;
      case 'seat-finder':
        await this.renderSeatFinder();
        break;
      case 'qr-pass':
        await this.renderQRPass();
        break;
      case 'attendance':
        await this.renderAttendance();
        break;
      case 'help-desk':
        await this.renderHelpDesk();
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

  // Helper: retrieve student's active exam and assignment
  async getStudentContext() {
    const uid = Auth.getUid();
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    const exam = await Database.get(DB.exam(activeExamId));
    const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};

    let studentAssignment = null;
    let assignmentId = null;

    // Match by studentId or registerNumber
    const studentUser = Auth.currentUserData || await Database.get(DB.user(uid)) || {};

    for (const [asgnKey, asgn] of Object.entries(assignmentsMap)) {
      if (asgn.studentId === uid || (studentUser.registerNumber && asgn.registerNumber === studentUser.registerNumber)) {
        studentAssignment = asgn;
        assignmentId = asgnKey;
        break;
      }
    }

    let room = null;
    let invigilator = null;
    let attendance = null;

    if (studentAssignment) {
      if (studentAssignment.roomId) {
        room = await Database.get(DB.room(studentAssignment.roomId));
        if (room && room.invigilatorId) {
          invigilator = await Database.get(DB.user(room.invigilatorId));
        }
      }
      attendance = await Database.get(DB.attendanceRecord(activeExamId, assignmentId));

      // Cache locally for offline availability
      OfflineManager.cacheUserData(uid, {
        student: studentUser,
        assignment: studentAssignment,
        exam: exam,
        room: room,
        attendance: attendance
      });
    } else {
      // Check offline cache if offline
      const cached = OfflineManager.getCachedUserData(uid);
      if (cached) {
        return cached;
      }
    }

    return {
      uid,
      studentUser,
      exam,
      activeExamId,
      assignment: studentAssignment,
      assignmentId,
      room,
      invigilator,
      attendance
    };
  },

  // 1. Dashboard View
  async renderDashboard() {
    const ctx = await this.getStudentContext();
    const { studentUser, exam, assignment, room, invigilator, attendance, activeExamId } = ctx;

    // Load recent announcements & active incidents
    const announcements = await AnnouncementsHelper.getForStudent(
      studentUser,
      activeExamId,
      assignment ? assignment.roomId : null
    );

    const allIncidents = await Database.getList(DB.incidents());
    const myIncidents = allIncidents.filter(inc => inc.studentId === Auth.getUid());
    const activeIncidents = myIncidents.filter(inc => inc.status !== 'resolved' && inc.status !== 'closed');

    const attStatus = attendance ? attendance.status : 'unmarked';

    const html = `
      <div class="page-header">
        <h2>Candidate Command Desk</h2>
        <div class="page-subtitle">Welcome, ${UI.escapeHtml(studentUser.name || 'Student')} · Reg No: <span class="mono font-semibold">${UI.escapeHtml(studentUser.registerNumber || '—')}</span></div>
      </div>

      <!-- Urgent Active Incident Banner if applicable -->
      ${activeIncidents.length > 0 ? `
        <div style="background:var(--color-critical-bg);border:1px solid var(--color-critical);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-6);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="font-bold text-sm" style="color:var(--color-critical);">Active Emergency Incident Report</div>
            <div class="text-xs text-muted mt-1">You have ${activeIncidents.length} pending report(s) under review by invigilators.</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="Router.navigate('student/incidents')">Track Status</button>
        </div>
      ` : ''}

      <!-- Quick Action Cards Grid -->
      <div class="stats-grid">
        <div class="stat-card stat-info" style="cursor:pointer;" onclick="Router.navigate('student/seat-finder')">
          <div class="stat-label">Room & Seat Location</div>
          <div class="stat-value font-bold" style="font-size:1.5rem;color:var(--color-charcoal);">
            ${assignment ? `${assignment.seatNumber} <span class="text-sm font-normal text-muted">in ${room ? room.name : assignment.roomId}</span>` : 'Unassigned'}
          </div>
          <div class="stat-change text-xs">Click to view location details &rarr;</div>
        </div>

        <div class="stat-card ${attStatus === 'present' ? 'stat-success' : 'stat-high'}" style="cursor:pointer;" onclick="Router.navigate('student/attendance')">
          <div class="stat-label">Attendance State</div>
          <div class="stat-value font-bold" style="font-size:1.5rem;">
            ${attStatus === 'present' ? '<span style="color:var(--color-green-600);">Verified Present</span>' : (attStatus === 'absent' ? '<span style="color:var(--color-critical);">Marked Absent</span>' : '<span class="text-muted">Not Marked</span>')}
          </div>
          <div class="stat-change text-xs">Official exam register</div>
        </div>

        <div class="stat-card" style="cursor:pointer;" onclick="Router.navigate('student/qr-pass')">
          <div class="stat-label">Digital Pass</div>
          <div class="stat-value font-bold" style="font-size:1.5rem;">QR Active</div>
          <div class="stat-change text-xs">Ready for invigilator scan &rarr;</div>
        </div>

        <div class="stat-card stat-critical" style="cursor:pointer;" onclick="Router.navigate('student/help-desk')">
          <div class="stat-label">Emergency Desk</div>
          <div class="stat-value font-bold" style="font-size:1.5rem;color:var(--color-critical);">Report Issue</div>
          <div class="stat-change text-xs">Medical, seat, or admit card help &rarr;</div>
        </div>
      </div>

      <!-- Main Overview Columns -->
      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-3">
        <!-- Examination Info Card -->
        <div class="card lg:col-span-2">
          <div class="card-header">
            <h3 class="card-title">Active Examination Schedule</h3>
            ${exam && exam.status === 'active' ? '<span class="badge badge-success">In Progress</span>' : '<span class="badge badge-muted">Scheduled</span>'}
          </div>
          <div class="card-body">
            <h4 class="font-bold text-lg mb-2">${UI.escapeHtml(exam ? exam.title : 'No Examination Active')}</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:var(--space-4);background:var(--color-off-white);padding:var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
              <div>
                <div class="text-xs text-muted">Date</div>
                <div class="text-sm font-semibold">${exam ? UI.formatDate(exam.date) : '—'}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Timing</div>
                <div class="text-sm font-semibold">${exam ? `${exam.startTime} – ${exam.endTime}` : '—'}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Building & Block</div>
                <div class="text-sm font-semibold">${room ? `${room.building} (Block ${room.block})` : '—'}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Invigilator</div>
                <div class="text-sm font-semibold">${invigilator ? invigilator.name : 'Assigned Faculty'}</div>
              </div>
            </div>

            <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="Router.navigate('student/qr-pass')">
                <i data-lucide="qr-code"></i> Show QR Exam Pass
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Router.navigate('student/seat-finder')">
                <i data-lucide="map-pin"></i> Seat Locator
              </button>
              <button class="btn btn-danger btn-sm" onclick="Router.navigate('student/help-desk')">
                <i data-lucide="life-buoy"></i> Emergency Report
              </button>
            </div>
          </div>
        </div>

        <!-- Latest Announcements Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Live Bulletins</h3>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('student/announcements')">View All</button>
          </div>
          <div class="card-body">
            ${announcements.slice(0, 3).map(ann => `
              <div style="padding-bottom:var(--space-3);margin-bottom:var(--space-3);border-bottom:1px solid var(--border-subtle);">
                <div class="font-semibold text-xs text-dark mb-1">${UI.escapeHtml(ann.title)}</div>
                <div class="text-xs text-muted" style="line-height:1.4;">${UI.escapeHtml(ann.message)}</div>
                <div class="text-muted mt-1" style="font-size:0.625rem;">${UI.formatRelative(ann.createdAt)}</div>
              </div>
            `).join('') || '<p class="text-xs text-muted">No announcements posted yet.</p>'}
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);
  },

  // 2. Smart Seat Finder View
  async renderSeatFinder() {
    const ctx = await this.getStudentContext();
    const { studentUser, exam, assignment, room, invigilator } = ctx;

    const html = `
      <div class="page-header">
        <h2>Smart Seat Finder</h2>
        <div class="page-subtitle">Locate your physical examination desk and assigned room</div>
      </div>

      <!-- Quick Register Number Search Fallback -->
      <div class="card mb-6">
        <div class="card-body">
          <div style="display:flex;gap:var(--space-3);align-items:center;">
            <div style="flex:1;">
              <input type="text" class="form-input mono" id="seat-search-reg" placeholder="Enter Register Number (e.g. REG2024001)" value="${studentUser.registerNumber || ''}">
            </div>
            <button class="btn btn-primary" id="btn-search-seat">
              <i data-lucide="search"></i> Locate Desk
            </button>
          </div>
        </div>
      </div>

      <div id="seat-lookup-result">
        ${this.renderSeatCardHtml(assignment, studentUser, exam, room, invigilator)}
      </div>
    `;

    UI.renderPage(html);

    // Search handler
    document.getElementById('btn-search-seat').onclick = async () => {
      const reg = document.getElementById('seat-search-reg').value.trim();
      if (!reg) return;

      const container = document.getElementById('seat-lookup-result');
      container.innerHTML = '<div class="text-xs text-muted">Looking up assignment ledger...</div>';

      const settings = await Database.get(DB.settings()) || {};
      const activeExamId = settings.activeExamId || 'exam_001';
      const assignmentsMap = await Database.get(DB.assignments(activeExamId)) || {};

      let foundAsgn = null;
      for (const asgn of Object.values(assignmentsMap)) {
        if (asgn.registerNumber && asgn.registerNumber.toUpperCase() === reg.toUpperCase()) {
          foundAsgn = asgn;
          break;
        }
      }

      if (!foundAsgn) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="alert-circle" style="color:var(--color-critical);"></i>
            <h3>No Seat Allocation Found</h3>
            <p>No active examination assignment exists for register number "${UI.escapeHtml(reg)}". Please report to the Help Desk immediately.</p>
            <button class="btn btn-danger mt-4" onclick="Router.navigate('student/help-desk')">Report Wrong Room/Seat</button>
          </div>
        `;
        lucide.createIcons({ nodes: [container] });
        return;
      }

      const fRoom = await Database.get(DB.room(foundAsgn.roomId));
      const fExam = await Database.get(DB.exam(activeExamId));
      let fInvig = null;
      if (fRoom && fRoom.invigilatorId) {
        fInvig = await Database.get(DB.user(fRoom.invigilatorId));
      }

      container.innerHTML = StudentModule.renderSeatCardHtml(foundAsgn, studentUser, fExam, fRoom, fInvig);
      lucide.createIcons({ nodes: [container] });
    };
  },

  // Helper to render visual seat assignment card
  renderSeatCardHtml(assignment, studentUser, exam, room, invigilator) {
    if (!assignment) {
      return `
        <div class="empty-state">
          <i data-lucide="map-pin-off"></i>
          <h3>No Seat Assignment Found</h3>
          <p>Your examination registration has not been allocated a seat. Submit an emergency report to receive prompt assistance.</p>
          <button class="btn btn-danger mt-4" onclick="Router.navigate('student/help-desk')">Submit Emergency Help</button>
        </div>
      `;
    }

    return `
      <div class="card mb-6" style="border-left:4px solid var(--color-green-600);">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-4);margin-bottom:var(--space-6);">
            <div>
              <div class="text-xs uppercase font-bold text-muted" style="letter-spacing:0.08em;">Assigned Location</div>
              <h3 class="font-bold text-2xl mt-1">Room ${UI.escapeHtml(room ? room.name : assignment.roomId)}</h3>
              <div class="text-sm text-muted">${UI.escapeHtml(room ? room.building : 'Main Academic Block')} · Block ${UI.escapeHtml(room ? room.block : 'A')}</div>
            </div>

            <div style="text-align:right;">
              <div class="text-xs uppercase font-bold text-muted" style="letter-spacing:0.08em;">Allocated Desk</div>
              <div class="font-bold mono" style="font-size:3rem;color:var(--color-green-600);line-height:1;">
                ${UI.escapeHtml(assignment.seatNumber)}
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:var(--space-3);background:var(--color-off-white);padding:var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:var(--space-6);">
            <div>
              <div class="text-xs text-muted">Candidate Name</div>
              <div class="text-sm font-semibold">${UI.escapeHtml(studentUser.name || 'Candidate')}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Register Number</div>
              <div class="text-sm font-semibold mono">${UI.escapeHtml(assignment.registerNumber || studentUser.registerNumber)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Examination</div>
              <div class="text-sm font-semibold">${UI.escapeHtml(exam ? exam.title : 'CS301')}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Scheduled Time</div>
              <div class="text-sm font-semibold">${exam ? `${exam.startTime} – ${exam.endTime}` : '10:00 – 13:00'}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Invigilator</div>
              <div class="text-sm font-semibold">${invigilator ? invigilator.name : 'Faculty Invigilator'}</div>
            </div>
          </div>

          <!-- Room Visual Seating Context -->
          ${room && room.rows && room.columns ? `
            <div style="border-top:1px solid var(--border-color);padding-top:var(--space-4);">
              <div class="text-xs font-semibold uppercase text-muted mb-3 text-center">Room ${UI.escapeHtml(room.name)} — Seating Grid Orientation</div>
              <div style="background:var(--color-gray-100);padding:6px;border-radius:var(--radius-sm);text-align:center;font-size:var(--text-xs);font-weight:600;margin-bottom:var(--space-3);color:var(--color-gray-600);">
                FRONT OF ROOM / INVIGILATOR DESK
              </div>
              <div style="display:flex;justify-content:center;">
                <div class="seat-grid" style="grid-template-columns:repeat(${room.columns}, 1fr);max-width:380px;">
                  ${this.generateMiniSeatGridHtml(room, assignment.seatNumber)}
                </div>
              </div>
              <div style="text-align:center;margin-top:var(--space-3);">
                <span class="badge badge-success">Your Desk: Seat ${UI.escapeHtml(assignment.seatNumber)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Generate mini seat grid for visual orientation
  generateMiniSeatGridHtml(room, activeSeatNumber) {
    const rows = room.rows || 5;
    const cols = room.columns || 6;
    let html = '';

    for (let r = 0; r < rows; r++) {
      const rowChar = String.fromCharCode(65 + r);
      for (let c = 1; c <= cols; c++) {
        const seatId = `${rowChar}${c}`;
        const isCurrent = (seatId === activeSeatNumber);
        html += `
          <div class="seat ${isCurrent ? 'present selected' : 'assigned'}" style="${isCurrent ? 'font-weight:bold;border-width:2px;' : ''}" title="Seat ${seatId}">
            ${seatId}
          </div>
        `;
      }
    }
    return html;
  },

  // 3. Digital QR Exam Pass View
  async renderQRPass() {
    const ctx = await this.getStudentContext();
    const { studentUser, exam, assignment, room } = ctx;

    const html = `
      <div class="page-header">
        <h2>Digital QR Examination Pass</h2>
        <div class="page-subtitle">Present this high-contrast QR pass to your room invigilator for instant biometric identity & room verification</div>
      </div>

      <div id="student-qr-pass-container"></div>
    `;

    UI.renderPage(html);
    QRHelper.generatePass(assignment, studentUser, exam, room, document.getElementById('student-qr-pass-container'));
  },

  // 4. Attendance Record View
  async renderAttendance() {
    const ctx = await this.getStudentContext();
    const { studentUser, exam, assignment, attendance } = ctx;

    const attStatus = attendance ? attendance.status : 'unmarked';

    const html = `
      <div class="page-header">
        <h2>Attendance Verification</h2>
        <div class="page-subtitle">Official examination roll verification and invigilator audit ledger</div>
      </div>

      <div class="card" style="max-width:600px;margin:0 auto;">
        <div class="card-header">
          <h3 class="card-title">Roll Status: ${exam ? UI.escapeHtml(exam.title) : 'Examination'}</h3>
          ${UI.statusBadge(attStatus)}
        </div>
        <div class="card-body">
          <div style="text-align:center;padding:var(--space-6) 0;">
            <div style="width:64px;height:64px;border-radius:50%;margin:0 auto var(--space-4);display:flex;align-items:center;justify-content:center;background:${attStatus === 'present' ? 'var(--color-green-50)' : 'var(--color-off-white)'};">
              <i data-lucide="${attStatus === 'present' ? 'check-circle' : 'clock'}" style="width:36px;height:36px;color:${attStatus === 'present' ? 'var(--color-green-600)' : 'var(--color-gray-400)'};"></i>
            </div>
            <h3 class="font-bold text-xl mb-1">${attStatus === 'present' ? 'Attendance Confirmed' : (attStatus === 'absent' ? 'Recorded as Absent' : 'Pending Verification')}</h3>
            <p class="text-sm text-muted" style="max-width:320px;margin:0 auto;">
              ${attStatus === 'present'
                ? `Confirmed by Room Invigilator at ${UI.formatDateTime(attendance.markedAt)}.`
                : 'Please arrive at your assigned room desk so the invigilator can scan your QR pass.'}
            </p>
          </div>

          <div style="border-top:1px solid var(--border-color);padding-top:var(--space-4);">
            <div class="text-xs uppercase font-bold text-muted mb-3">Verification Details</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2);font-size:var(--text-sm);">
              <div style="display:flex;justify-content:space-between;">
                <span class="text-muted">Register Number</span>
                <span class="mono font-semibold">${UI.escapeHtml(studentUser.registerNumber || (assignment ? assignment.registerNumber : '—'))}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span class="text-muted">Assigned Seat</span>
                <span class="mono font-semibold">${UI.escapeHtml(assignment ? assignment.seatNumber : 'Unassigned')}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span class="text-muted">Verification Method</span>
                <span>QR Token Scanner / Biometric Manual Roll</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    UI.renderPage(html);
  },

  // 5. Emergency Help Desk (Incident Submission)
  async renderHelpDesk() {
    const ctx = await this.getStudentContext();
    const { studentUser, exam, assignment, room, activeExamId } = ctx;

    const html = `
      <div class="page-header">
        <h2>Emergency Help Desk</h2>
        <div class="page-subtitle">Fast-track assistance for urgent medical, admit card, stationery, or room issues</div>
      </div>

      <div class="card" style="max-width:640px;margin:0 auto;">
        <div class="card-header">
          <h3 class="card-title">File Emergency Report</h3>
          <span class="badge badge-critical">Automated Triage</span>
        </div>
        <div class="card-body">
          <form id="emergency-report-form">
            <div class="form-group">
              <label class="form-label">Issue Category <span class="required">*</span></label>
              <select class="form-select" id="inc-category" required>
                <option value="medical">Medical Emergency (Immediate Dispatch)</option>
                <option value="safety">Safety / Room Hazard</option>
                <option value="wrong-room">Wrong Examination Room</option>
                <option value="wrong-seat">Assigned Seat Occupied / Issue</option>
                <option value="admit-card">Admit Card / Identification Problem</option>
                <option value="missing-stationery">Missing Answer Sheet / Stationery</option>
                <option value="exam-info">Question Paper / Clarification</option>
                <option value="other">Other Operational Incident</option>
              </select>
              <div class="form-hint" id="category-priority-hint" style="color:var(--color-critical);font-weight:600;">
                Calculated Priority: CRITICAL (Immediate on-site response triggered)
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Short Description of Problem <span class="required">*</span></label>
              <textarea class="form-textarea" id="inc-description" placeholder="Explain the situation clearly so the invigilator can bring the right supplies or assistance..." required></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);">
              <div>
                <div class="text-xs text-muted">Reporting Candidate</div>
                <div class="text-sm font-semibold">${UI.escapeHtml(studentUser.name || 'Student')}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Room / Desk</div>
                <div class="text-sm font-semibold">${room ? room.name : (assignment ? assignment.roomId : 'Unassigned')} (${assignment ? assignment.seatNumber : '—'})</div>
              </div>
            </div>

            <button type="submit" class="btn btn-danger btn-full btn-lg" id="btn-submit-report">
              <i data-lucide="send"></i> Dispatch Emergency Report
            </button>
          </form>
        </div>
      </div>
    `;

    UI.renderPage(html);

    const catSelect = document.getElementById('inc-category');
    const hintEl = document.getElementById('category-priority-hint');

    catSelect.onchange = () => {
      const priority = PriorityEngine.calculate(catSelect.value);
      if (priority === 'critical') {
        hintEl.style.color = 'var(--color-critical)';
        hintEl.textContent = 'Calculated Priority: CRITICAL (Immediate on-site response triggered)';
      } else if (priority === 'high') {
        hintEl.style.color = 'var(--color-high)';
        hintEl.textContent = 'Calculated Priority: HIGH (Expedited invigilator assignment)';
      } else {
        hintEl.style.color = 'var(--color-normal)';
        hintEl.textContent = 'Calculated Priority: NORMAL (Queued in standard response pool)';
      }
    };

    document.getElementById('emergency-report-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-report');
      const category = catSelect.value;
      const description = document.getElementById('inc-description').value.trim();

      UI.setLoading(btn, true);

      try {
        if (!navigator.onLine) {
          // Offline mode
          OfflineManager.queueIncident({
            studentId: Auth.getUid(),
            examId: activeExamId,
            roomId: room ? room.id : (assignment ? assignment.roomId : ''),
            category,
            description
          });
          Router.navigate('student/incidents');
          return;
        }

        const incident = await IncidentsHelper.createIncident({
          studentId: Auth.getUid(),
          examId: activeExamId,
          roomId: room ? room.id : (assignment ? assignment.roomId : ''),
          category,
          description
        });

        UI.toast(`Emergency incident #${incident.id} registered!`, 'success', 5000);
        Router.navigate('student/incidents');
      } catch (err) {
        console.error('[Student] Emergency submit failed:', err);
        UI.toast('Failed to file emergency report: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  },

  // 6. My Incidents View
  async renderIncidents() {
    const html = `
      <div class="page-header">
        <h2>My Emergency Incident Reports</h2>
        <div class="page-subtitle">Real-time status tracking and response audit timeline</div>
      </div>

      <div style="margin-bottom:var(--space-4);display:flex;justify-content:flex-end;">
        <button class="btn btn-danger btn-sm" onclick="Router.navigate('student/help-desk')">
          <i data-lucide="plus"></i> File New Incident
        </button>
      </div>

      <div id="student-incidents-list">
        <div class="text-xs text-muted">Connecting real-time incident monitor...</div>
      </div>
    `;

    UI.renderPage(html);

    const container = document.getElementById('student-incidents-list');

    // Real-time listener for student incidents
    const unsub = Database.listen(DB.incidents(), (incidentsMap) => {
      if (!incidentsMap) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="check-circle" style="color:var(--color-green-600);"></i>
            <h3>No incidents on file</h3>
            <p>You have not submitted any emergency incidents.</p>
          </div>
        `;
        lucide.createIcons({ nodes: [container] });
        return;
      }

      const uid = Auth.getUid();
      const list = Object.entries(incidentsMap)
        .map(([id, val]) => ({ id, ...val }))
        .filter(inc => inc.studentId === uid);

      // Check offline sync queue too
      const offlineQueue = OfflineManager.getSyncQueue().filter(q => q.studentId === uid);

      if (!list.length && !offlineQueue.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="check-circle" style="color:var(--color-green-600);"></i>
            <h3>No incidents on file</h3>
            <p>You have not submitted any emergency reports.</p>
          </div>
        `;
        lucide.createIcons({ nodes: [container] });
        return;
      }

      PriorityEngine.sortIncidents(list);

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
          <!-- Queued Offline Items -->
          ${offlineQueue.map(q => `
            <div class="incident-card" style="border-left:3px solid var(--color-warning);background:var(--color-warning-bg);">
              <div class="incident-card-header">
                <div>
                  <span class="incident-id">${q.queuedId}</span>
                  <h4 class="font-bold text-sm mt-1">${UI.escapeHtml(INCIDENT_CATEGORIES[q.category] || q.category)}</h4>
                </div>
                <span class="badge badge-warning">Pending Online Sync</span>
              </div>
              <p class="incident-card-body">${UI.escapeHtml(q.description)}</p>
              <div class="incident-card-meta">
                <span>Queued offline at ${new Date(q.queuedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          `).join('')}

          <!-- Live Firebase Items -->
          ${list.map(inc => `
            <div class="incident-card priority-${inc.priority}" data-incident-id="${inc.id}" style="cursor:pointer;">
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
                <span>Assigned: ${inc.assignedTo ? UI.escapeHtml(inc.assignedTo) : 'Triage In Progress'}</span>
                <span>Reported ${UI.formatRelative(inc.createdAt)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      lucide.createIcons({ nodes: [container] });

      container.querySelectorAll('.incident-card[data-incident-id]').forEach(card => {
        card.onclick = () => {
          IncidentsHelper.renderIncidentDetail(card.dataset.incidentId);
        };
      });
    });

    ActiveListeners.add(unsub);
  },

  // 7. Announcements View
  async renderAnnouncements() {
    const ctx = await this.getStudentContext();
    const { studentUser, assignment, activeExamId } = ctx;

    const html = `
      <div class="page-header">
        <h2>Announcements & Bulletins</h2>
        <div class="page-subtitle">Official examination communications targeted to your examination and room</div>
      </div>

      <div id="student-announcements-list">
        <div class="text-xs text-muted">Loading bulletins...</div>
      </div>
    `;

    UI.renderPage(html);

    const container = document.getElementById('student-announcements-list');

    // Real-time listener on announcements
    const unsub = Database.listen(DB.announcements(), async () => {
      const filtered = await AnnouncementsHelper.getForStudent(
        studentUser,
        activeExamId,
        assignment ? assignment.roomId : null
      );
      AnnouncementsHelper.renderAnnouncementsList(filtered, container);
    });

    ActiveListeners.add(unsub);
  }
};

console.log('[ExamShield] Student module loaded');
