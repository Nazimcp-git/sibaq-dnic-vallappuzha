// ExamShield — Application Configuration & Constants

export const APP_CONFIG = {
  appName: 'ExamShield',
  appTitle: 'Examination Command Center',
  tagline: 'One Examination. One Command Center.',
  version: '1.0.0',
  defaultExamId: 'exam_001',
  defaultInstitutionName: 'National Institute of Technology — Demo'
};

export const INCIDENT_CATEGORIES = {
  'medical': 'Medical Emergency',
  'safety': 'Safety Emergency',
  'wrong-room': 'Wrong Room',
  'admit-card': 'Admit Card Problem',
  'wrong-seat': 'Wrong Seat',
  'missing-stationery': 'Missing Stationery',
  'exam-info': 'Examination Information',
  'other': 'Other Issue'
};

export const PRIORITY_RULES = {
  'medical': 'critical',
  'safety': 'critical',
  'wrong-room': 'high',
  'admit-card': 'high',
  'wrong-seat': 'high',
  'missing-stationery': 'normal',
  'exam-info': 'normal',
  'other': 'normal'
};

export const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
};

export const READINESS_CHECKLIST_ITEMS = [
  { id: 'invigilator', label: 'Invigilator assigned' },
  { id: 'seating', label: 'Student seating prepared' },
  { id: 'attendance', label: 'Attendance list available' },
  { id: 'materials', label: 'Examination materials ready' },
  { id: 'inspection', label: 'Room inspection completed' },
  { id: 'qr', label: 'QR verification ready' },
  { id: 'emergency', label: 'Emergency contact info available' }
];

if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
  window.INCIDENT_CATEGORIES = INCIDENT_CATEGORIES;
}
