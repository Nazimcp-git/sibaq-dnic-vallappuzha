// ExamShield — Digital QR Pass & Verification Module

const QRHelper = {
  currentScanner: null,

  // Generate QR pass component
  generatePass(assignment, student, exam, room, container) {
    if (!assignment || !assignment.qrToken) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="alert-triangle"></i>
          <h3>QR Pass Unavailable</h3>
          <p>No valid assignment or QR token found for this student.</p>
        </div>
      `;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = `
      <div class="qr-pass" id="printable-qr-pass">
        <div style="border-bottom:1px solid var(--border-color);padding-bottom:var(--space-3);margin-bottom:var(--space-3);">
          <div class="text-xs uppercase font-bold text-muted" style="letter-spacing:0.1em;">Official Examination Pass</div>
          <h3 class="font-bold text-lg mt-1">${UI.escapeHtml(exam ? exam.title : 'Examination Pass')}</h3>
          <div class="text-xs text-muted">${exam ? UI.formatDate(exam.date) : ''} · ${exam ? exam.startTime : ''} - ${exam ? exam.endTime : ''}</div>
        </div>

        <div class="qr-code-container" id="qr-canvas-holder"></div>

        <div class="qr-info mt-4">
          <div class="qr-info-row">
            <span class="qr-info-label">Candidate</span>
            <span class="qr-info-value">${UI.escapeHtml(student ? student.name : 'Student')}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Register No.</span>
            <span class="qr-info-value mono">${UI.escapeHtml(assignment.registerNumber || (student ? student.registerNumber : '—'))}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Room</span>
            <span class="qr-info-value">${UI.escapeHtml(room ? room.name : assignment.roomId)}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Seat Assigned</span>
            <span class="qr-info-value font-bold mono" style="color:var(--color-green-600);">${UI.escapeHtml(assignment.seatNumber || 'Unassigned')}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Token ID</span>
            <span class="qr-info-value mono text-xs">${UI.escapeHtml(assignment.qrToken.substring(0, 10))}...</span>
          </div>
        </div>

        <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border-color);display:flex;gap:var(--space-2);justify-content:center;" class="no-print">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i data-lucide="printer"></i> Print Pass
          </button>
        </div>
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    // Render QR Code using QRCode.js
    const qrHolder = document.getElementById('qr-canvas-holder');
    if (qrHolder) {
      qrHolder.innerHTML = '';
      try {
        new QRCode(qrHolder, {
          text: assignment.qrToken,
          width: 180,
          height: 180,
          colorDark: '#0a0a0a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (err) {
        console.error('[QR] Failed to render QR:', err);
        qrHolder.innerHTML = '<p class="text-xs text-muted">Failed to generate QR code canvas.</p>';
      }
    }
  },

  // Verify an opaque QR token against Firebase Realtime Database
  async verifyToken(token, expectedRoomId = null) {
    if (!token || typeof token !== 'string') {
      return { valid: false, status: 'invalid', message: 'Malformed or empty QR token' };
    }

    const cleanToken = token.trim();
    const tokenRecord = await Database.get(DB.qrToken(cleanToken));

    if (!tokenRecord) {
      return { valid: false, status: 'not-found', message: 'QR Token not found in examination ledger' };
    }

    if (tokenRecord.active === false) {
      return { valid: false, status: 'revoked', message: 'This QR Pass has been revoked or expired' };
    }

    // Load assignment & student records
    const assignment = await Database.get(DB.assignment(tokenRecord.examId, tokenRecord.assignmentId));
    if (!assignment) {
      return { valid: false, status: 'not-found', message: 'Seat assignment record missing' };
    }

    const student = await Database.get(DB.user(tokenRecord.studentId));
    const room = await Database.get(DB.room(tokenRecord.roomId));
    const exam = await Database.get(DB.exam(tokenRecord.examId));

    // Check if student belongs to the room being invigilated
    if (expectedRoomId && tokenRecord.roomId !== expectedRoomId) {
      return {
        valid: false,
        status: 'wrong-room',
        assignment,
        student,
        room,
        exam,
        message: `Candidate assigned to Room ${room ? room.name : tokenRecord.roomId}, not this room!`
      };
    }

    // Check attendance state
    const attRecord = await Database.get(DB.attendanceRecord(tokenRecord.examId, tokenRecord.assignmentId));
    const isPresent = attRecord && attRecord.status === 'present';

    return {
      valid: true,
      status: isPresent ? 'already-present' : 'valid',
      assignment,
      student,
      room,
      exam,
      message: isPresent ? 'Candidate verified (already marked present)' : 'Candidate identity & room assignment verified'
    };
  },

  // Initialize html5-qrcode camera scanner
  initScanner(containerId, onScanSuccess) {
    this.stopScanner();

    try {
      const scanner = new Html5QrcodeScanner(
        containerId,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Normal frame scan failure, suppress noise
        }
      );

      this.currentScanner = scanner;
      return scanner;
    } catch (e) {
      console.error('[QR Scanner] Camera initialization error:', e);
      document.getElementById(containerId).innerHTML = `
        <div class="empty-state">
          <i data-lucide="camera-off"></i>
          <h3>Camera unavailable</h3>
          <p>Unable to access mobile/desktop camera. Check browser permissions or use manual register verification.</p>
        </div>
      `;
      lucide.createIcons();
      return null;
    }
  },

  // Stop scanner safely
  stopScanner() {
    if (this.currentScanner) {
      try {
        this.currentScanner.clear();
      } catch (e) { }
      this.currentScanner = null;
    }
  },

  // Render visual verification result
  renderVerificationResult(result, container, onMarkPresent) {
    if (!result) {
      container.innerHTML = '';
      return;
    }

    let cardClass = 'scanner-result';
    let icon = 'shield-check';
    let title = 'Verified Candidate';

    if (result.status === 'valid') {
      cardClass += ' valid';
      icon = 'check-circle';
      title = 'Valid Student & Correct Room';
    } else if (result.status === 'already-present') {
      cardClass += ' valid';
      icon = 'check-circle';
      title = 'Verified (Already Marked Present)';
    } else if (result.status === 'wrong-room') {
      cardClass += ' invalid';
      icon = 'alert-triangle';
      title = 'Wrong Room Alert!';
    } else {
      cardClass += ' invalid';
      icon = 'x-circle';
      title = 'Verification Failed';
    }

    container.innerHTML = `
      <div class="${cardClass}">
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);">
          <i data-lucide="${icon}" style="width:20px;height:20px;color:inherit;"></i>
          <h4 class="font-bold text-sm" style="color:inherit;">${title}</h4>
        </div>
        <p class="text-xs mb-3" style="color:inherit;">${UI.escapeHtml(result.message)}</p>

        ${result.student ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);background:var(--color-white);padding:var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--border-color);margin-bottom:var(--space-3);">
            <div>
              <div class="text-xs text-muted">Name</div>
              <div class="text-sm font-semibold">${UI.escapeHtml(result.student.name)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Register No.</div>
              <div class="text-sm font-semibold mono">${UI.escapeHtml(result.student.registerNumber || result.assignment.registerNumber)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Assigned Room</div>
              <div class="text-sm font-semibold">${UI.escapeHtml(result.room ? result.room.name : (result.assignment ? result.assignment.roomId : '—'))}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Seat</div>
              <div class="text-sm font-bold mono" style="color:var(--color-green-600);">${UI.escapeHtml(result.assignment ? result.assignment.seatNumber : '—')}</div>
            </div>
          </div>
        ` : ''}

        ${result.valid && onMarkPresent ? `
          <div style="display:flex;justify-content:flex-end;">
            <button class="btn btn-primary btn-sm" id="btn-qr-mark-present">
              <i data-lucide="check"></i> Mark Candidate Present
            </button>
          </div>
        ` : ''}
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    const btnMark = document.getElementById('btn-qr-mark-present');
    if (btnMark && onMarkPresent) {
      btnMark.onclick = () => {
        onMarkPresent(result);
      };
    }
  },

  // Token creation helper
  async generateTokenForAssignment(examId, assignmentId, studentId, roomId) {
    const token = generateQRToken();
    const tokenData = {
      assignmentId,
      examId,
      studentId,
      roomId,
      active: true,
      createdAt: DB.serverTimestamp()
    };

    const updates = {};
    updates['qrTokens/' + token] = tokenData;
    updates['assignments/' + examId + '/' + assignmentId + '/qrToken'] = token;

    await Database.multiUpdate(updates);
    return token;
  }
};

console.log('[ExamShield] QR helper loaded');
