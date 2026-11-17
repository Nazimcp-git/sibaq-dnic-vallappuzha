// ExamShield — Incidents Module (Shared Helpers & Control)

const IncidentsHelper = {
  // Create a new incident
  async createIncident(data) {
    const priority = PriorityEngine.calculate(data.category);
    const incidentId = generateId('inc');

    const incidentData = {
      id: incidentId,
      studentId: data.studentId || Auth.getUid(),
      examId: data.examId || '',
      roomId: data.roomId || '',
      category: data.category,
      description: data.description.trim(),
      priority: priority,
      status: 'submitted',
      assignedTo: '',
      assignmentType: '',
      createdAt: DB.serverTimestamp(),
      updatedAt: DB.serverTimestamp()
    };

    // Save incident to DB
    await Database.set(DB.incident(incidentId), incidentData);

    // Initial timeline events
    await Database.push(DB.incidentHistory(incidentId), {
      action: 'Incident created',
      actorId: incidentData.studentId,
      actorRole: 'student',
      timestamp: DB.serverTimestamp(),
      details: `Reported issue under category: ${INCIDENT_CATEGORIES[data.category] || data.category}`
    });

    await Database.push(DB.incidentHistory(incidentId), {
      action: `Priority assigned: ${priority.toUpperCase()}`,
      actorId: 'system',
      actorRole: 'system',
      timestamp: DB.serverTimestamp(),
      details: `Deterministic engine assigned ${priority} priority for ${data.category}`
    });

    // Trigger rule-based assignment
    try {
      await AssignmentEngine.assignIncident(incidentId, incidentData);
    } catch (err) {
      console.error('[Incidents] Auto-assignment error:', err);
    }

    return { id: incidentId, ...incidentData };
  },

  // Update incident status
  async updateStatus(incidentId, newStatus, actorId, actorRole, details = '') {
    const incSnap = await Database.get(DB.incident(incidentId));
    if (!incSnap) throw new Error('Incident not found');

    const prevStatus = incSnap.status;
    const assignedTo = incSnap.assignedTo;

    const updates = {};
    updates['incidents/' + incidentId + '/status'] = newStatus;
    updates['incidents/' + incidentId + '/updatedAt'] = DB.serverTimestamp();

    await Database.multiUpdate(updates);

    // If resolving or closing, decrement invigilator's active count
    if ((newStatus === 'resolved' || newStatus === 'closed') &&
        prevStatus !== 'resolved' && prevStatus !== 'closed' && assignedTo) {
      await Database.transaction(
        DB.invigilator(assignedTo).child('activeIncidentCount'),
        (curr) => Math.max(0, (curr || 1) - 1)
      );
    }

    // Add timeline event
    await Database.push(DB.incidentHistory(incidentId), {
      action: `Status updated: ${newStatus}`,
      actorId: actorId || Auth.getUid(),
      actorRole: actorRole || Auth.getRole(),
      timestamp: DB.serverTimestamp(),
      details: details || `Status changed from ${prevStatus} to ${newStatus}`
    });
  },

  // Add note to incident
  async addNote(incidentId, note, actorId, actorRole) {
    if (!note || !note.trim()) return;
    await Database.push(DB.incidentHistory(incidentId), {
      action: 'Note added',
      actorId: actorId || Auth.getUid(),
      actorRole: actorRole || Auth.getRole(),
      timestamp: DB.serverTimestamp(),
      details: note.trim()
    });
  },

  // Manual assignment
  async assignManually(incidentId, invigilatorId, actorId) {
    const incSnap = await Database.get(DB.incident(incidentId));
    if (!incSnap) throw new Error('Incident not found');

    const prevInvigilator = incSnap.assignedTo;

    const updates = {};
    updates['incidents/' + incidentId + '/assignedTo'] = invigilatorId;
    updates['incidents/' + incidentId + '/assignmentType'] = 'manual';
    updates['incidents/' + incidentId + '/status'] = 'assigned';
    updates['incidents/' + incidentId + '/updatedAt'] = DB.serverTimestamp();

    await Database.multiUpdate(updates);

    // Adjust workloads
    if (prevInvigilator && prevInvigilator !== invigilatorId) {
      await Database.transaction(
        DB.invigilator(prevInvigilator).child('activeIncidentCount'),
        (curr) => Math.max(0, (curr || 1) - 1)
      );
    }
    await Database.transaction(
      DB.invigilator(invigilatorId).child('activeIncidentCount'),
      (curr) => (curr || 0) + 1
    );

    // Add timeline event
    await Database.push(DB.incidentHistory(incidentId), {
      action: 'Incident manually reassigned',
      actorId: actorId || Auth.getUid(),
      actorRole: 'admin',
      timestamp: DB.serverTimestamp(),
      details: `Reassigned to invigilator UID: ${invigilatorId}`
    });
  },

  // Override priority
  async overridePriority(incidentId, newPriority, actorId, actorRole, reason) {
    const incSnap = await Database.get(DB.incident(incidentId));
    if (!incSnap) throw new Error('Incident not found');

    const oldPriority = incSnap.priority;
    await Database.update(DB.incident(incidentId), {
      priority: newPriority,
      updatedAt: DB.serverTimestamp()
    });

    await Database.push(DB.incidentHistory(incidentId), {
      action: `Priority overridden to ${newPriority.toUpperCase()}`,
      actorId: actorId || Auth.getUid(),
      actorRole: actorRole || Auth.getRole(),
      timestamp: DB.serverTimestamp(),
      details: `Changed from ${oldPriority} to ${newPriority}. Reason: ${reason || 'Administrative adjustment'}`
    });
  },

  // Calculate incident statistics
  getIncidentStats(incidents) {
    const stats = {
      total: incidents.length,
      critical: 0,
      high: 0,
      normal: 0,
      pending: 0,
      assigned: 0,
      resolved: 0,
      closed: 0
    };

    incidents.forEach(inc => {
      if (inc.priority === 'critical') stats.critical++;
      else if (inc.priority === 'high') stats.high++;
      else stats.normal++;

      if (inc.status === 'submitted' || inc.status === 'pending') stats.pending++;
      else if (inc.status === 'assigned' || inc.status === 'accepted' || inc.status === 'in-progress') stats.assigned++;
      else if (inc.status === 'resolved') stats.resolved++;
      else if (inc.status === 'closed') stats.closed++;
    });

    return stats;
  },

  // Render chronological timeline
  renderTimeline(incidentId, container) {
    container.innerHTML = '<div class="text-xs text-muted">Loading timeline...</div>';

    const unsub = Database.listen(DB.incidentHistory(incidentId), (events) => {
      if (!events) {
        container.innerHTML = '<p class="text-xs text-muted">No timeline records found.</p>';
        return;
      }

      const list = Object.entries(events).map(([id, val]) => ({ id, ...val }));
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      container.innerHTML = `
        <div class="timeline">
          ${list.map(ev => {
            let dotClass = 'event-normal';
            if (ev.action.includes('created')) dotClass = 'event-created';
            else if (ev.action.includes('assigned')) dotClass = 'event-assigned';
            else if (ev.action.includes('resolved') || ev.action.includes('closed')) dotClass = 'event-resolved';
            else if (ev.action.includes('CRITICAL')) dotClass = 'event-critical';

            return `
              <div class="timeline-item ${dotClass}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="font-semibold text-xs text-dark">${UI.escapeHtml(ev.action)}</div>
                  ${ev.details ? `<div class="text-xs text-muted mt-1">${UI.escapeHtml(ev.details)}</div>` : ''}
                  <div class="timeline-time">${UI.formatDateTime(ev.timestamp)} · <span class="uppercase">${UI.escapeHtml(ev.actorRole || 'System')}</span></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    });

    ActiveListeners.add(unsub);
  },

  // Full Incident Detail Modal
  async renderIncidentDetail(incidentId) {
    const inc = await Database.get(DB.incident(incidentId));
    if (!inc) {
      UI.toast('Incident not found', 'error');
      return;
    }

    const currentRole = Auth.getRole();
    const currentUid = Auth.getUid();
    const student = await Database.get(DB.user(inc.studentId));
    const invigilators = await Database.getList(DB.users());
    const invigList = invigilators.filter(u => u.role === 'invigilator');

    const modalBody = `
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border-color);padding-bottom:var(--space-3);">
          <div>
            <div class="mono text-xs text-muted">ID: ${UI.escapeHtml(inc.id || incidentId)}</div>
            <h4 class="font-bold text-lg mt-1">${UI.escapeHtml(INCIDENT_CATEGORIES[inc.category] || inc.category)}</h4>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            ${UI.priorityBadge(inc.priority)}
            ${UI.statusBadge(inc.status)}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-3);background:var(--color-off-white);padding:var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
          <div>
            <div class="text-xs text-muted">Student</div>
            <div class="text-sm font-semibold">${UI.escapeHtml(student ? student.name : inc.studentId)}</div>
            ${student && student.registerNumber ? `<div class="text-xs mono text-muted">${UI.escapeHtml(student.registerNumber)}</div>` : ''}
          </div>
          <div>
            <div class="text-xs text-muted">Room / Location</div>
            <div class="text-sm font-semibold">${UI.escapeHtml(inc.roomId || 'Unspecified')}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Assigned Responder</div>
            <div class="text-sm font-semibold">${inc.assignedTo ? UI.escapeHtml(inc.assignedTo) : '<span class="text-muted">Unassigned</span>'}</div>
            ${inc.assignmentType ? `<span class="badge badge-muted text-xs">${UI.escapeHtml(inc.assignmentType)}</span>` : ''}
          </div>
          <div>
            <div class="text-xs text-muted">Reported At</div>
            <div class="text-sm font-medium">${UI.formatDateTime(inc.createdAt)}</div>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase text-muted mb-1">Issue Description</div>
          <p class="text-sm" style="background:var(--color-white);padding:var(--space-3);border:1px solid var(--border-color);border-radius:var(--radius-sm);line-height:1.5;">
            ${UI.escapeHtml(inc.description)}
          </p>
        </div>

        <!-- Role Action Controls -->
        ${(currentRole === 'invigilator' && inc.assignedTo === currentUid) || currentRole === 'admin' ? `
          <div style="border-top:1px solid var(--border-color);padding-top:var(--space-3);">
            <div class="text-xs font-semibold uppercase text-muted mb-2">Update Operational State</div>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);">
              ${inc.status === 'assigned' ? `
                <button class="btn btn-secondary btn-sm" id="btn-accept-inc">
                  <i data-lucide="check"></i> Accept Incident
                </button>
              ` : ''}
              ${inc.status === 'accepted' || inc.status === 'assigned' ? `
                <button class="btn btn-secondary btn-sm" id="btn-start-inc">
                  <i data-lucide="play"></i> Start Work
                </button>
              ` : ''}
              ${inc.status !== 'resolved' && inc.status !== 'closed' ? `
                <button class="btn btn-primary btn-sm" id="btn-resolve-inc">
                  <i data-lucide="check-circle"></i> Mark Resolved
                </button>
              ` : ''}
              ${currentRole === 'admin' && inc.status === 'resolved' ? `
                <button class="btn btn-secondary btn-sm" id="btn-close-inc">
                  <i data-lucide="archive"></i> Close Ticket
                </button>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Admin Reassignment & Priority Override -->
        ${currentRole === 'admin' ? `
          <div style="border-top:1px solid var(--border-color);padding-top:var(--space-3);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
            <div>
              <label class="form-label text-xs">Reassign Invigilator</label>
              <div style="display:flex;gap:var(--space-2);">
                <select class="form-select text-xs" id="select-reassign-inv">
                  <option value="">Select Invigilator...</option>
                  ${invigList.map(inv => `<option value="${inv.id}" ${inv.id === inc.assignedTo ? 'selected' : ''}>${UI.escapeHtml(inv.name || inv.id)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-sm" id="btn-do-reassign">Assign</button>
              </div>
            </div>
            <div>
              <label class="form-label text-xs">Override Priority</label>
              <div style="display:flex;gap:var(--space-2);">
                <select class="form-select text-xs" id="select-override-pri">
                  <option value="normal" ${inc.priority === 'normal' ? 'selected' : ''}>Normal</option>
                  <option value="high" ${inc.priority === 'high' ? 'selected' : ''}>High</option>
                  <option value="critical" ${inc.priority === 'critical' ? 'selected' : ''}>Critical</option>
                </select>
                <button class="btn btn-secondary btn-sm" id="btn-do-pri">Apply</button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Add Internal Note -->
        <div style="border-top:1px solid var(--border-color);padding-top:var(--space-3);">
          <div class="text-xs font-semibold uppercase text-muted mb-2">Add Timeline Note</div>
          <div style="display:flex;gap:var(--space-2);">
            <input type="text" class="form-input text-xs" id="input-new-note" placeholder="Write operational note...">
            <button class="btn btn-secondary btn-sm" id="btn-add-note">Post</button>
          </div>
        </div>

        <!-- Real-time Activity Timeline -->
        <div style="border-top:1px solid var(--border-color);padding-top:var(--space-3);">
          <div class="text-xs font-semibold uppercase text-muted mb-2">Incident Audit Timeline</div>
          <div id="modal-incident-timeline"></div>
        </div>
      </div>
    `;

    UI.showModal(`Incident: ${inc.id || incidentId}`, modalBody);
    IncidentsHelper.renderTimeline(incidentId, document.getElementById('modal-incident-timeline'));

    // Attach event listeners inside modal
    const btnAccept = document.getElementById('btn-accept-inc');
    if (btnAccept) {
      btnAccept.onclick = async () => {
        await IncidentsHelper.updateStatus(incidentId, 'accepted', currentUid, currentRole, 'Invigilator acknowledged incident assignment');
        UI.closeModal();
        UI.toast('Incident accepted', 'success');
      };
    }

    const btnStart = document.getElementById('btn-start-inc');
    if (btnStart) {
      btnStart.onclick = async () => {
        await IncidentsHelper.updateStatus(incidentId, 'in-progress', currentUid, currentRole, 'Active response initiated');
        UI.closeModal();
        UI.toast('Work started on incident', 'info');
      };
    }

    const btnResolve = document.getElementById('btn-resolve-inc');
    if (btnResolve) {
      btnResolve.onclick = async () => {
        const details = prompt('Enter resolution summary:');
        if (details === null) return;
        await IncidentsHelper.updateStatus(incidentId, 'resolved', currentUid, currentRole, details || 'Issue resolved on site');
        UI.closeModal();
        UI.toast('Incident marked resolved', 'success');
      };
    }

    const btnClose = document.getElementById('btn-close-inc');
    if (btnClose) {
      btnClose.onclick = async () => {
        await IncidentsHelper.updateStatus(incidentId, 'closed', currentUid, currentRole, 'Ticket formally closed by administrator');
        UI.closeModal();
        UI.toast('Ticket closed', 'info');
      };
    }

    const btnReassign = document.getElementById('btn-do-reassign');
    if (btnReassign) {
      btnReassign.onclick = async () => {
        const targetInv = document.getElementById('select-reassign-inv').value;
        if (!targetInv) return;
        await IncidentsHelper.assignManually(incidentId, targetInv, currentUid);
        UI.closeModal();
        UI.toast('Incident reassigned', 'success');
      };
    }

    const btnPri = document.getElementById('btn-do-pri');
    if (btnPri) {
      btnPri.onclick = async () => {
        const targetPri = document.getElementById('select-override-pri').value;
        const reason = prompt('Reason for priority override:');
        if (reason === null) return;
        await IncidentsHelper.overridePriority(incidentId, targetPri, currentUid, currentRole, reason);
        UI.closeModal();
        UI.toast('Priority updated', 'success');
      };
    }

    const btnAddNote = document.getElementById('btn-add-note');
    if (btnAddNote) {
      btnAddNote.onclick = async () => {
        const noteInput = document.getElementById('input-new-note');
        if (!noteInput.value.trim()) return;
        await IncidentsHelper.addNote(incidentId, noteInput.value.trim(), currentUid, currentRole);
        noteInput.value = '';
        UI.toast('Note added to timeline', 'success');
      };
    }
  }
};

console.log('[ExamShield] Incidents helper loaded');
