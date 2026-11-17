// ExamShield — Instant Announcements Module

const AnnouncementsHelper = {
  // Create announcement
  async create(data) {
    if (!data.title || !data.message) throw new Error('Title and message are required');

    const announcementId = generateId('ann');
    const record = {
      id: announcementId,
      title: data.title.trim(),
      message: data.message.trim(),
      targetType: data.targetType || 'all', // 'all', 'exam', 'class', 'room', 'invigilators', 'invigilator'
      targetId: data.targetId || '',
      createdAt: DB.serverTimestamp(),
      expiresAt: data.expiresAt || null,
      active: true,
      createdBy: Auth.getUid()
    };

    await Database.set(DB.announcement(announcementId), record);
    return record;
  },

  // Deactivate announcement
  async deactivate(id) {
    await Database.update(DB.announcement(id), { active: false, updatedAt: DB.serverTimestamp() });
  },

  // Filter announcements for a student
  async getForStudent(studentData, activeExamId = null, assignedRoomId = null) {
    const list = await Database.getList(DB.announcements());
    const now = Date.now();

    return list.filter(ann => {
      if (ann.active === false) return false;
      if (ann.expiresAt && ann.expiresAt < now) return false;

      if (ann.targetType === 'all') return true;
      if (ann.targetType === 'exam' && ann.targetId === activeExamId) return true;
      if (ann.targetType === 'class' && studentData && ann.targetId === studentData.classId) return true;
      if (ann.targetType === 'room' && ann.targetId === assignedRoomId) return true;
      return false;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // Filter announcements for an invigilator
  async getForInvigilator(uid) {
    const list = await Database.getList(DB.announcements());
    const now = Date.now();

    return list.filter(ann => {
      if (ann.active === false) return false;
      if (ann.expiresAt && ann.expiresAt < now) return false;

      if (ann.targetType === 'all' || ann.targetType === 'invigilators') return true;
      if (ann.targetType === 'invigilator' && ann.targetId === uid) return true;
      return false;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // Get all announcements (admin)
  async getAll() {
    const list = await Database.getList(DB.announcements());
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // Render Announcement Cards
  renderAnnouncementsList(announcements, container, options = {}) {
    const showAdminActions = options.showAdminActions || false;

    if (!announcements || !announcements.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="bell-off"></i>
          <h3>No announcements</h3>
          <p>There are no active bulletins or updates at this time.</p>
        </div>
      `;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-3);">
        ${announcements.map(ann => `
          <div class="announcement-card ${ann.targetType === 'all' ? 'important' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-2);">
              <h4 class="announcement-title">${UI.escapeHtml(ann.title)}</h4>
              <div style="display:flex;gap:var(--space-2);align-items:center;">
                <span class="badge badge-muted text-xs uppercase">${UI.escapeHtml(ann.targetType)}${ann.targetId ? ': ' + UI.escapeHtml(ann.targetId) : ''}</span>
                ${showAdminActions && ann.active !== false ? `
                  <button class="btn btn-ghost btn-sm" data-deactivate="${ann.id}" title="Deactivate announcement">
                    <i data-lucide="archive" style="width:14px;height:14px;"></i>
                  </button>
                ` : ''}
              </div>
            </div>
            <p class="announcement-body">${UI.escapeHtml(ann.message)}</p>
            <div class="announcement-meta">
              Published ${UI.formatDateTime(ann.createdAt)}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    if (showAdminActions) {
      container.querySelectorAll('button[data-deactivate]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.deactivate;
          UI.confirm('Deactivate Announcement', 'Are you sure you want to deactivate this announcement?', async () => {
            await AnnouncementsHelper.deactivate(id);
            UI.toast('Announcement deactivated', 'info');
          });
        };
      });
    }
  },

  // Render announcement creation form modal
  async renderCreateModal(onSuccess) {
    const exams = await Database.getList(DB.exams());
    const rooms = await Database.getList(DB.rooms());
    const users = await Database.getList(DB.users());
    const invigilators = users.filter(u => u.role === 'invigilator');

    const formHtml = `
      <form id="create-announcement-form">
        <div class="form-group">
          <label class="form-label">Title <span class="required">*</span></label>
          <input type="text" id="ann-title" class="form-input" placeholder="e.g. Schedule Clarification or Room Note" required>
        </div>

        <div class="form-group">
          <label class="form-label">Message Body <span class="required">*</span></label>
          <textarea id="ann-message" class="form-textarea" placeholder="Write the announcement message here..." required></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Target Audience <span class="required">*</span></label>
          <select id="ann-target-type" class="form-select">
            <option value="all">Everyone (All Students & Invigilators)</option>
            <option value="exam">Specific Examination</option>
            <option value="room">Specific Examination Room</option>
            <option value="class">Specific Class Batch</option>
            <option value="invigilators">All Invigilators Only</option>
            <option value="invigilator">Specific Invigilator</option>
          </select>
        </div>

        <div class="form-group" id="ann-target-id-group" style="display:none;">
          <label class="form-label" id="ann-target-id-label">Target Reference</label>
          <select id="ann-target-id" class="form-select"></select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-ann">Publish Announcement</button>
        </div>
      </form>
    `;

    UI.showModal('Create Instant Announcement', formHtml);

    const typeSelect = document.getElementById('ann-target-type');
    const idGroup = document.getElementById('ann-target-id-group');
    const idSelect = document.getElementById('ann-target-id');
    const idLabel = document.getElementById('ann-target-id-label');

    typeSelect.onchange = () => {
      const type = typeSelect.value;
      idSelect.innerHTML = '';

      if (type === 'all' || type === 'invigilators') {
        idGroup.style.display = 'none';
        return;
      }

      idGroup.style.display = 'block';

      if (type === 'exam') {
        idLabel.textContent = 'Select Examination';
        exams.forEach(ex => {
          idSelect.innerHTML += `<option value="${ex.id}">${UI.escapeHtml(ex.title)}</option>`;
        });
      } else if (type === 'room') {
        idLabel.textContent = 'Select Room';
        rooms.forEach(rm => {
          idSelect.innerHTML += `<option value="${rm.id}">${UI.escapeHtml(rm.name)} (${UI.escapeHtml(rm.building || '')})</option>`;
        });
      } else if (type === 'class') {
        idLabel.textContent = 'Enter Class Code';
        idSelect.innerHTML = `
          <option value="CS-A">CS-A</option>
          <option value="CS-B">CS-B</option>
          <option value="CS-C">CS-C</option>
        `;
      } else if (type === 'invigilator') {
        idLabel.textContent = 'Select Invigilator';
        invigilators.forEach(inv => {
          idSelect.innerHTML += `<option value="${inv.id}">${UI.escapeHtml(inv.name || inv.id)}</option>`;
        });
      }
    };

    document.getElementById('create-announcement-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-ann');
      UI.setLoading(btn, true);

      try {
        await AnnouncementsHelper.create({
          title: document.getElementById('ann-title').value,
          message: document.getElementById('ann-message').value,
          targetType: typeSelect.value,
          targetId: idGroup.style.display !== 'none' ? idSelect.value : ''
        });

        UI.closeModal();
        UI.toast('Announcement broadcast successfully', 'success');
        if (onSuccess) onSuccess();
      } catch (err) {
        UI.toast('Failed to publish: ' + err.message, 'error');
        UI.setLoading(btn, false);
      }
    };
  }
};

console.log('[ExamShield] Announcements helper loaded');
