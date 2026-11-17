// ExamShield — Offline-Friendly Caching & Sync Queue

const OfflineManager = {
  isOnline: navigator.onLine,

  // Initialize service worker and network listeners
  init() {
    // Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[Offline] ServiceWorker registered with scope:', reg.scope);
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  UI.toast('Application update ready. Refresh to activate.', 'info', 6000);
                }
              };
            };
          })
          .catch((err) => {
            console.warn('[Offline] ServiceWorker registration failed:', err);
          });
      });
    }

    // Network status events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showOfflineIndicator(false);
      UI.toast('Network restored. Synchronizing offline queue...', 'success', 3000);
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineIndicator(true);
      UI.toast('You are now offline. Running from local cache.', 'warning', 4000);
    });

    // Check initial state
    this.showOfflineIndicator(!navigator.onLine);

    // If online at boot, attempt sync
    if (navigator.onLine) {
      this.syncQueue();
    }
  },

  // Toggle offline bar
  showOfflineIndicator(isOffline) {
    const bar = document.getElementById('offline-bar');
    if (bar) {
      if (isOffline) {
        bar.classList.add('visible');
      } else {
        bar.classList.remove('visible');
      }
    }
  },

  // Cache user data locally
  cacheUserData(uid, data) {
    if (!uid || !data) return;
    try {
      localStorage.setItem(`examshield_cache_${uid}`, JSON.stringify({
        data: data,
        cachedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[Offline] Failed to cache user data:', e);
    }
  },

  // Retrieve cached user data
  getCachedUserData(uid) {
    try {
      const raw = localStorage.getItem(`examshield_cache_${uid}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  // Queue incident for offline submission
  queueIncident(incidentData) {
    try {
      const queue = JSON.parse(localStorage.getItem('examshield_sync_queue') || '[]');
      const queuedItem = {
        ...incidentData,
        queuedId: 'offline_' + Date.now(),
        queuedAt: Date.now(),
        status: 'pending-sync'
      };
      queue.push(queuedItem);
      localStorage.setItem('examshield_sync_queue', JSON.stringify(queue));
      UI.toast('Report saved locally. It will automatically submit once online.', 'info', 5000);
      return queuedItem;
    } catch (e) {
      UI.toast('Failed to store incident offline: storage full.', 'error');
      return null;
    }
  },

  // Get current sync queue
  getSyncQueue() {
    try {
      return JSON.parse(localStorage.getItem('examshield_sync_queue') || '[]');
    } catch (e) {
      return [];
    }
  },

  // Count items pending sync
  getSyncQueueCount() {
    return this.getSyncQueue().length;
  },

  // Synchronize queued items to Firebase
  async syncQueue() {
    if (!navigator.onLine) return;
    const queue = this.getSyncQueue();
    if (!queue.length) return;

    console.log(`[Offline] Attempting to sync ${queue.length} queued records...`);
    const remaining = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        // Submit through IncidentsHelper
        await IncidentsHelper.createIncident({
          studentId: item.studentId,
          examId: item.examId,
          roomId: item.roomId,
          category: item.category,
          description: item.description + ' (Submitted offline at ' + new Date(item.queuedAt).toLocaleTimeString() + ')'
        });
        syncedCount++;
      } catch (err) {
        console.error('[Offline] Error syncing queued incident:', err);
        remaining.push(item);
      }
    }

    localStorage.setItem('examshield_sync_queue', JSON.stringify(remaining));

    if (syncedCount > 0) {
      UI.toast(`Successfully synchronized ${syncedCount} offline incident report(s)!`, 'success', 4000);
      // If student is currently viewing incidents page, refresh
      if (window.location.hash.includes('incidents')) {
        Router.route();
      }
    }
  },

  // Render synchronization drawer/modal
  renderSyncStatus(container) {
    const queue = this.getSyncQueue();
    if (!queue.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="check-circle" style="color:var(--color-green-600);"></i>
          <h3>All records synchronized</h3>
          <p class="text-xs">Your device has no pending offline submissions.</p>
        </div>
      `;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">
          <span class="font-semibold text-xs uppercase">${queue.length} Queued Incident(s)</span>
          <button class="btn btn-primary btn-sm" id="btn-manual-sync">
            <i data-lucide="refresh-cw"></i> Sync Now
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${queue.map(q => `
            <div style="padding:var(--space-3);background:var(--color-warning-bg);border:1px solid var(--color-warning);border-radius:var(--radius-sm);font-size:var(--text-xs);">
              <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span class="font-bold text-dark">${UI.escapeHtml(INCIDENT_CATEGORIES[q.category] || q.category)}</span>
                <span class="badge badge-warning">Pending Online Sync</span>
              </div>
              <p class="text-muted mb-1">${UI.escapeHtml(q.description)}</p>
              <div class="text-muted" style="font-size:0.625rem;">Queued at: ${new Date(q.queuedAt).toLocaleTimeString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    lucide.createIcons({ nodes: [container] });

    document.getElementById('btn-manual-sync').onclick = async () => {
      await OfflineManager.syncQueue();
      OfflineManager.renderSyncStatus(container);
    };
  }
};

console.log('[ExamShield] Offline module loaded');
