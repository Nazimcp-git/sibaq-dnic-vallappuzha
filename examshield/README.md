# ExamShield

**One Examination. One Command Center.**

ExamShield is a real-time, mobile-first examination-day emergency operating system. It provides a single platform to coordinate seat assignments, QR verification, attendance, emergency incidents, announcements, and room readiness across all examination rooms.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Smart Seat Finder | Students find their exam room, building, block, and seat instantly |
| 2 | Digital QR Exam Pass | Unique QR pass for every student-exam assignment |
| 3 | QR Student Verification | Invigilators scan QR codes to verify identity and room assignment |
| 4 | Live Attendance | Real-time attendance marking with audit trail |
| 5 | Emergency Help Desk | Students submit incident reports by category |
| 6 | Smart Priority Engine | Deterministic priority calculation (Critical/High/Normal) |
| 7 | Automatic Invigilator Assignment | Rule-based incident assignment to available invigilators |
| 8 | Live Incident Dashboard | Real-time incident monitoring and management |
| 9 | Incident Timeline | Complete chronological history for every incident |
| 10 | Instant Announcements | Targeted announcements to students, rooms, or invigilators |
| 11 | Seat Occupancy Map | Interactive visual room seat layout |
| 12 | Room Readiness Score | Checklist-based readiness monitoring |
| 13 | Room Control Center | Interactive floor plan and room intelligence |
| 14 | CSV Bulk Import | Import students, assignments, and rooms via CSV/XLSX |
| 15 | WhatsApp Communication | Click-to-chat WhatsApp integration for announcements |
| 16 | Offline Support | Service Worker, caching, and offline sync queue |
| 17 | PWA Installation | Installable as a Progressive Web App |

---

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **CSS:** Custom design system + Tailwind CSS (CDN)
- **Backend:** Firebase Realtime Database, Firebase Authentication
- **Firebase SDK:** v8.10.0 (namespaced API, CDN)
- **Icons:** Lucide Icons
- **QR Generation:** QRCode.js
- **QR Scanning:** html5-qrcode
- **Spreadsheets:** SheetJS (XLSX)
- **No build process required** — deploy as static files

---

## Quick Start

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Realtime Database** → Create database → Start in **test mode** (temporarily)

### 2. Configure Firebase

Open `js/firebase.js` and replace the placeholder config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Provision Accounts & Demo Data (1-Click Automated Setup)

You can provision all test accounts (Admin, Invigilators, Students) automatically using the built-in **Provisioning Portal**:

1. Open `setup.html` in your browser (or click *"Account Provisioning & Demo Setup"* from the login page).
2. Click **"Provision All Demo Accounts"** — this automatically creates the Firebase Authentication accounts and sets their database roles.
3. Click **"Seed Examination Database"** — this seeds the examination schedule, rooms, seat allocations, and emergency incident tickets.
4. Return to `index.html` and sign in with any of the accounts below:

| Role | Email | Password | Privileges |
|------|-------|----------|------------|
| **Admin** | `admin@demo.examshield.in` | `demo123456` | Full command center, rooms, allocations, CSV import, WhatsApp |
| **Invigilator** | `ramesh@demo.examshield.in` | `demo123456` | Room A-101 verification scanner, live roll, seat map, readiness |
| **Invigilator** | `sunita@demo.examshield.in` | `demo123456` | Room A-102 supervision |
| **Invigilator** | `anil@demo.examshield.in` | `demo123456` | Room B-101 supervision |
| **Student** | `aarav1@demo.examshield.in` | `demo123456` | Desk locator (Room A-101, Seat A1), QR pass, Help Desk |
| **Student** | `diya2@demo.examshield.in` | `demo123456` | Desk locator (Room A-101, Seat A2), QR pass |

You can also use `setup.html` at any time to create custom administrator, invigilator, or student accounts with custom email addresses, passwords, register numbers, and room assignments.
4. Add the demo data script: include `data/demo-data.js` in `index.html` or paste the script
5. Run: `loadDemoData()`

This loads:
- 1 examination
- 3 rooms (A-101, A-102, B-101)
- 25 students with seat assignments
- 3 invigilators
- Mixed attendance states
- 5 demo incidents
- 4 announcements
- Room readiness checklists

### 6. Deploy Security Rules

Copy `database.rules.json` to your Firebase project:

1. Firebase Console → Realtime Database → Rules
2. Paste the contents of `database.rules.json`
3. Click Publish

### 7. Serve the Application

