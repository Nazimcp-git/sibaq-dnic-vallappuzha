import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8uMIj-oPS5fPrtTKEQNqMutG1pgWzM5I",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "exaam-sheild.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://exaam-sheild-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "exaam-sheild",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "exaam-sheild.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "260193808780",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:260193808780:web:7d3b8878484ed45f07a6a9"
};

// Avoid initializing multiple times
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.database();

export const DB = {
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

export function generateId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix ? prefix + '_' : '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function generateQRToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Global window exposure for dynamic templates and backward compatibility
if (typeof window !== 'undefined') {
  window.firebase = firebase;
  window.auth = auth;
  window.db = db;
  window.DB = DB;
  window.generateId = generateId;
  window.generateQRToken = generateQRToken;
}

export default firebase;
