// ExamShield — Interactive Campus Map Engine
// Provides high-fidelity architectural campus spatial visualization, room wayfinding, and live operational status overlays.

const CampusMap = {
  // Static Campus Spatial Layout Specifications
  CAMPUS_SPECS: {
    width: 860,
    height: 560,
    buildings: [
      {
        id: 'bldg_A',
        name: 'Academic Block A',
        block: 'A',
        description: 'Main Academic Wing (3 Floors) · Venues A-101, A-102',
        x: 520,
        y: 120,
        width: 290,
        height: 280,
        color: '#f8fafc',
        borderColor: '#cbd5e1',
        rooms: [
          {
            id: 'room_A101',
            name: 'A-101',
            label: 'Room A-101',
            x: 540,
            y: 150,
            width: 120,
            height: 105,
            door: { x: 540, y: 200, side: 'left' },
            floor: 'Ground Floor (Level 1)',
            directions: 'Enter via Main South Gate -> Follow Central Walkway North (45m) -> Turn Right into Academic Block A -> Room A-101 is the first venue on your left.'
          },
          {
            id: 'room_A102',
            name: 'A-102',
            label: 'Room A-102',
            x: 675,
            y: 150,
            width: 115,
            height: 105,
            door: { x: 675, y: 200, side: 'left' },
            floor: 'Ground Floor (Level 1)',
            directions: 'Enter via Main South Gate -> Follow Central Walkway North (45m) -> Turn Right into Academic Block A -> Pass Room A-101 -> Room A-102 is adjacent.'
          },
          {
            id: 'faculty_station_A',
            name: 'Invigilator Post A',
            label: 'Faculty Post A',
            x: 540,
            y: 280,
            width: 250,
            height: 85,
            isFacility: true,
            facilityType: 'staff',
            floor: 'Ground Floor',
            directions: 'Located at the west foyer of Academic Block A.'
          }
        ]
      },
      {
        id: 'bldg_B',
        name: 'Academic Block B',
        block: 'B',
        description: 'Science & Humanities Wing (2 Floors) · Venue B-101',
        x: 50,
        y: 120,
        width: 290,
        height: 280,
        color: '#f8fafc',
        borderColor: '#cbd5e1',
        rooms: [
          {
            id: 'room_B101',
            name: 'B-101',
            label: 'Room B-101',
            x: 70,
            y: 150,
            width: 140,
            height: 120,
            door: { x: 210, y: 210, side: 'right' },
            floor: 'Ground Floor (Level 1)',
            directions: 'Enter via Main South Gate -> Follow Central Walkway North (45m) -> Turn Left into Academic Block B -> Room B-101 is situated immediately on the right wing.'
          },
          {
            id: 'faculty_station_B',
            name: 'Invigilator Post B',
            label: 'Faculty Post B',
            x: 70,
            y: 295,
            width: 250,
            height: 75,
            isFacility: true,
            facilityType: 'staff',
            floor: 'Ground Floor',
            directions: 'Ground floor briefing hub for Block B invigilators.'
          }
        ]
      },
      {
        id: 'bldg_ops',
        name: 'Exam Command & Medical Complex',
        block: 'HQ',
        description: 'Controller of Examinations & Campus Emergency First Aid Post',
        x: 280,
        y: 25,
        width: 300,
        height: 100,
        color: '#f1f5f9',
        borderColor: '#94a3b8',
        rooms: [
          {
            id: 'ctrl_room',
            name: 'Exam Command Center',
            label: 'HQ Controller',
            x: 295,
            y: 40,
            width: 155,
            height: 70,
            isFacility: true,
            facilityType: 'control',
            floor: 'Central Operations Hub',
            directions: 'North wing of Central Quadrangle. Confidential paper distribution and Chief Superintendent office.'
          },
          {
            id: 'medical_room',
            name: 'Medical Emergency Station',
            label: 'First Aid Post',
            x: 465,
            y: 40,
            width: 100,
            height: 70,
            isFacility: true,
            facilityType: 'medical',
            floor: 'Ground Floor (Direct Ambulance Access)',
            directions: 'Equipped with medical supplies, oxygen, first responder stretcher, and campus nurse on standby.'
          }
        ]
      }
    ],
    gate: {
      x: 430,
      y: 520,
      width: 140,
      height: 35,
      label: 'Main South Entrance & Security Gate'
    }
  },

  // Render an interactive SVG map into a container
  async render(target, options = {}) {
    const container = typeof target === 'string' ? document.getElementById(target) : target;
    if (!container) return;

    const highlightRoomId = options.highlightRoomId || null;
    const canInspect = options.canInspect !== false; // Admin can inspect, students view info

    // Fetch dynamic live states
    const allRooms = await Database.getList(DB.rooms());
    const allIncidents = await Database.getList(DB.incidents());
    const activeIncidents = allIncidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
    const users = await Database.getList(DB.users());
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const roomDataMap = new Map();
    allRooms.forEach(rm => roomDataMap.set(rm.id, rm));

    // Determine initial route path coordinates if highlightRoomId is set
    let activeHighlightRoom = null;
    this.CAMPUS_SPECS.buildings.forEach(b => {
      b.rooms.forEach(r => {
        if (r.id === highlightRoomId) {
          activeHighlightRoom = { ...r, building: b.name };
        }
      });
    });

    const html = `
      <div class="campus-map-wrapper">
        <!-- Campus Controls & Legend Bar -->
        <div class="campus-controls-bar">
          <div class="campus-filter-group" id="campus-filter-chips">
            <button class="filter-chip active" data-filter="all">All Campus Zones</button>
            <button class="filter-chip" data-filter="bldg_A">Block A (East)</button>
            <button class="filter-chip" data-filter="bldg_B">Block B (West)</button>
            <button class="filter-chip" data-filter="bldg_ops">Control & Medical</button>
          </div>

          <div class="campus-legend">
            <span class="legend-pill"><span class="legend-dot status-ready"></span> Ready</span>
            <span class="legend-pill"><span class="legend-dot status-prep"></span> Preparing</span>
            <span class="legend-pill"><span class="legend-dot status-alert"></span> Alert Active</span>
            <span class="legend-pill"><span class="legend-dot status-medical"></span> Medical Post</span>
            ${highlightRoomId ? '<span class="legend-pill font-bold" style="color:var(--color-green-700);"><span class="legend-dot status-beacon"></span> Your Room</span>' : ''}
          </div>
        </div>

        <!-- SVG Map Container -->
        <div class="campus-svg-container" id="campus-svg-box">
          ${this.generateSVG(roomDataMap, activeIncidents, userMap, highlightRoomId)}
        </div>

        <!-- Room Information & Wayfinding Bottom Sheet -->
        <div class="campus-info-drawer" id="campus-info-drawer">
          ${this.generateDrawerContent(activeHighlightRoom, roomDataMap.get(highlightRoomId), activeIncidents, userMap, canInspect)}
        </div>
      </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ nodes: [container] });

    // Setup interactive SVG handlers
    this.attachInteractions(container, roomDataMap, activeIncidents, userMap, canInspect);
  },

  // Generate SVG Graphic
  generateSVG(roomDataMap, activeIncidents, userMap, highlightRoomId) {
    const specs = this.CAMPUS_SPECS;
    const { width, height, buildings, gate } = specs;

    let svgRooms = '';
    let walkingPath = '';

    buildings.forEach(bldg => {
      // Building Footprint
      svgRooms += `
        <g class="campus-bldg-group" data-bldg="${bldg.id}">
          <rect x="${bldg.x}" y="${bldg.y}" width="${bldg.width}" height="${bldg.height}" rx="8" ry="8" 
                fill="${bldg.color}" stroke="${bldg.borderColor}" stroke-width="2" class="bldg-rect"/>
          <text x="${bldg.x + 16}" y="${bldg.y + 24}" class="bldg-title">${UI.escapeHtml(bldg.name)}</text>
          <text x="${bldg.x + 16}" y="${bldg.y + 40}" class="bldg-sub">${UI.escapeHtml(bldg.description)}</text>
      `;

      // Rooms inside building
      bldg.rooms.forEach(rm => {
        const isHighlighted = rm.id === highlightRoomId;
        const liveRoom = roomDataMap.get(rm.id);
        const roomIncidents = activeIncidents.filter(i => i.roomId === rm.id);
        const hasAlert = roomIncidents.length > 0;
        const status = liveRoom ? (liveRoom.status || 'ready') : 'ready';

        let fill = '#ffffff';
        let stroke = '#94a3b8';
        let statusBadgeColor = '#22c55e'; // green

        if (rm.isFacility) {
          if (rm.facilityType === 'medical') {
            fill = '#fef2f2';
            stroke = '#f87171';
            statusBadgeColor = '#ef4444';
          } else if (rm.facilityType === 'control') {
            fill = '#eff6ff';
            stroke = '#60a5fa';
            statusBadgeColor = '#3b82f6';
          } else {
            fill = '#f8fafc';
            stroke = '#cbd5e1';
            statusBadgeColor = '#64748b';
          }
        } else {
          if (hasAlert) {
            fill = '#fef2f2';
            stroke = '#ef4444';
            statusBadgeColor = '#dc2626';
          } else if (status === 'not-ready') {
            fill = '#f8fafc';
            stroke = '#cbd5e1';
            statusBadgeColor = '#94a3b8';
          } else if (status === 'preparing') {
            fill = '#fffbeb';
            stroke = '#f59e0b';
            statusBadgeColor = '#f59e0b';
          } else {
            fill = '#ffffff';
            stroke = '#86efac';
            statusBadgeColor = '#16a34a';
          }
        }

        if (isHighlighted) {
          fill = '#f0fdf4';
          stroke = '#16a34a';
        }

        // Room Box
        svgRooms += `
          <g class="campus-room-pin ${isHighlighted ? 'is-highlighted' : ''}" data-room-id="${rm.id}" style="cursor:pointer;">
            <rect x="${rm.x}" y="${rm.y}" width="${rm.width}" height="${rm.height}" rx="6" ry="6"
                  fill="${fill}" stroke="${stroke}" stroke-width="${isHighlighted ? 3 : 1.5}" 
                  class="room-rect ${isHighlighted ? 'beacon-pulse-border' : ''}"/>
            
            <!-- Status Dot indicator -->
            <circle cx="${rm.x + rm.width - 12}" cy="${rm.y + 12}" r="5" fill="${statusBadgeColor}" class="${hasAlert ? 'pulse-alert-dot' : ''}"/>

            <!-- Room Labels -->
            <text x="${rm.x + 12}" y="${rm.y + 26}" class="room-pin-name ${isHighlighted ? 'font-bold' : ''}">${UI.escapeHtml(rm.label)}</text>
            <text x="${rm.x + 12}" y="${rm.y + 44}" class="room-pin-info">
              ${liveRoom ? `${liveRoom.capacity || 30} Seats` : (rm.floor || 'Venue')}
            </text>

            ${hasAlert ? `
              <g transform="translate(${rm.x + 10}, ${rm.y + rm.height - 24})">
                <rect width="64" height="16" rx="4" fill="#fee2e2"/>
                <text x="32" y="12" text-anchor="middle" font-size="9" fill="#dc2626" font-weight="700">ALERT (${roomIncidents.length})</text>
              </g>
            ` : ''}

            ${isHighlighted ? `
              <g transform="translate(${rm.x + 10}, ${rm.y + rm.height - 24})">
                <rect width="90" height="16" rx="4" fill="#16a34a"/>
                <text x="45" y="12" text-anchor="middle" font-size="9" fill="#ffffff" font-weight="700">YOUR ROOM</text>
              </g>
            ` : ''}
          </g>
        `;

        // If highlighted, calculate walking path from gate to this room
        if (isHighlighted) {
          const doorX = rm.door ? rm.door.x : (rm.x + rm.width / 2);
          const doorY = rm.door ? rm.door.y : (rm.y + rm.height);
          walkingPath = `
            <!-- Walking Navigation Trail -->
            <path d="M 430 520 L 430 350 L ${doorX} 350 L ${doorX} ${doorY}" 
                  fill="none" stroke="#16a34a" stroke-width="4" stroke-dasharray="8 6" 
                  class="walking-nav-route" stroke-linecap="round"/>
            <circle cx="430" cy="520" r="7" fill="#16a34a"/>
            <circle cx="${doorX}" cy="${doorY}" r="6" fill="#16a34a" class="pulse-alert-dot"/>
          `;
        }
      });

      svgRooms += `</g>`;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" class="campus-svg-canvas" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="campus-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" stroke-width="1"/>
          </pattern>
          <filter id="shadow-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.06"/>
          </filter>
        </defs>

        <!-- Base Background -->
        <rect width="${width}" height="${height}" fill="#fcfdfd"/>
        <rect width="${width}" height="${height}" fill="url(#campus-grid)"/>

        <!-- Architectural Walkways & Corridors -->
        <!-- Central Walkway Boulevard -->
        <rect x="390" y="80" width="80" height="450" fill="#f1f5f9" rx="10"/>
        <!-- East Corridor to Block A -->
        <rect x="440" y="320" width="100" height="50" fill="#f1f5f9" rx="6"/>
        <!-- West Corridor to Block B -->
        <rect x="320" y="320" width="100" height="50" fill="#f1f5f9" rx="6"/>
        <!-- Central Plaza Square -->
        <circle cx="430" cy="345" r="45" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>
        <text x="430" y="348" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">Central Plaza</text>

        <!-- Campus Tree & Greenery Accents -->
        <circle cx="360" cy="460" r="16" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1.5"/>
        <circle cx="500" cy="460" r="16" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1.5"/>
        <circle cx="360" cy="220" r="16" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1.5"/>
        <circle cx="500" cy="220" r="16" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1.5"/>

        <!-- Walking Navigation Trail (if room selected) -->
        ${walkingPath}

        <!-- Buildings and Rooms Layers -->
        ${svgRooms}

        <!-- Main South Gate Entrance -->
        <g class="campus-gate" transform="translate(360, 500)">
          <rect width="140" height="40" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
          <text x="70" y="24" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">MAIN ENTRANCE GATE</text>
        </g>
      </svg>
    `;
  },

  // Generate Drawer Content based on selected room
  generateDrawerContent(roomSpec, liveRoom, activeIncidents, userMap, canInspect) {
    if (!roomSpec) {
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="font-bold text-sm">Interactive Campus Directory</div>
            <div class="text-xs text-muted">Tap any examination room or faculty station on the map to view live specifications & navigation route.</div>
          </div>
          <span class="badge badge-normal text-xs">All Buildings Connected</span>
        </div>
      `;
    }

    const roomId = roomSpec.id;
    const roomIncidents = activeIncidents.filter(i => i.roomId === roomId);
    const invigName = liveRoom && liveRoom.invigilatorId ? (userMap.get(liveRoom.invigilatorId) || 'Faculty Assigned') : 'Unassigned';

    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);">
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <h3 class="font-bold text-base">${UI.escapeHtml(roomSpec.label || roomSpec.name)}</h3>
            ${liveRoom ? UI.statusBadge(roomIncidents.length > 0 ? 'assistance' : (liveRoom.status || 'ready')) : '<span class="badge badge-normal">Facility</span>'}
          </div>
          <div class="text-xs text-muted mt-1">
            ${UI.escapeHtml(roomSpec.building || 'Campus Complex')} · ${UI.escapeHtml(roomSpec.floor || 'Level 1')}
            ${liveRoom ? ` · <span class="mono font-semibold">${liveRoom.capacity} Desks</span>` : ''}
          </div>

          <!-- Step-by-Step Wayfinding -->
          <div style="margin-top:var(--space-2);background:var(--color-off-white);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);font-size:var(--text-xs);border-left:3px solid var(--color-green-600);">
            <strong>Walking Route:</strong> ${UI.escapeHtml(roomSpec.directions || 'Direct pedestrian access via campus central plaza.')}
          </div>
        </div>

        <div style="display:flex;gap:var(--space-2);align-items:center;">
          ${canInspect && liveRoom && typeof AdminModule !== 'undefined' ? `
            <button class="btn btn-primary btn-sm" onclick="AdminModule.openRoomInspectorModal('${roomId}')">
              <i data-lucide="eye"></i> Inspect Room Control & Roll
            </button>
          ` : ''}
          ${liveRoom ? `
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('student/seat-finder')">
              <i data-lucide="map-pin"></i> Seat Finder
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Attach Event Listeners to Map
  attachInteractions(container, roomDataMap, activeIncidents, userMap, canInspect) {
    const svg = container.querySelector('.campus-svg-canvas');
    const drawer = container.querySelector('#campus-info-drawer');

    // Click on Room Pins
    container.querySelectorAll('.campus-room-pin').forEach(pin => {
      pin.onclick = (e) => {
        const roomId = pin.dataset.roomId;
        let foundSpec = null;

        CampusMap.CAMPUS_SPECS.buildings.forEach(b => {
          b.rooms.forEach(r => {
            if (r.id === roomId) foundSpec = { ...r, building: b.name };
          });
        });

        if (foundSpec) {
          // Re-render map highlighting this room
          CampusMap.render(container, { highlightRoomId: roomId, canInspect });
        }
      };
    });

    // Filter Chips
    container.querySelectorAll('#campus-filter-chips .filter-chip').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('#campus-filter-chips .filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        container.querySelectorAll('.campus-bldg-group').forEach(group => {
          if (filter === 'all' || group.dataset.bldg === filter) {
            group.style.display = '';
          } else {
            group.style.display = 'none';
          }
        });
      };
    });
  },

  // Helper: Open Campus Map as a Fullscreen Modal from any view
  async openModal(highlightRoomId = null) {
    const modalContent = `
      <div id="modal-campus-map-container" style="min-height:480px;">
        <div class="text-xs text-muted">Rendering architectural campus map...</div>
      </div>
    `;

    UI.showModal('Campus Map & Examination Wayfinding', modalContent);

    const container = document.getElementById('modal-campus-map-container');
    if (container) {
      await CampusMap.render(container, {
        highlightRoomId,
        canInspect: Auth.getRole() === 'admin'
      });
    }
  }
};
