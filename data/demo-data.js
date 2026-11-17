// ExamShield — Demo Data Loader
// Run this in browser console after Firebase is initialized and you're signed in as admin
// OR include it as a script and call loadDemoData()

async function loadDemoData() {
  if (!confirm('This will load demo data into your ExamShield database. Continue?')) return;

  const db = firebase.database();
  const base = 'examshield';

  console.log('[Demo] Starting demo data load...');

  // --- Settings ---
  const settingsData = {
    institutionName: 'National Institute of Technology — Demo',
    activeExamId: 'exam_001',
    systemStatus: 'active'
  };

  // --- Buildings ---
  const buildings = {
    bldg_A: { name: 'Academic Block A', floors: { floor_A1: true, floor_A2: true } },
    bldg_B: { name: 'Academic Block B', floors: { floor_B1: true } }
  };

  // --- Floors ---
  const floors = {
    floor_A1: { buildingId: 'bldg_A', name: 'Ground Floor', sortOrder: 1 },
    floor_A2: { buildingId: 'bldg_A', name: 'First Floor', sortOrder: 2 },
    floor_B1: { buildingId: 'bldg_B', name: 'Ground Floor', sortOrder: 1 }
  };

  // --- Exam ---
  const exams = {
    exam_001: {
      title: 'CS301 — Data Structures & Algorithms',
      date: '2026-11-18',
      startTime: '10:00',
      endTime: '13:00',
      status: 'active',
      createdAt: Date.now()
    }
  };

  // --- Rooms ---
  const rooms = {
    room_A101: {
      name: 'A-101', building: 'Academic Block A', buildingId: 'bldg_A', floorId: 'floor_A1',
      block: 'A', rows: 5, columns: 6, capacity: 30,
      invigilatorId: '', status: 'preparing',
      floorPlanPosition: { x: 5, y: 5, width: 42, height: 40 },
      layout: { orientation: 'standard', entrancePosition: 'back', deskPosition: 'front' },
      createdAt: Date.now(), updatedAt: Date.now()
    },
    room_A102: {
      name: 'A-102', building: 'Academic Block A', buildingId: 'bldg_A', floorId: 'floor_A1',
      block: 'A', rows: 4, columns: 5, capacity: 20,
      invigilatorId: '', status: 'not-ready',
      floorPlanPosition: { x: 53, y: 5, width: 42, height: 40 },
      layout: { orientation: 'standard', entrancePosition: 'back', deskPosition: 'front' },
      createdAt: Date.now(), updatedAt: Date.now()
    },
    room_B101: {
      name: 'B-101', building: 'Academic Block B', buildingId: 'bldg_B', floorId: 'floor_B1',
      block: 'B', rows: 5, columns: 5, capacity: 25,
      invigilatorId: '', status: 'not-ready',
      floorPlanPosition: { x: 5, y: 55, width: 42, height: 40 },
      layout: { orientation: 'standard', entrancePosition: 'back', deskPosition: 'front' },
      createdAt: Date.now(), updatedAt: Date.now()
    }
  };

  // --- Student names ---
  const studentNames = [
    'Aarav Sharma', 'Diya Patel', 'Vihaan Kumar', 'Ananya Singh', 'Arjun Reddy',
    'Isha Gupta', 'Reyansh Nair', 'Saanvi Joshi', 'Kabir Menon', 'Myra Verma',
    'Aditya Das', 'Priya Iyer', 'Rohan Pillai', 'Kavya Rao', 'Sai Prasad',
    'Meera Krishnan', 'Dhruv Kapoor', 'Riya Saxena', 'Arnav Bhatt', 'Nisha Thomas',
    'Vikram Choudhury', 'Pooja Desai', 'Harsh Malhotra', 'Sneha Banerjee', 'Kartik Agarwal'
  ];

  // --- Create student user records (NOT auth accounts) ---
  const users = {};
  const studentUids = [];

  // Create 25 student records
  for (let i = 0; i < 25; i++) {
    const uid = 'student_' + String(i + 1).padStart(3, '0');
    const regNum = 'REG' + String(2024001 + i);
    studentUids.push(uid);

    users[uid] = {
      name: studentNames[i],
      email: studentNames[i].split(' ')[0].toLowerCase() + (i + 1) + '@demo.examshield.in',
      role: 'student',
      registerNumber: regNum,
      classId: i < 10 ? 'CS-A' : (i < 20 ? 'CS-B' : 'CS-C'),
      active: true
    };
  }

  // Create 3 invigilator records
  const invigilatorUids = ['invig_001', 'invig_002', 'invig_003'];
  const invigilatorNames = ['Dr. Ramesh Babu', 'Prof. Sunita Devi', 'Dr. Anil Mathew'];

  users['invig_001'] = {
    name: 'Dr. Ramesh Babu', email: 'ramesh@demo.examshield.in',
    role: 'invigilator', active: true
  };
  users['invig_002'] = {
    name: 'Prof. Sunita Devi', email: 'sunita@demo.examshield.in',
    role: 'invigilator', active: true
  };
  users['invig_003'] = {
    name: 'Dr. Anil Mathew', email: 'anil@demo.examshield.in',
    role: 'invigilator', active: true
  };

  // Create admin record
  users['admin_001'] = {
    name: 'Exam Controller', email: 'admin@demo.examshield.in',
    role: 'admin', active: true
  };

  // Assign invigilators to rooms
  rooms.room_A101.invigilatorId = 'invig_001';
  rooms.room_A102.invigilatorId = 'invig_002';
  rooms.room_B101.invigilatorId = 'invig_003';

  // --- Invigilators ---
  const invigilators = {
    invig_001: {
      available: true, activeIncidentCount: 0,
      assignedRooms: { room_A101: true }
    },
    invig_002: {
      available: true, activeIncidentCount: 0,
      assignedRooms: { room_A102: true }
    },
    invig_003: {
      available: true, activeIncidentCount: 0,
      assignedRooms: { room_B101: true }
    }
  };

  // --- Assignments & QR Tokens ---
  const assignments = { exam_001: {} };
  const qrTokens = {};
  const attendance = { exam_001: {} };
  const roomSeats = {};

  // Room A-101: 10 students (seats A1-A6, B1-B4)
  const seatLabels_A101 = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      seatLabels_A101.push(String.fromCharCode(65 + r) + (c + 1));
    }
  }

  // Room A-102: 8 students
  const seatLabels_A102 = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      seatLabels_A102.push(String.fromCharCode(65 + r) + (c + 1));
    }
  }

  // Room B-101: 7 students
  const seatLabels_B101 = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      seatLabels_B101.push(String.fromCharCode(65 + r) + (c + 1));
    }
  }

  const roomAssignments = [
    { roomId: 'room_A101', seats: seatLabels_A101, count: 10, offset: 0 },
    { roomId: 'room_A102', seats: seatLabels_A102, count: 8, offset: 10 },
    { roomId: 'room_B101', seats: seatLabels_B101, count: 7, offset: 18 }
  ];

  // Initialize roomSeats
  roomSeats['room_A101'] = {};
  roomSeats['room_A102'] = {};
  roomSeats['room_B101'] = {};

  roomAssignments.forEach(ra => {
    for (let i = 0; i < ra.count; i++) {
      const studentIdx = ra.offset + i;
      if (studentIdx >= studentUids.length) break;

      const uid = studentUids[studentIdx];
      const regNum = users[uid].registerNumber;
      const seatNumber = ra.seats[i];
      const assignId = 'asgn_' + regNum;
      const token = generateDemoToken(studentIdx);

      assignments.exam_001[assignId] = {
        studentId: uid,
        registerNumber: regNum,
        roomId: ra.roomId,
        seatNumber: seatNumber,
        qrToken: token,
        status: 'active'
      };

      qrTokens[token] = {
        assignmentId: assignId,
        examId: 'exam_001',
        studentId: uid,
        roomId: ra.roomId,
        active: true
      };

      // Create room seat record
      roomSeats[ra.roomId][seatNumber] = {
        row: seatNumber.charAt(0),
        column: parseInt(seatNumber.substring(1)),
        seatNumber: seatNumber,
        assignmentId: assignId,
        studentId: uid,
        status: 'assigned'
      };
    }
  });

  // --- Mixed Attendance ---
  const attendanceStates = [
    'present', 'present', 'present', 'absent', 'present',
    'present', 'unmarked', 'present', 'present', 'absent',
    'present', 'present', 'unmarked', 'present', 'present',
    'absent', 'present', 'unmarked', 'present', 'present',
    'present', 'unmarked', 'present', 'present', 'present'
  ];

  Object.keys(assignments.exam_001).forEach((assignId, idx) => {
    const state = attendanceStates[idx] || 'unmarked';
    if (state !== 'unmarked') {
      attendance.exam_001[assignId] = {
        status: state,
        markedBy: assignments.exam_001[assignId].roomId === 'room_A101' ? 'invig_001' :
          assignments.exam_001[assignId].roomId === 'room_A102' ? 'invig_002' : 'invig_003',
        markedAt: Date.now() - Math.floor(Math.random() * 3600000),
        updatedAt: Date.now()
      };
    }
  });

  // --- Incidents ---
  const incidents = {};
  const incidentHistory = {};

  const demoIncidents = [
    {
      id: 'INC_001', studentId: 'student_004', examId: 'exam_001', roomId: 'room_A101',
      category: 'medical', description: 'Student feeling dizzy and needs medical attention',
      priority: 'critical', status: 'assigned', assignedTo: 'invig_001', assignmentType: 'automatic',
      createdAt: Date.now() - 2400000
    },
    {
      id: 'INC_002', studentId: 'student_012', examId: 'exam_001', roomId: 'room_A102',
      category: 'admit-card', description: 'Forgot admit card at hostel',
      priority: 'high', status: 'in-progress', assignedTo: 'invig_002', assignmentType: 'automatic',
      createdAt: Date.now() - 1800000
    },
    {
      id: 'INC_003', studentId: 'student_018', examId: 'exam_001', roomId: 'room_B101',
      category: 'wrong-room', description: 'Was directed to wrong room by signage',
      priority: 'high', status: 'resolved', assignedTo: 'invig_003', assignmentType: 'automatic',
      createdAt: Date.now() - 3600000
    },
    {
      id: 'INC_004', studentId: 'student_007', examId: 'exam_001', roomId: 'room_A101',
      category: 'missing-stationery', description: 'Need an extra answer sheet',
      priority: 'normal', status: 'submitted', assignedTo: '', assignmentType: '',
      createdAt: Date.now() - 600000
    },
    {
      id: 'INC_005', studentId: 'student_022', examId: 'exam_001', roomId: 'room_B101',
      category: 'wrong-seat', description: 'Another student is sitting in my assigned seat B3',
      priority: 'high', status: 'assigned', assignedTo: 'invig_003', assignmentType: 'automatic',
      createdAt: Date.now() - 900000
    }
  ];

  demoIncidents.forEach(inc => {
    incidents[inc.id] = {
      studentId: inc.studentId,
      examId: inc.examId,
      roomId: inc.roomId,
      category: inc.category,
      description: inc.description,
      priority: inc.priority,
      status: inc.status,
      assignedTo: inc.assignedTo,
      assignmentType: inc.assignmentType,
      createdAt: inc.createdAt,
      updatedAt: Date.now()
    };

    // Timeline
    incidentHistory[inc.id] = {};
    incidentHistory[inc.id]['evt_1'] = {
      action: 'Incident created',
      actorId: inc.studentId,
      actorRole: 'student',
      timestamp: inc.createdAt,
      details: 'Category: ' + inc.category
    };
    incidentHistory[inc.id]['evt_2'] = {
      action: 'Priority calculated: ' + inc.priority,
      actorId: 'system',
      actorRole: 'system',
      timestamp: inc.createdAt + 1000,
      details: 'Automatic priority assignment'
    };
    if (inc.assignedTo) {
      incidentHistory[inc.id]['evt_3'] = {
        action: 'Incident automatically assigned',
        actorId: 'system',
        actorRole: 'system',
        timestamp: inc.createdAt + 2000,
        details: 'Assigned to: ' + inc.assignedTo
      };
    }
    if (inc.status === 'in-progress') {
      incidentHistory[inc.id]['evt_4'] = {
        action: 'Work started',
        actorId: inc.assignedTo,
        actorRole: 'invigilator',
        timestamp: inc.createdAt + 300000,
        details: 'Invigilator began handling the incident'
      };
    }
    if (inc.status === 'resolved') {
      incidentHistory[inc.id]['evt_4'] = {
        action: 'Incident resolved',
        actorId: inc.assignedTo,
        actorRole: 'invigilator',
        timestamp: inc.createdAt + 1200000,
        details: 'Student redirected to correct room A-102'
      };
    }
  });

  // --- Announcements ---
  const announcements = {
    ann_001: {
      title: 'Examination Begins at 10:00 AM',
      message: 'All students must be seated 15 minutes before the examination starts. Latecomers will not be admitted after 10:15 AM.',
      targetType: 'all',
      targetId: '',
      createdAt: Date.now() - 7200000,
      expiresAt: null,
      active: true,
      createdBy: 'admin_001'
    },
    ann_002: {
      title: 'Room A-102 — Change of Invigilator',
      message: 'Prof. Sunita Devi will be the invigilator for Room A-102 instead of the previously announced faculty.',
      targetType: 'room',
      targetId: 'room_A102',
      createdAt: Date.now() - 3600000,
      expiresAt: null,
      active: true,
      createdBy: 'admin_001'
    },
    ann_003: {
      title: 'Extra Answer Sheets Available',
      message: 'Students who need additional answer sheets should raise their hand. The invigilator will provide them.',
      targetType: 'exam',
      targetId: 'exam_001',
      createdAt: Date.now() - 1800000,
      expiresAt: null,
      active: true,
      createdBy: 'admin_001'
    },
    ann_004: {
      title: 'Invigilator Briefing Note',
      message: 'Please ensure all students have placed their bags at the front of the room before the exam begins. Verify student IDs for any late arrivals.',
      targetType: 'invigilators',
      targetId: '',
      createdAt: Date.now() - 5400000,
      expiresAt: null,
      active: true,
      createdBy: 'admin_001'
    }
  };

  // --- Room Checklists ---
  const roomChecklists = {
    room_A101: {
      invigilator: { completed: true, updatedBy: 'admin_001', updatedAt: Date.now() - 7200000 },
      seating: { completed: true, updatedBy: 'invig_001', updatedAt: Date.now() - 6000000 },
      attendance: { completed: true, updatedBy: 'invig_001', updatedAt: Date.now() - 5400000 },
      materials: { completed: true, updatedBy: 'invig_001', updatedAt: Date.now() - 4800000 },
      inspection: { completed: true, updatedBy: 'invig_001', updatedAt: Date.now() - 4200000 },
      qr: { completed: true, updatedBy: 'admin_001', updatedAt: Date.now() - 3600000 },
      emergency: { completed: false, updatedBy: '', updatedAt: 0 }
    },
    room_A102: {
      invigilator: { completed: true, updatedBy: 'admin_001', updatedAt: Date.now() - 7200000 },
      seating: { completed: true, updatedBy: 'invig_002', updatedAt: Date.now() - 6000000 },
      attendance: { completed: true, updatedBy: 'invig_002', updatedAt: Date.now() - 5400000 },
      materials: { completed: false, updatedBy: '', updatedAt: 0 },
      inspection: { completed: false, updatedBy: '', updatedAt: 0 },
      qr: { completed: true, updatedBy: 'admin_001', updatedAt: Date.now() - 3600000 },
      emergency: { completed: false, updatedBy: '', updatedAt: 0 }
    },
    room_B101: {
      invigilator: { completed: true, updatedBy: 'admin_001', updatedAt: Date.now() - 7200000 },
      seating: { completed: false, updatedBy: '', updatedAt: 0 },
      attendance: { completed: false, updatedBy: '', updatedAt: 0 },
      materials: { completed: false, updatedBy: '', updatedAt: 0 },
      inspection: { completed: false, updatedBy: '', updatedAt: 0 },
      qr: { completed: false, updatedBy: '', updatedAt: 0 },
      emergency: { completed: false, updatedBy: '', updatedAt: 0 }
    }
  };

  // --- Write everything to Firebase ---
  const updates = {};
  updates[base + '/settings'] = settingsData;
  updates[base + '/buildings'] = buildings;
  updates[base + '/floors'] = floors;
  updates[base + '/exams'] = exams;
  updates[base + '/rooms'] = rooms;
  updates[base + '/invigilators'] = invigilators;
  updates[base + '/announcements'] = announcements;
  updates[base + '/roomChecklists'] = roomChecklists;
  updates[base + '/roomSeats'] = roomSeats;

  // Users
  Object.entries(users).forEach(([uid, data]) => {
    updates[base + '/users/' + uid] = data;
  });

  // Assignments
  updates[base + '/assignments'] = assignments;

  // QR Tokens
  updates[base + '/qrTokens'] = qrTokens;

  // Attendance
  updates[base + '/attendance'] = attendance;

  // Incidents
  updates[base + '/incidents'] = incidents;
  updates[base + '/incidentHistory'] = incidentHistory;

  try {
    await db.ref().update(updates);
    console.log('[Demo] ✓ Demo data loaded successfully!');
    console.log('[Demo] Summary:');
    console.log('  - 1 examination');
    console.log('  - 3 rooms (A-101, A-102, B-101)');
    console.log('  - 2 buildings');
    console.log('  - 25 students');
    console.log('  - 3 invigilators');
    console.log('  - 25 seat assignments');
    console.log('  - Mixed attendance states');
    console.log('  - 5 demo incidents');
    console.log('  - 4 announcements');
    console.log('  - Room readiness checklists');
    console.log('');
    console.log('[Demo] IMPORTANT: To test the app, create Firebase Auth accounts');
    console.log('  and set their UIDs to match the demo user IDs (student_001, invig_001, admin_001)');
    console.log('  OR update the users/ records to match the UIDs of your created Auth accounts.');
    alert('Demo data loaded successfully! See console for details.');
  } catch (err) {
    console.error('[Demo] Failed to load demo data:', err);
    alert('Failed to load demo data: ' + err.message);
  }
}

function generateDemoToken(index) {
  // Generate deterministic tokens for demo (in production, use generateQRToken())
  const base = 'demo_qr_token_';
  const chars = '0123456789abcdef';
  let suffix = '';
  for (let i = 0; i < 32; i++) {
    suffix += chars.charAt((index * 7 + i * 13) % chars.length);
  }
  return base + suffix;
}

// Auto-expose for console usage
window.loadDemoData = loadDemoData;
console.log('[ExamShield] Demo data script loaded. Call loadDemoData() to populate database.');
