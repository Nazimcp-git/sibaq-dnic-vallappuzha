// ExamShield — CSV / XLSX Bulk Import Module
// Leverages SheetJS (XLSX) for client-side parsing, schema validation, preview, and atomic ingestion.

const CSVImport = {
  currentParsedData: null,
  currentType: 'students',

  // Render main CSV Import interface
  renderImportPage(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>CSV & XLSX Bulk Ingestion</h2>
        <div class="page-subtitle">Batch import examination rosters, room layouts, and candidate seat allocations</div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h3 class="card-title">1. Select Target Schema & Download Templates</h3>
        </div>
        <div class="card-body">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;justify-content:space-between;">
            <div style="display:flex;gap:var(--space-2);">
              <button class="filter-chip active" id="chip-type-students" data-type="students">
                <i data-lucide="users" style="width:14px;height:14px;"></i> Student Roster
              </button>
              <button class="filter-chip" id="chip-type-assignments" data-type="assignments">
                <i data-lucide="grid-3x3" style="width:14px;height:14px;"></i> Seat Allocations
              </button>
              <button class="filter-chip" id="chip-type-rooms" data-type="rooms">
                <i data-lucide="door-open" style="width:14px;height:14px;"></i> Room Configurations
              </button>
            </div>

            <button class="btn btn-secondary btn-sm" id="btn-download-tpl">
              <i data-lucide="download"></i> Download CSV Template
            </button>
          </div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h3 class="card-title">2. Upload Spreadsheet File</h3>
        </div>
        <div class="card-body">
          <div style="border:2px dashed var(--border-color);border-radius:var(--radius-md);padding:var(--space-8);text-align:center;cursor:pointer;background:var(--color-off-white);" id="drop-zone">
            <i data-lucide="file-spreadsheet" style="width:40px;height:40px;color:var(--color-green-600);margin:0 auto var(--space-3);"></i>
            <h4 class="font-bold text-sm mb-1">Click to browse or drag and drop file here</h4>
            <p class="text-xs text-muted mb-4">Accepts CSV, XLSX, and XLS files conforming to ExamShield schema</p>
            <input type="file" id="csv-file-input" accept=".csv, .xlsx, .xls" style="display:none;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('csv-file-input').click()">
              Choose File
            </button>
          </div>
        </div>
      </div>

      <!-- Preview & Validation Container -->
      <div id="import-preview-section" style="display:none;">
        <div class="card mb-6">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 class="card-title">3. Data Validation & Inspection</h3>
              <div id="validation-summary-badge" class="mt-1"></div>
            </div>
            <button class="btn btn-primary" id="btn-execute-import" disabled>
              <i data-lucide="check"></i> Confirm & Import to Database
            </button>
          </div>
          <div class="card-body">
            <div id="validation-errors-alert" style="display:none;margin-bottom:var(--space-4);"></div>
            <div class="table-container" style="max-height:400px;overflow-y:auto;" id="preview-table-container"></div>
          </div>
        </div>
      </div>

      <!-- Logs -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Past Import Logs</h3>
        </div>
        <div class="card-body" id="import-history-container">
          <div class="text-xs text-muted">Loading import audit trail...</div>
        </div>
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    // Type selection chips
    const chips = container.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentType = chip.dataset.type;
        document.getElementById('import-preview-section').style.display = 'none';
        this.currentParsedData = null;
      };
    });

    // Template download
    document.getElementById('btn-download-tpl').onclick = async () => {
      await this.downloadTemplate(this.currentType);
    };

    // File input change
    const fileInput = document.getElementById('csv-file-input');
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this.processFile(file);
    };

    // Drag and drop
    const dropZone = document.getElementById('drop-zone');
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--color-green-600)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-color)'; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files.length) {
        this.processFile(e.dataTransfer.files[0]);
      }
    };

    // Load past import logs
    this.renderImportLogs(document.getElementById('import-history-container'));
  },

  // Generate downloadable sample templates
  async downloadTemplate(type) {
    if (typeof XLSX === 'undefined') {
      UI.toast('Spreadsheet engine loading, please retry in a moment', 'warning');
      return;
    }
    let data = [];
    let filename = `ExamShield_${type}_Template.csv`;

    if (type === 'students') {
      let registeredClasses = ['CS-101', 'CS-102', '10-A', '10-B'];
      if (typeof ClassHelper !== 'undefined') {
        try {
          const dbClasses = await ClassHelper.getAllClasses();
          if (dbClasses && dbClasses.length) registeredClasses = dbClasses;
        } catch (e) {
          console.warn('[CSV Import] Could not fetch classes:', e);
        }
      }
      const c1 = registeredClasses[0] || 'CS-101';
      const c2 = registeredClasses[1] || 'CS-102';
      const c3 = registeredClasses[2] || '10-A';

      data = [
        { Name: 'Aarav Sharma', RegisterNumber: 'REG2024001', Email: 'aarav1@demo.examshield.in', Phone: '+91 98765 43210', Class: c1, EmergencyContact: '+91 98765 00001', BloodGroup: 'O+' },
        { Name: 'Diya Patel', RegisterNumber: 'REG2024002', Email: 'diya2@demo.examshield.in', Phone: '+91 98765 43211', Class: c1, EmergencyContact: '+91 98765 00002', BloodGroup: 'A+' },
        { Name: 'Vihaan Kumar', RegisterNumber: 'REG2024003', Email: 'vihaan3@demo.examshield.in', Phone: '+91 98765 43212', Class: c2, EmergencyContact: '+91 98765 00003', BloodGroup: 'B+' },
        { Name: 'Ananya Singh', RegisterNumber: 'REG2024004', Email: 'ananya4@demo.examshield.in', Phone: '+91 98765 43213', Class: c2, EmergencyContact: '+91 98765 00004', BloodGroup: 'AB+' },
        { Name: 'Arjun Reddy', RegisterNumber: 'REG2024005', Email: 'arjun5@demo.examshield.in', Phone: '+91 98765 43214', Class: c3, EmergencyContact: '+91 98765 00005', BloodGroup: 'O-' }
      ];
    } else if (type === 'assignments') {
      data = [
        { RegisterNumber: 'REG2024001', ExamId: 'exam_001', RoomId: 'room_A101', SeatNumber: 'A1' },
        { RegisterNumber: 'REG2024002', ExamId: 'exam_001', RoomId: 'room_A101', SeatNumber: 'A2' },
        { RegisterNumber: 'REG2024003', ExamId: 'exam_001', RoomId: 'room_A101', SeatNumber: 'A3' },
        { RegisterNumber: 'REG2024004', ExamId: 'exam_001', RoomId: 'room_A101', SeatNumber: 'A4' }
      ];
    } else if (type === 'rooms') {
      data = [
        { Name: 'A-101', Building: 'Academic Block A', Block: 'A', Rows: 5, Columns: 6, Capacity: 30 },
        { Name: 'A-102', Building: 'Academic Block A', Block: 'A', Rows: 4, Columns: 5, Capacity: 20 },
        { Name: 'B-101', Building: 'Academic Block B', Block: 'B', Rows: 5, Columns: 5, Capacity: 25 }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
    UI.toast(`Downloaded template for ${type}`, 'success');
  },

  // Parse uploaded spreadsheet file
  processFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });

        if (!rows || !rows.length) {
          UI.toast('Spreadsheet contains no data rows', 'warning');
          return;
        }

        await this.validateAndPreview(rows);
      } catch (err) {
        console.error('[CSV Import] Parse error:', err);
        UI.toast('Failed to parse spreadsheet file: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  },

  // Validate parsed rows against schema and existing Firebase references
  async validateAndPreview(rows) {
    const type = this.currentType;
    const errors = [];
    const validRows = [];

    // Pre-load reference lists for foreign key validations
    const existingUsers = await Database.getList(DB.users());
    const existingRooms = await Database.getList(DB.rooms());
    const existingExams = await Database.getList(DB.exams());

    const regNumMap = new Map();
    existingUsers.forEach(u => {
      if (u.registerNumber) regNumMap.set(u.registerNumber, u.id);
    });

    const roomIds = new Set(existingRooms.map(r => r.id));
    const examIds = new Set(existingExams.map(e => e.id));

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // header is row 1
      const rowErrors = [];

      if (type === 'students') {
        const name = row.Name || row.name || row['Full Name'];
        const email = row.Email || row.email;
        const regNum = row.RegisterNumber || row.registerNumber || row.regNo || row['Reg Number'];
        const classVal = row.Class || row.class || row.classId || row.ClassId || row.batch || row.Batch;
        if (!name || !String(name).trim()) rowErrors.push('Missing student name');
        if (!email || !String(email).includes('@')) rowErrors.push('Invalid email address');
        if (!regNum || !String(regNum).trim()) rowErrors.push('Missing register number');
        if (!classVal || !String(classVal).trim()) rowErrors.push('Missing class / batch');
      } else if (type === 'assignments') {
        const regNum = row.RegisterNumber || row.registerNumber || row.regNo || row['Reg Number'];
        const examId = row.ExamId || row.examId;
        const roomId = row.RoomId || row.roomId;
        const seatNumber = row.SeatNumber || row.seatNumber;
        if (!regNum) rowErrors.push('Missing register number');
        else if (!regNumMap.has(String(regNum).trim())) {
          rowErrors.push(`Candidate with register number "${regNum}" not found in database`);
        }
        if (!examId) rowErrors.push('Missing examId');
        else if (!examIds.has(String(examId).trim())) {
          rowErrors.push(`Examination ID "${examId}" does not exist`);
        }
        if (!roomId) rowErrors.push('Missing roomId');
        else if (!roomIds.has(String(roomId).trim())) {
          rowErrors.push(`Room ID "${roomId}" does not exist`);
        }
        if (!seatNumber) rowErrors.push('Missing seat number');
      } else if (type === 'rooms') {
        const name = row.Name || row.name;
        const rows = row.Rows || row.rows;
        const cols = row.Columns || row.columns || row.Cols || row.cols;
        if (!name) rowErrors.push('Missing room name');
        if (!rows || isNaN(rows) || Number(rows) <= 0) rowErrors.push('Invalid rows count');
        if (!cols || isNaN(cols) || Number(cols) <= 0) rowErrors.push('Invalid columns count');
      }

      if (rowErrors.length > 0) {
        errors.push({ rowNum, errors: rowErrors, data: row });
      } else {
        validRows.push({ rowNum, data: row });
      }
    });

    this.currentParsedData = { rows, validRows, errors, type, regNumMap };

    // Update UI
    const previewSection = document.getElementById('import-preview-section');
    previewSection.style.display = 'block';

    const summaryBadge = document.getElementById('validation-summary-badge');
    const executeBtn = document.getElementById('btn-execute-import');
    const errorsAlert = document.getElementById('validation-errors-alert');
    const tableContainer = document.getElementById('preview-table-container');

    if (errors.length === 0) {
      summaryBadge.innerHTML = `<span class="badge badge-success">${validRows.length} rows valid (Ready to Ingest)</span>`;
      errorsAlert.style.display = 'none';
      executeBtn.disabled = false;
    } else {
      summaryBadge.innerHTML = `
        <span class="badge badge-warning">${validRows.length} valid</span>
        <span class="badge badge-critical">${errors.length} rows with errors</span>
      `;
      errorsAlert.style.display = 'block';
      errorsAlert.innerHTML = `
        <div style="background:var(--color-critical-bg);border:1px solid var(--color-critical);padding:var(--space-3);border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--color-critical);">
          <strong>Schema Validation Issues Found:</strong>
          <ul style="margin-left:var(--space-4);margin-top:var(--space-1);">
            ${errors.slice(0, 5).map(e => `<li>Row ${e.rowNum}: ${e.errors.join(', ')}</li>`).join('')}
            ${errors.length > 5 ? `<li>...and ${errors.length - 5} more error rows</li>` : ''}
          </ul>
        </div>
      `;
      executeBtn.disabled = validRows.length === 0;
    }

    // Render preview table
    const headers = Object.keys(rows[0] || {});
    tableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Validation Status</th>
            ${headers.map(h => `<th>${UI.escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const errObj = errors.find(e => e.rowNum === i + 2);
            return `
              <tr style="${errObj ? 'background:#fef2f2;' : ''}">
                <td class="mono text-xs">${i + 1}</td>
                <td>
                  ${errObj
                    ? `<span class="badge badge-critical" title="${errObj.errors.join(', ')}">Error</span>`
                    : '<span class="badge badge-success">OK</span>'}
                </td>
                ${headers.map(h => `<td>${UI.escapeHtml(r[h])}</td>`).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    executeBtn.onclick = () => this.executeImport();
  },

  // Perform ingestion into Firebase
  async executeImport() {
    if (!this.currentParsedData || !this.currentParsedData.validRows.length) return;
    const { validRows, type, regNumMap } = this.currentParsedData;
    const executeBtn = document.getElementById('btn-execute-import');

    UI.confirm(
      'Confirm Bulk Import',
      `Proceed with importing ${validRows.length} valid records to the database?`,
      async () => {
        UI.setLoading(executeBtn, true);
        const updates = {};
        let successCount = 0;

        try {
          if (type === 'students') {
            const discoveredClasses = new Set();
            validRows.forEach(item => {
              const r = item.data;
              const uid = 'student_' + generateId();
              const name = String(r.Name || r.name || '').trim();
              const email = String(r.Email || r.email || '').trim().toLowerCase();
              const regNum = String(r.RegisterNumber || r.registerNumber || r.regNo || '').trim();
              const classVal = String(r.Class || r.class || r.classId || r.ClassId || r.batch || r.Batch || 'DEFAULT').trim();
              const phone = String(r.Phone || r.phone || r.contact || r.Contact || '').trim();
              const emergency = String(r.EmergencyContact || r.emergencyContact || r.emergencyContactPhone || '').trim();
              const blood = String(r.BloodGroup || r.bloodGroup || '').trim();

              if (classVal && classVal !== 'DEFAULT') {
                discoveredClasses.add(classVal);
              }

              updates['users/' + uid] = {
                id: uid,
                name: name,
                email: email,
                role: 'student',
                registerNumber: regNum,
                classId: classVal,
                phone: phone,
                emergencyContactPhone: emergency,
                bloodGroup: blood,
                active: true,
                createdAt: DB.serverTimestamp()
              };
              successCount++;
            });

            // Auto-register newly discovered classes into examshield/classes
            discoveredClasses.forEach(c => {
              const cId = c.replace(/[^a-zA-Z0-9_-]/g, '_');
              updates['classes/' + cId] = {
                id: cId,
                name: c,
                createdAt: DB.serverTimestamp()
              };
            });
          } else if (type === 'assignments') {
            for (const item of validRows) {
              const r = item.data;
              const regNum = String(r.RegisterNumber || r.registerNumber || r.regNo || '').trim();
              const examId = String(r.ExamId || r.examId || '').trim();
              const roomId = String(r.RoomId || r.roomId || '').trim();
              const seatNumber = String(r.SeatNumber || r.seatNumber || '').trim();
              const studentUid = regNumMap.get(regNum) || ('student_' + regNum);
              const assignId = 'asgn_' + regNum;
              const token = generateQRToken();

              updates['assignments/' + examId + '/' + assignId] = {
                id: assignId,
                studentId: studentUid,
                registerNumber: regNum,
                roomId: roomId,
                seatNumber: seatNumber,
                qrToken: token,
                status: 'active',
                createdAt: DB.serverTimestamp()
              };

              updates['qrTokens/' + token] = {
                assignmentId: assignId,
                examId: examId,
                studentId: studentUid,
                roomId: roomId,
                active: true,
                createdAt: DB.serverTimestamp()
              };

              successCount++;
            }
          } else if (type === 'rooms') {
            validRows.forEach(item => {
              const r = item.data;
              const name = String(r.Name || r.name || '').trim();
              const roomId = 'room_' + name.replace(/[^a-zA-Z0-9]/g, '');
              const rowsNum = parseInt(r.Rows || r.rows) || 5;
              const colsNum = parseInt(r.Columns || r.columns) || 5;
              const cap = parseInt(r.Capacity || r.capacity) || (rowsNum * colsNum);
              updates['rooms/' + roomId] = {
                id: roomId,
                name: name,
                building: String(r.Building || r.building || 'Main Building').trim(),
                block: String(r.Block || r.block || 'A').trim(),
                rows: rowsNum,
                columns: colsNum,
                capacity: cap,
                status: 'not-ready',
                invigilatorId: '',
                createdAt: DB.serverTimestamp(),
                updatedAt: DB.serverTimestamp()
              };
              successCount++;
            });
          }

          // Apply multiUpdate
          await Database.multiUpdate(updates);

          // Record import audit log
          const logId = generateId('log');
          await Database.set(DB.importLogs().child(logId), {
            id: logId,
            type: type,
            totalRows: this.currentParsedData.rows.length,
            successfulRows: successCount,
            failedRows: this.currentParsedData.errors.length,
            importedBy: Auth.getUid(),
            createdAt: DB.serverTimestamp()
          });

          UI.toast(`Successfully imported ${successCount} records!`, 'success', 5000);
          document.getElementById('import-preview-section').style.display = 'none';
          this.renderImportLogs(document.getElementById('import-history-container'));
        } catch (err) {
          console.error('[CSV Import] Ingestion error:', err);
          UI.toast('Import failed: ' + err.message, 'error');
        } finally {
          UI.setLoading(executeBtn, false);
        }
      }
    );
  },

  // Render past import audit logs
  async renderImportLogs(container) {
    const logs = await Database.getList(DB.importLogs());
    if (!logs.length) {
      container.innerHTML = '<p class="text-xs text-muted">No historical imports recorded yet.</p>';
      return;
    }

    logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Schema Type</th>
              <th>Total Processed</th>
              <th>Successful</th>
              <th>Failed</th>
              <th>Executor</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td class="text-xs">${UI.formatDateTime(l.createdAt)}</td>
                <td class="font-semibold uppercase text-xs">${UI.escapeHtml(l.type)}</td>
                <td class="mono text-xs">${l.totalRows}</td>
                <td class="mono text-xs" style="color:var(--color-green-600);">${l.successfulRows}</td>
                <td class="mono text-xs" style="color:${l.failedRows > 0 ? 'var(--color-critical)' : 'inherit'};">${l.failedRows}</td>
                <td class="text-xs mono text-muted">${UI.escapeHtml(l.importedBy)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
};

console.log('[ExamShield] CSV import module loaded');
