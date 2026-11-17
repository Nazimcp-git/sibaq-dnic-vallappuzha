// ExamShield — Firebase Configuration & Initialization
// Firebase SDK v8 Namespaced API

const firebaseConfig = {
  // Replace with your Firebase project configuration
  apiKey: "AIzaSyC8uMIj-oPS5fPrtTKEQNqMutG1pgWzM5I",
  authDomain: "exaam-sheild.firebaseapp.com",
  databaseURL: "https://exaam-sheild-default-rtdb.firebaseio.com",
  projectId: "exaam-sheild",
  storageBucket: "exaam-sheild.firebasestorage.app",
  messagingSenderId: "260193808780",
  appId: "1:260193808780:web:7d3b8878484ed45f07a6a9"
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
