// ExamShield — Firebase Configuration & Initialization
// Firebase SDK v8 Namespaced API (Supports Vite .env and Static fallbacks)

// 1. Resolve environment configuration from Vite plugin or window.__FIREBASE_CONFIG__
const _injectedEnv = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) ? window.__FIREBASE_CONFIG__ : {};

// 2. Resolve Vite import.meta.env if running in an ES module context
let _metaEnv = {};
try {
  _metaEnv = (new Function('try { return import.meta.env || {}; } catch(e) { return {}; }'))();
} catch (e) {
  _metaEnv = {};
}

function _resolveValue(metaKey, objKey, fallback) {
  const vMeta = _metaEnv && _metaEnv[metaKey];
  if (vMeta && typeof vMeta === 'string' && !vMeta.startsWith('%VITE_') && vMeta.trim() !== '') {
    return vMeta;
  }
  const vObj = _injectedEnv && _injectedEnv[objKey];
  if (vObj && typeof vObj === 'string' && !vObj.startsWith('%VITE_') && vObj.trim() !== '') {
    return vObj;
  }
  return fallback;
}

const firebaseConfig = {
  apiKey: _resolveValue('VITE_FIREBASE_API_KEY', 'apiKey', "AIzaSyC8uMIj-oPS5fPrtTKEQNqMutG1pgWzM5I"),
  authDomain: _resolveValue('VITE_FIREBASE_AUTH_DOMAIN', 'authDomain', "exaam-sheild.firebaseapp.com"),
  databaseURL: _resolveValue('VITE_FIREBASE_DATABASE_URL', 'databaseURL', "https://exaam-sheild-default-rtdb.firebaseio.com"),
  projectId: _resolveValue('VITE_FIREBASE_PROJECT_ID', 'projectId', "exaam-sheild"),
  storageBucket: _resolveValue('VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket', "exaam-sheild.firebasestorage.app"),
  messagingSenderId: _resolveValue('VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId', "260193808780"),
  appId: _resolveValue('VITE_FIREBASE_APP_ID', 'appId', "1:260193808780:web:7d3b8878484ed45f07a6a9")
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.database();

// Database references helper
const DB = {
  ref: (path) => db.ref('examshield/' + path),
  users: () => db.ref('examshield/users'),
  user: (uid) => db.ref('examshield/users/' + uid),
  exams: () => db.ref('examshield/exams'),
  exam: (id) => db.ref('examshield/exams/' + id),
  rooms: () => db.ref('examshield/rooms'),
  room: (id) => db.ref('examshield/rooms/' + id),
  assignments: (examId) => db.ref('examshield/assignments/' + examId),
  assignment: (examId, id) => db.ref('examshield/assignments/' + examId + '/' + id),
  attendance: (examId) => db.ref('examshield/attendance/' + examId),
  attendanceRecord: (examId, assignmentId) => db.ref('examshield/attendance/' + examId + '/' + assignmentId),
  incidents: () => db.ref('examshield/incidents'),
  incident: (id) => db.ref('examshield/incidents/' + id),
  incidentHistory: (id) => db.ref('examshield/incidentHistory/' + id),
  announcements: () => db.ref('examshield/announcements'),
  announcement: (id) => db.ref('examshield/announcements/' + id),
  qrTokens: () => db.ref('examshield/qrTokens'),
  qrToken: (token) => db.ref('examshield/qrTokens/' + token),
  invigilators: () => db.ref('examshield/invigilators'),
  invigilator: (uid) => db.ref('examshield/invigilators/' + uid),
  roomChecklists: (roomId) => db.ref('examshield/roomChecklists/' + roomId),
  roomChecklist: (roomId, itemId) => db.ref('examshield/roomChecklists/' + roomId + '/' + itemId),
  buildings: () => db.ref('examshield/buildings'),
  building: (id) => db.ref('examshield/buildings/' + id),
  floors: () => db.ref('examshield/floors'),
  floor: (id) => db.ref('examshield/floors/' + id),
  roomSeats: (roomId) => db.ref('examshield/roomSeats/' + roomId),
  importLogs: () => db.ref('examshield/importLogs'),
  invitations: () => db.ref('examshield/invitations'),
  invitation: (id) => db.ref('examshield/invitations/' + id),
  classes: () => db.ref('examshield/classes'),
  classItem: (id) => db.ref('examshield/classes/' + id),
  settings: () => db.ref('examshield/settings'),
  serverTimestamp: () => firebase.database.ServerValue.TIMESTAMP
};

// Generate unique IDs
function generateId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix ? prefix + '_' : '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate secure QR token
function generateQRToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

console.log('[ExamShield] Firebase initialized');
