// ExamShield — Live Exam Countdown Engine
// Provides high-precision, real-time countdown tickers for candidates facing upcoming or ongoing examinations.

const ExamCountdown = {
  activeTimers: new Map(),

  // Parse exam date & start/end times into standard UTC/local epoch milliseconds
  parseExamSchedule(exam) {
    if (!exam) return null;

    let dateStr = exam.date;
    if (!dateStr) {
      // Default to today
      const today = new Date();
      dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    const startClock = exam.startTime || '09:30';
    const endClock = exam.endTime || '12:30';

    // Parse start date
    let startTimestamp = NaN;
    let endTimestamp = NaN;

    try {
      const [year, month, day] = dateStr.includes('-')
        ? dateStr.split('-').map(Number)
        : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];

      const [sHour, sMin] = startClock.split(':').map(Number);
      const [eHour, eMin] = endClock.split(':').map(Number);

      const startDate = new Date(year, month - 1, day, sHour || 9, sMin || 0, 0);
      const endDate = new Date(year, month - 1, day, eHour || 12, eMin || 0, 0);

      startTimestamp = startDate.getTime();
      endTimestamp = endDate.getTime();
    } catch (err) {
      console.warn('[ExamCountdown] Schedule parse fallback:', err);
      startTimestamp = Date.now() + 3600000;
      endTimestamp = startTimestamp + 7200000;
    }

    return {
      dateStr,
      startClock,
      endClock,
      startTimestamp,
      endTimestamp
    };
  },

  // Calculate current interval delta
  getDelta(schedule) {
    if (!schedule) return null;
    const now = Date.now();
    const { startTimestamp, endTimestamp } = schedule;

    if (now < startTimestamp) {
      const diff = Math.max(0, startTimestamp - now);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      return {
        state: 'upcoming',
        totalMs: diff,
        days,
        hours,
        minutes,
        seconds
      };
    } else if (now <= endTimestamp) {
      const diff = Math.max(0, endTimestamp - now);
      const days = 0;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      return {
        state: 'ongoing',
        totalMs: diff,
        days,
        hours,
        minutes,
        seconds
      };
    } else {
      return {
        state: 'concluded',
        totalMs: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }
  },

  // Render a live updating countdown card into a target container
  render(target, exam, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) return;

    // Clear any previous timer on this element
    const elId = container.id || ('countdown_' + Math.random().toString(36).substring(2, 8));
    if (!container.id) container.id = elId;
    if (this.activeTimers.has(elId)) {
      clearInterval(this.activeTimers.get(elId));
      this.activeTimers.delete(elId);
    }

    const schedule = this.parseExamSchedule(exam);
    if (!schedule) {
      container.innerHTML = `
        <div class="card p-4 text-center">
          <div class="text-xs text-muted">No examination schedule active.</div>
        </div>
      `;
      return;
    }

    const initialDelta = this.getDelta(schedule);
    const compact = options.compact === true;
    const examTitle = exam.title || 'Official Board Examination';

    const buildHtml = (delta) => {
      const pad = (n) => String(n).padStart(2, '0');

      if (delta.state === 'upcoming') {
        if (compact) {
          return `
            <div class="exam-countdown-compact">
              <span class="countdown-badge"><i data-lucide="clock"></i> Starts in:</span>
              <span class="countdown-digits mono font-bold">
                ${delta.days > 0 ? `${delta.days}d ` : ''}${pad(delta.hours)}h ${pad(delta.minutes)}m ${pad(delta.seconds)}s
              </span>
            </div>
          `;
        }

        return `
          <div class="exam-countdown-card card mb-6" style="border-top:4px solid var(--color-green-600);background:linear-gradient(180deg, #ffffff 0%, var(--color-off-white) 100%);">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4);">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="status-dot present" style="animation: pulse-dot 2s infinite;"></span>
                    <span class="text-xs font-bold uppercase tracking-wider text-muted">Upcoming Examination Countdown</span>
                  </div>
                  <h3 class="font-bold text-lg text-black mt-1">${UI.escapeHtml(examTitle)}</h3>
                </div>
                <div class="text-right">
                  <span class="badge badge-normal text-xs font-semibold">Commences at ${schedule.startClock}</span>
                  <div class="text-xs text-muted mt-1">${schedule.dateStr}</div>
                </div>
              </div>

              <!-- Digital Counter Units Grid -->
              <div class="countdown-grid" id="${elId}-grid">
                <div class="countdown-box">
                  <div class="countdown-digit mono" id="${elId}-days">${pad(delta.days)}</div>
                  <div class="countdown-label">Days</div>
                </div>
                <div class="countdown-divider">:</div>
                <div class="countdown-box">
                  <div class="countdown-digit mono" id="${elId}-hours">${pad(delta.hours)}</div>
                  <div class="countdown-label">Hours</div>
                </div>
                <div class="countdown-divider">:</div>
                <div class="countdown-box">
                  <div class="countdown-digit mono" id="${elId}-mins">${pad(delta.minutes)}</div>
                  <div class="countdown-label">Minutes</div>
                </div>
                <div class="countdown-divider">:</div>
                <div class="countdown-box">
                  <div class="countdown-digit mono countdown-sec" id="${elId}-secs">${pad(delta.seconds)}</div>
                  <div class="countdown-label">Seconds</div>
                </div>
              </div>

              <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);font-size:var(--text-xs);color:var(--color-gray-600);">
                <div style="display:flex;align-items:center;gap:6px;">
                  <i data-lucide="info" style="width:14px;height:14px;color:var(--color-green-600);"></i>
                  <span>Candidate reporting deadline: <strong>15 minutes</strong> prior to commencement.</span>
                </div>
                <button class="btn btn-ghost btn-sm text-xs" onclick="Router.navigate('student/seat-finder')">
                  Verify Seat &rarr;
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (delta.state === 'ongoing') {
        return `
          <div class="exam-countdown-card card mb-6" style="border-top:4px solid var(--color-green-600);background:#f0fdf4;">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4);">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="status-dot present" style="animation: pulse-dot 1.2s infinite;background:var(--color-green-600);"></span>
                    <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--color-green-700);">Session Live & Ongoing</span>
                  </div>
                  <h3 class="font-bold text-lg text-black mt-1">${UI.escapeHtml(examTitle)}</h3>
                </div>
                <span class="badge badge-success text-xs font-bold">In Progress</span>
              </div>

              <div class="countdown-grid" id="${elId}-grid">
                <div class="countdown-box">
                  <div class="countdown-digit mono" id="${elId}-hours" style="color:var(--color-green-700);">${pad(delta.hours)}</div>
                  <div class="countdown-label">Hours Left</div>
                </div>
                <div class="countdown-divider">:</div>
                <div class="countdown-box">
                  <div class="countdown-digit mono" id="${elId}-mins" style="color:var(--color-green-700);">${pad(delta.minutes)}</div>
                  <div class="countdown-label">Minutes Left</div>
                </div>
                <div class="countdown-divider">:</div>
                <div class="countdown-box">
                  <div class="countdown-digit mono countdown-sec" id="${elId}-secs" style="color:var(--color-green-700);">${pad(delta.seconds)}</div>
                  <div class="countdown-label">Seconds Left</div>
                </div>
              </div>

              <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid rgba(22,163,74,0.2);display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs);color:var(--color-green-800);">
                <span>Have your digital QR pass ready on desk for faculty verification.</span>
                <span class="mono font-semibold">Ends at ${schedule.endClock}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="exam-countdown-card card mb-6" style="border-top:4px solid var(--color-gray-400);">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div class="text-xs font-bold uppercase tracking-wider text-muted">Examination Concluded</div>
                  <h3 class="font-bold text-base text-black mt-1">${UI.escapeHtml(examTitle)}</h3>
                </div>
                <span class="badge badge-muted text-xs">Concluded</span>
              </div>
              <p class="text-xs text-muted mt-2">
                This examination session has ended. Official attendance roll and answer script collection have concluded.
              </p>
            </div>
          </div>
        `;
      }
    };

    // Initial render
    container.innerHTML = buildHtml(initialDelta);
    if (window.lucide) {
      window.lucide.createIcons({ nodes: [container] });
    }

    // Set 1-second ticker interval
    let currentState = initialDelta.state;

    const timer = setInterval(() => {
      const delta = this.getDelta(schedule);

      // If state changed (e.g. upcoming -> ongoing or ongoing -> concluded), re-render full card
      if (delta.state !== currentState) {
        currentState = delta.state;
        container.innerHTML = buildHtml(delta);
        if (window.lucide) window.lucide.createIcons({ nodes: [container] });
        if (delta.state === 'concluded') {
          clearInterval(timer);
          this.activeTimers.delete(elId);
        }
        return;
      }

      // Smooth in-place DOM updates without re-rendering container
      const pad = (n) => String(n).padStart(2, '0');

      const daysEl = document.getElementById(`${elId}-days`);
      const hoursEl = document.getElementById(`${elId}-hours`);
      const minsEl = document.getElementById(`${elId}-mins`);
      const secsEl = document.getElementById(`${elId}-secs`);

      if (daysEl) daysEl.textContent = pad(delta.days);
      if (hoursEl) hoursEl.textContent = pad(delta.hours);
      if (minsEl) minsEl.textContent = pad(delta.minutes);
      if (secsEl) secsEl.textContent = pad(delta.seconds);

      // If compact widget
      if (compact) {
        const compactDigit = container.querySelector('.countdown-digits');
        if (compactDigit) {
          compactDigit.textContent = `${delta.days > 0 ? `${delta.days}d ` : ''}${pad(delta.hours)}h ${pad(delta.minutes)}m ${pad(delta.seconds)}s`;
        }
      }
    }, 1000);

    this.activeTimers.set(elId, timer);

    // Register with ActiveListeners for clean disposal on route transitions
    if (typeof ActiveListeners !== 'undefined') {
      ActiveListeners.add(() => {
        clearInterval(timer);
        ExamCountdown.activeTimers.delete(elId);
      });
    }

    return () => {
      clearInterval(timer);
      this.activeTimers.delete(elId);
    };
  }
};
