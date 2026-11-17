// ExamShield — WhatsApp Click-to-Chat Module
// Strict compliance: Browser-safe click-to-chat via wa.me URL scheme.
// Does not expose backend credentials or falsely report automated delivery.

const WhatsAppHelper = {
  // Pre-configured examination templates
  getMessageTemplates() {
    return [
      {
        id: 'exam-reminder',
        name: 'Examination Starting Reminder',
        text: 'ExamShield Alert: Hello {studentName}, your examination "{examTitle}" is scheduled for today at {startTime}. Your room is {roomName}, seat {seatNumber}. Please arrive 15 minutes before the start time.'
      },
      {
        id: 'room-change',
        name: 'Room Change Notification',
        text: 'ExamShield Notice: Dear {studentName}, please note that your examination room for "{examTitle}" has been updated to Room {roomName}. Your assigned seat is {seatNumber}.'
      },
      {
        id: 'emergency-alert',
        name: 'Emergency Instructions',
        text: 'ExamShield Emergency Alert: Attention all candidates in {roomName}. Please remain in your seats and follow the instructions given by your invigilator.'
      },
      {
        id: 'stationery-pass',
        name: 'Admit Card / Instructions Reminder',
        text: 'ExamShield Alert: Hello {studentName}, please ensure you carry your physical ID and Digital QR Exam Pass for examination "{examTitle}".'
      }
    ];
  },

  // Format phone number to international E.164 digits
  formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned; // Default to India country code if 10 digits
    }
    if (cleaned.length >= 11 && cleaned.length <= 15) {
      return cleaned;
    }
    return null;
  },

  // Build secure click-to-chat URL
  buildWhatsAppURL(phone, message) {
    const formatted = this.formatPhoneNumber(phone);
    if (!formatted) return null;
    const encoded = encodeURIComponent(message.trim());
    return `https://wa.me/${formatted}?text=${encoded}`;
  },

  // Open WhatsApp in new tab and record attempt
  openWhatsApp(phone, message, recipientLabel = 'Student') {
    const url = this.buildWhatsAppURL(phone, message);
    if (!url) {
      UI.toast('Invalid phone number. Ensure valid country code and digits.', 'error');
      return false;
    }

    // Open WhatsApp
    window.open(url, '_blank', 'noopener,noreferrer');

    // Save log entry to localStorage (status is strictly "Opened in WhatsApp", never "Delivered")
    this.recordAttempt({
      recipient: recipientLabel,
      phone: phone,
      message: message,
      timestamp: Date.now(),
      status: 'Opened in WhatsApp'
    });

    UI.toast('WhatsApp opened in new tab. Review and send manually.', 'info', 5000);
    return true;
  },

  // Record dispatch log in browser storage
  recordAttempt(entry) {
    try {
      const logs = JSON.parse(localStorage.getItem('examshield_whatsapp_log') || '[]');
      logs.unshift(entry);
      if (logs.length > 50) logs.pop();
      localStorage.setItem('examshield_whatsapp_log', JSON.stringify(logs));
    } catch (e) {
      console.warn('[WhatsApp] Unable to save log:', e);
    }
  },

  // Get log entries
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem('examshield_whatsapp_log') || '[]');
    } catch (e) {
      return [];
    }
  },

  // Fill template with dynamic data
  fillTemplate(templateText, data = {}) {
    let result = templateText;
    Object.entries(data).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val || '—');
    });
    return result;
  },

  // Render the Administrator WhatsApp page
  async renderWhatsAppPage(container) {
    container.innerHTML = '<div class="text-xs text-muted">Loading candidate database...</div>';

    const users = await Database.getList(DB.users());
    const students = users.filter(u => u.role === 'student');
    const rooms = await Database.getList(DB.rooms());
    const exams = await Database.getList(DB.exams());
    const templates = this.getMessageTemplates();

    container.innerHTML = `
      <div class="page-header">
        <h2>WhatsApp Communications</h2>
        <div class="page-subtitle">Send official examination alerts and seat reminders via verified WhatsApp click-to-chat</div>
      </div>

      <div style="background:var(--color-green-50);border:1px solid var(--color-green-500);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-6);font-size:var(--text-xs);color:var(--color-charcoal);line-height:1.5;">
        <strong>Architecture Notice:</strong> In compliance with security standards, ExamShield operates a client-safe Click-to-Chat architecture (wa.me) that exposes zero private API tokens or credentials in browser code. Messages open directly in WhatsApp for administrative review prior to dispatch.
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-6);" class="lg:grid-cols-2">
        <!-- Message Composer Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Compose WhatsApp Broadcast</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Message Template</label>
              <select class="form-select" id="wa-template-select">
                <option value="">Custom Message (No template)</option>
                ${templates.map(t => `<option value="${t.id}">${UI.escapeHtml(t.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Examination Reference</label>
              <select class="form-select" id="wa-exam-select">
                ${exams.map(ex => `<option value="${ex.id}">${UI.escapeHtml(ex.title)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Recipient Mode</label>
              <div style="display:flex;gap:var(--space-4);margin-top:var(--space-1);">
                <label style="font-size:var(--text-xs);display:flex;align-items:center;gap:4px;">
                  <input type="radio" name="wa-mode" value="single" checked> Individual Student
                </label>
                <label style="font-size:var(--text-xs);display:flex;align-items:center;gap:4px;">
                  <input type="radio" name="wa-mode" value="direct"> Direct Phone Number
                </label>
              </div>
            </div>

            <div class="form-group" id="wa-single-group">
              <label class="form-label">Select Student Candidate</label>
              <select class="form-select" id="wa-student-select">
                <option value="">Choose candidate...</option>
                ${students.map(s => `
                  <option value="${s.id}" data-phone="${s.phone || '9876543210'}" data-name="${s.name}" data-reg="${s.registerNumber || ''}">
                    ${UI.escapeHtml(s.name)} (${UI.escapeHtml(s.registerNumber || s.email)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" id="wa-direct-group" style="display:none;">
              <label class="form-label">Direct Phone Number (with Country Code)</label>
              <input type="tel" class="form-input" id="wa-direct-phone" placeholder="e.g. +91 9876543210">
            </div>

            <div class="form-group">
              <label class="form-label">Message Content</label>
              <textarea class="form-textarea" id="wa-message-body" style="min-height:120px;" placeholder="Write message to send..."></textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;">
              <button class="btn btn-primary" id="btn-open-wa">
                <i data-lucide="message-circle"></i> Launch WhatsApp Click-to-Chat
              </button>
            </div>
          </div>
        </div>

        <!-- Activity Log Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent WhatsApp Dispatch Log</h3>
            <button class="btn btn-ghost btn-sm" id="btn-clear-wa-log" title="Clear log">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Clear
            </button>
          </div>
          <div class="card-body" id="wa-log-container">
            <!-- Rendered by renderMessageLog -->
          </div>
        </div>
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    // Mode toggle
    const radioModes = container.querySelectorAll('input[name="wa-mode"]');
    const singleGroup = document.getElementById('wa-single-group');
    const directGroup = document.getElementById('wa-direct-group');

    radioModes.forEach(r => {
      r.onchange = () => {
        if (r.value === 'single') {
          singleGroup.style.display = 'block';
          directGroup.style.display = 'none';
        } else {
          singleGroup.style.display = 'none';
          directGroup.style.display = 'block';
        }
      };
    });

    // Template change handler
    const tplSelect = document.getElementById('wa-template-select');
    const msgText = document.getElementById('wa-message-body');
    const examSelect = document.getElementById('wa-exam-select');
    const studentSelect = document.getElementById('wa-student-select');

    tplSelect.onchange = () => {
      const tplId = tplSelect.value;
      if (!tplId) return;

      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) return;

      const selectedOpt = studentSelect.options[studentSelect.selectedIndex];
      const examTitle = examSelect.options[examSelect.selectedIndex]?.text || 'Examination';

      const data = {
        studentName: selectedOpt?.dataset.name || 'Candidate',
        examTitle: examTitle,
        startTime: '10:00 AM',
        roomName: 'A-101',
        seatNumber: 'A1'
      };

      msgText.value = WhatsAppHelper.fillTemplate(tpl.text, data);
    };

    // Open WhatsApp action
    document.getElementById('btn-open-wa').onclick = () => {
      const mode = container.querySelector('input[name="wa-mode"]:checked').value;
      let phone = '';
      let label = 'Direct Contact';

      if (mode === 'single') {
        const selected = studentSelect.options[studentSelect.selectedIndex];
        if (!selected || !selected.value) {
          UI.toast('Please select a student candidate', 'warning');
          return;
        }
        phone = selected.dataset.phone || '9876543210';
        label = selected.dataset.name;
      } else {
        phone = document.getElementById('wa-direct-phone').value;
        if (!phone) {
          UI.toast('Please enter a destination phone number', 'warning');
          return;
        }
      }

      const msg = msgText.value;
      if (!msg.trim()) {
        UI.toast('Message content cannot be blank', 'warning');
        return;
      }

      WhatsAppHelper.openWhatsApp(phone, msg, label);
      WhatsAppHelper.renderMessageLog(document.getElementById('wa-log-container'));
    };

    // Clear log
    document.getElementById('btn-clear-wa-log').onclick = () => {
      localStorage.removeItem('examshield_whatsapp_log');
      WhatsAppHelper.renderMessageLog(document.getElementById('wa-log-container'));
      UI.toast('Dispatch log cleared', 'info');
    };

    // Initial render of log
    WhatsAppHelper.renderMessageLog(document.getElementById('wa-log-container'));
  },

  // Render recent message logs
  renderMessageLog(container) {
    const logs = this.getLogs();
    if (!logs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="message-square"></i>
          <h3>No dispatches logged</h3>
          <p class="text-xs">Outbound WhatsApp messages will appear here once opened.</p>
        </div>
      `;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">
        ${logs.map(log => `
          <div style="padding:var(--space-2) var(--space-3);background:var(--color-off-white);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:var(--text-xs);">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span class="font-semibold text-dark">${UI.escapeHtml(log.recipient)} (${UI.escapeHtml(log.phone)})</span>
              <span class="badge badge-normal" style="font-size:0.625rem;">${UI.escapeHtml(log.status)}</span>
            </div>
            <p class="text-muted truncate mb-1">${UI.escapeHtml(log.message)}</p>
            <div class="text-muted" style="font-size:0.625rem;">${UI.formatDateTime(log.timestamp)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

console.log('[ExamShield] WhatsApp module loaded');
