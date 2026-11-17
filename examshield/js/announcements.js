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
  },

  // --- Real-Time Notification Center Engine ---
  _notifInitialized: false,
  _initialLoadComplete: false,

  getReadSet() {
    const uid = Auth.getUid() || 'guest';
    try {
      const arr = JSON.parse(localStorage.getItem('examshield_read_ann_' + uid) || '[]');
      return new Set(arr);
    } catch (e) {
      return new Set();
    }
  },

  saveReadSet(set) {
    const uid = Auth.getUid() || 'guest';
    try {
      localStorage.setItem('examshield_read_ann_' + uid, JSON.stringify(Array.from(set)));
    } catch (e) {}
  },

  async getRelevantAnnouncementsForUser() {
    const role = Auth.getRole();
    const uid = Auth.getUid();
    const user = Auth.currentUserData || {};
    const settings = await Database.get(DB.settings()) || {};
    const activeExamId = settings.activeExamId || 'exam_001';

    if (role === 'admin') {
      return await this.getAll();
    } else if (role === 'invigilator') {
      return await this.getForInvigilator(uid);
    } else {
      let roomId = null;
      if (user.assignedRooms) {
        roomId = Object.keys(user.assignedRooms)[0];
      }
      return await this.getForStudent(user, activeExamId, roomId);
    }
  },

  async updateNotificationBadge() {
    const badge = document.getElementById('header-unread-badge');
    if (!badge) return;

    const list = await this.getRelevantAnnouncementsForUser();
    const readSet = this.getReadSet();
    const unreadCount = list.filter(a => !readSet.has(a.id)).length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  },

  // Initialize notification listener
  initNotificationSystem() {
    if (this._notifInitialized) {
      this.updateNotificationBadge();
      return;
    }
    this._notifInitialized = true;

    // Listen for announcements
    const unsub = Database.listen(DB.announcements(), async (data) => {
      if (!data) return;

      const list = await this.getRelevantAnnouncementsForUser();
      const readSet = this.getReadSet();
      const unread = list.filter(a => !readSet.has(a.id));

      this.updateNotificationBadge();

      // Trigger notification banner if a new announcement is broadcast after boot
      if (this._initialLoadComplete && unread.length > 0) {
        const latest = unread[0];
        this.showNotificationAlert(latest);
      }
      this._initialLoadComplete = true;
    });

    ActiveListeners.add(unsub);
  },

  // Slide-in Notification Toast
  showNotificationAlert(ann) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-warning';
    toast.style.cursor = 'pointer';
    toast.innerHTML = `
      <i data-lucide="megaphone" style="width:20px;height:20px;flex-shrink:0;color:var(--color-warning);"></i>
      <div style="flex:1;">
        <div class="font-bold text-xs uppercase" style="color:var(--color-charcoal);letter-spacing:0.04em;">Official Bulletin Alert</div>
        <div class="font-semibold text-sm mt-1">${UI.escapeHtml(ann.title)}</div>
        <div class="text-xs text-muted truncate mt-1">${UI.escapeHtml(ann.message)}</div>
      </div>
      <button class="toast-close" onclick="event.stopPropagation(); this.closest('.toast').remove()">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;

    toast.onclick = () => {
      toast.remove();
      AnnouncementsHelper.openNotificationDrawer();
    };

    toastContainer.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 8000);
  },

  // Notification Drawer / Modal View
  async openNotificationDrawer() {
    const list = await this.getRelevantAnnouncementsForUser();
    const readSet = this.getReadSet();
    const unreadCount = list.filter(a => !readSet.has(a.id)).length;

    const modalBody = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:var(--space-3);margin-bottom:var(--space-4);border-bottom:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span class="font-bold text-sm">Notifications & Bulletins</span>
            ${unreadCount > 0 ? `<span class="badge badge-critical" style="font-size:0.625rem;">${unreadCount} Unread</span>` : '<span class="badge badge-success" style="font-size:0.625rem;">All Caught Up</span>'}
          </div>
          ${unreadCount > 0 ? `
            <button class="btn btn-ghost btn-sm text-xs" id="btn-mark-all-read">
              <i data-lucide="check-check"></i> Mark All as Read
            </button>
          ` : ''}
        </div>

        <div id="notif-drawer-list" style="display:flex;flex-direction:column;gap:var(--space-3);max-height:480px;overflow-y:auto;">
          ${!list.length ? `
            <div class="empty-state py-8">
              <i data-lucide="bell-off"></i>
              <h3>No Notifications</h3>
              <p class="text-xs text-muted">You have no active examination bulletins or announcements.</p>
            </div>
          ` : list.map(ann => {
            const isRead = readSet.has(ann.id);
            return `
              <div class="card" style="border-left:3px solid ${isRead ? 'var(--border-color)' : 'var(--color-green-600)'};background:${isRead ? 'var(--color-white)' : 'var(--color-green-50)'};padding:var(--space-3);cursor:pointer;" data-notif-id="${ann.id}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
                  <div style="display:flex;align-items:center;gap:var(--space-2);">
                    ${!isRead ? '<span class="status-dot present" style="width:6px;height:6px;"></span>' : ''}
                    <h4 class="font-bold text-sm ${isRead ? 'text-gray-700' : 'text-gray-900'}">${UI.escapeHtml(ann.title)}</h4>
                  </div>
                  <span class="badge badge-muted text-xs uppercase" style="font-size:0.625rem;">${UI.escapeHtml(ann.targetType)}</span>
                </div>
                <p class="text-xs text-muted mt-1 leading-relaxed">${UI.escapeHtml(ann.message)}</p>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);font-size:0.625rem;" class="text-muted">
                  <span>${UI.formatRelative(ann.createdAt)} · ${UI.formatDateTime(ann.createdAt)}</span>
                  ${!isRead ? '<span class="font-semibold text-green-700">Click to acknowledge</span>' : '<span class="text-gray-400">Acknowledged</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    UI.showModal('Notification Center', modalBody);

    // Click on individual card marks as read
    document.querySelectorAll('#notif-drawer-list .card[data-notif-id]').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.notifId;
        const set = AnnouncementsHelper.getReadSet();
        set.add(id);
        AnnouncementsHelper.saveReadSet(set);
        AnnouncementsHelper.updateNotificationBadge();
        AnnouncementsHelper.openNotificationDrawer();
      };
    });

    // Mark all read button
    const btnAllRead = document.getElementById('btn-mark-all-read');
    if (btnAllRead) {
      btnAllRead.onclick = () => {
        const set = AnnouncementsHelper.getReadSet();
        list.forEach(a => set.add(a.id));
        AnnouncementsHelper.saveReadSet(set);
        AnnouncementsHelper.updateNotificationBadge();
        UI.toast('All notifications marked as read', 'info', 2000);
        AnnouncementsHelper.openNotificationDrawer();
      };
    }
  }
};

console.log('[ExamShield] Announcements helper loaded');
