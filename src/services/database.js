// ExamShield — Database Operations & Class Helper
import { db, DB } from '../config/firebase.js';

export const Database = {
  // --- CRUD Operations ---
  async get(ref) {
    const snap = await ref.once('value');
    return snap.val();
  },

  async getWithKey(ref) {
    const snap = await ref.once('value');
    if (!snap.exists()) return null;
    return { id: snap.key, ...snap.val() };
  },

  async getList(ref) {
    const snap = await ref.once('value');
    const data = snap.val();
    if (!data) return [];
    return Object.entries(data).map(([id, val]) => ({ id, ...val }));
  },

  async set(ref, data) {
    await ref.set(data);
    return data;
  },

  async update(ref, data) {
    await ref.update(data);
    return data;
  },

  async push(ref, data) {
    const newRef = ref.push();
    await newRef.set(data);
    return { id: newRef.key, ...data };
  },

  async remove(ref) {
    await ref.remove();
  },

  async transaction(ref, updateFn) {
    return ref.transaction(updateFn);
  },

  // Multi-location update
  async multiUpdate(updates) {
    const prefixed = {};
    for (const [path, val] of Object.entries(updates)) {
      prefixed['examshield/' + path] = val;
    }
    await db.ref().update(prefixed);
  },

  // Listen for real-time changes
  listen(ref, callback) {
    ref.on('value', snap => callback(snap.val(), snap.key));
    return () => ref.off('value');
  },

  listenChildAdded(ref, callback) {
    ref.on('child_added', snap => callback({ id: snap.key, ...snap.val() }));
    return () => ref.off('child_added');
  },

  listenChildChanged(ref, callback) {
    ref.on('child_changed', snap => callback({ id: snap.key, ...snap.val() }));
    return () => ref.off('child_changed');
  }
};

// --- Active Listeners Management ---
export const ActiveListeners = {
  _listeners: [],

  add(unsubscribe) {
    this._listeners.push(unsubscribe);
    return unsubscribe;
  },

  clearAll() {
    this._listeners.forEach(unsub => {
      try { unsub(); } catch(e) {}
    });
    this._listeners = [];
  }
};

// --- Class Batch Management Helper ---
export const ClassHelper = {
  // Retrieve all configured classes, with continuous auto-discovery from student records & seed defaults
  async getAllClasses() {
    let rawClasses = await Database.getList(DB.classes()) || [];
    const classMap = new Map();

    // 1. Process stored classes (normalize code & name)
    rawClasses.forEach(c => {
      const code = String(c.code || c.name || c.id || '').replace(/^class_/, '').trim().toUpperCase();
      if (code && !classMap.has(code)) {
        classMap.set(code, {
          id: c.id || ('class_' + code.replace(/[^a-zA-Z0-9]/g, '')),
          code: code,
          name: c.name && c.name !== code ? c.name : `Class Batch ${code}`,
          department: c.department || (code.startsWith('CS') ? 'Computer Science' : (code.startsWith('EC') ? 'Electronics' : 'General Academics'))
        });
      }
    });

    // 2. Discover from registered student accounts
    try {
      const users = await Database.getList(DB.users()) || [];
      users.forEach(u => {
        if (u.role === 'student') {
          const cCode = String(u.classId || u.class || '').trim().toUpperCase();
          if (cCode && cCode !== 'DEFAULT' && cCode !== 'UNASSIGNED' && !classMap.has(cCode)) {
            classMap.set(cCode, {
              id: 'class_' + cCode.replace(/[^a-zA-Z0-9]/g, ''),
              code: cCode,
              name: `Class Batch ${cCode}`,
              department: cCode.startsWith('CS') ? 'Computer Science' : (cCode.startsWith('EC') ? 'Electronics' : 'General Academics')
            });
          }
        }
      });
    } catch (e) {
      console.warn('[ClassHelper] Could not scan users for classes:', e);
    }

    // 3. Ensure baseline demo cohorts exist so admins always have diverse batches to test
    const baseBatches = ['CS-101', 'CS-102', 'CS-A', 'CS-B', '10-A', '10-B', 'EC-201'];
    baseBatches.forEach(code => {
      if (!classMap.has(code)) {
        classMap.set(code, {
          id: 'class_' + code.replace(/[^a-zA-Z0-9]/g, ''),
          code: code,
          name: `Class Batch ${code}`,
          department: code.startsWith('CS') ? 'Computer Science' : (code.startsWith('EC') ? 'Electronics' : 'General Academics')
        });
      }
    });

    // 4. Persist any newly discovered classes to Firebase RTDB
    const updates = {};
    classMap.forEach((cObj, code) => {
      const existsInDb = rawClasses.some(rc => {
        const rcCode = String(rc.code || rc.name || rc.id || '').replace(/^class_/, '').trim().toUpperCase();
        return rcCode === code;
      });
      if (!existsInDb) {
        updates['classes/' + cObj.id] = {
          id: cObj.id,
          code: cObj.code,
          name: cObj.name,
          department: cObj.department,
          createdAt: DB.serverTimestamp()
        };
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await Database.multiUpdate(updates);
      } catch (err) {
        console.warn('[ClassHelper] Class auto-sync warning:', err);
      }
    }

    return Array.from(classMap.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  },

  // Add new class
  async addClass(code, name = '', department = '') {
    const cleanCode = String(code).trim().toUpperCase();
    if (!cleanCode) return null;
    const id = 'class_' + cleanCode.replace(/[^a-zA-Z0-9]/g, '');

    const record = {
      id: id,
      code: cleanCode,
      name: name.trim() || `Class Batch ${cleanCode}`,
      department: department.trim() || 'General Academics',
      createdAt: DB.serverTimestamp(),
      updatedAt: DB.serverTimestamp()
    };

    await Database.set(DB.classItem(id), record);
    return record;
  },

  // Delete a class
  async removeClass(id) {
    await Database.remove(DB.classItem(id));
  },

  // Helper to generate options HTML for select dropdowns
  async renderClassOptions(selectedCode = '', options = {}) {
    const classes = await this.getAllClasses();
    let html = '';

    const escape = (str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
    };

    if (options.includeAll) {
      html += `<option value="all" ${selectedCode === 'all' ? 'selected' : ''}>All Classes (Open Examination)</option>`;
    } else if (options.placeholder !== false) {
      html += `<option value="">${options.placeholder || '-- Select Class Batch --'}</option>`;
    }

    classes.forEach(c => {
      const isSel = (c.code === selectedCode || c.id === selectedCode);
      html += `<option value="${escape(c.code)}" ${isSel ? 'selected' : ''}>Class ${escape(c.code)} — ${escape(c.name)}</option>`;
    });

    if (options.allowAdd) {
      html += `<option value="__new__">+ Add New Class...</option>`;
    }

    return html;
  }
};

if (typeof window !== 'undefined') {
  window.Database = Database;
  window.ActiveListeners = ActiveListeners;
  window.ClassHelper = ClassHelper;
}