For local development:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000/`

For production, deploy to Firebase Hosting:

```bash
firebase init hosting
firebase deploy
```

> **Note:** PWA installation requires HTTPS. Use Firebase Hosting or another HTTPS-enabled host for production.

---

## User Roles

### Student
- View exam assignment and seat
- Download QR exam pass
- Submit emergency reports
- Track incident status
- View announcements and attendance

### Invigilator
- View assigned rooms and students
- Scan QR codes for verification
- Mark attendance
- Handle assigned incidents
- Update room readiness

### Administrator
- Create and manage exams, rooms, students
- Monitor all incidents in real time
- Manage attendance across rooms
- Publish targeted announcements
- Import data via CSV
- Room Control Center with floor plan
- Generate exam reports

---

## Project Structure

```
examshield/
├── index.html              Main SPA shell
├── setup.html              Account provisioning & 1-click test seeder
├── register.html           Invigilator/Candidate invitation onboarding
├── manifest.json           PWA manifest
├── sw.js                   Service worker
├── offline.html            Offline fallback
├── database.rules.json     Firebase security rules
├── assets/
│   ├── icons/              PWA icons
│   └── images/             Static images
├── css/
│   └── styles.css          Design system
├── js/
│   ├── icons.js            Built-in Lucide vector icon engine
│   ├── firebase.js         Firebase initialization
│   ├── database.js         Database helpers & engines
│   ├── auth.js             Authentication
│   ├── router.js           SPA routing & navigation
│   ├── student.js          Student module (Seat Finder, QR Pass, Profile)
│   ├── invigilator.js      Invigilator module (Scanner, Roll, Seat Map)
│   ├── admin.js            Admin module (Students CRUD, Invigilators, Rooms)
│   ├── incidents.js        Shared incident helpers & triage
│   ├── attendance.js       Attendance helpers
│   ├── qr.js               QR generation & scanning
│   ├── announcements.js    Announcement & Notification Center helpers
│   ├── csv-import.js       CSV/XLSX import
│   ├── whatsapp.js         WhatsApp click-to-chat
│   └── offline.js          Offline support & sync
├── data/
│   └── demo-data.js        Demo data loader
└── README.md
```

---

## Firebase Database Structure

```
examshield/
├── users/{uid}              User profiles and roles
├── exams/{examId}           Examination records
├── rooms/{roomId}           Room configuration
├── buildings/{buildingId}   Building data
├── floors/{floorId}         Floor data
├── assignments/{examId}/{id} Student-exam seat assignments
├── attendance/{examId}/{id}  Attendance records
├── incidents/{incidentId}   Emergency incidents
├── incidentHistory/{id}/{eventId} Incident timeline
├── announcements/{id}       Announcements
├── qrTokens/{token}         QR token verification
├── invigilators/{uid}       Invigilator availability
├── roomChecklists/{roomId}  Room readiness checklists
├── roomSeats/{roomId}/{seatId} Seat assignment data
├── importLogs/{importId}    CSV import logs
└── settings/                System configuration
```

---

## Security Notes

- **Never deploy with open database rules** (`".read": true, ".write": true`)
- User roles are stored server-side in Firebase and cannot be changed by clients
- QR tokens are opaque random strings — no personal data encoded
- WhatsApp integration uses click-to-chat only — no API tokens exposed
- Admin role cannot be self-assigned through registration
- All sensitive operations validated through Firebase Security Rules

---

## CSV Templates

Download CSV templates from the admin CSV Import page. Sample columns:

**Students:** `name, email, registerNumber, classId`
**Assignments:** `registerNumber, examId, roomId, seatNumber`
**Rooms:** `name, building, block, rows, columns, capacity`

---

## Offline Support

ExamShield works offline for:
- Viewing previously loaded exam information
- Viewing cached announcements
- Submitting emergency reports (queued for sync)
- Viewing cached seat assignments

When connectivity returns, queued submissions sync automatically.

---

## WhatsApp Integration

ExamShield uses WhatsApp's supported click-to-chat URLs (`wa.me`). When administrators click "Send via WhatsApp":

1. A WhatsApp conversation opens with the pre-filled message
2. The administrator reviews and sends manually
3. The app logs the attempt as "Opened in WhatsApp"

**No automatic delivery.** No API tokens exposed. No backend required.

---

## Browser Compatibility

- Chrome 80+ (Android, Desktop)
- Safari 14+ (iOS)
- Firefox 80+
- Edge 80+

PWA installation supported on Chrome (Android/Desktop) and Edge.

---

## License

Built for the DNIC Vallappuzha buildathon competition.
