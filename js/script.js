// ==================== FIREBASE CONFIG ====================
// 1. Go to https://console.firebase.google.com/
// 2. Create a project → enable Realtime Database → set rules to {".read": true, ".write": true}
// 3. Copy your Firebase config from Project Settings → General → SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBvxg7eU7zh7MNx5AdJfeXzS7ASWj6fp_8",
    authDomain: "lrcess.firebaseapp.com",
    databaseURL: "https://lrcess-default-rtdb.firebaseio.com",
    projectId: "lrcess",
    storageBucket: "lrcess.firebasestorage.app",
    messagingSenderId: "941119849615",
    appId: "1:941119849615:web:4991d10b23663fa5d6dcfa"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let editingEventId = null;
let isAdmin = true;
let allEventsData = [];

document.addEventListener('DOMContentLoaded', async function() {
    isAdmin = true;
    await loadAllEventsForMonth(currentMonth, currentYear);
    generateCalendar(currentMonth, currentYear);
    attachCalendarListeners();
    attachViewToggleListeners();
});

// ==================== STORAGE LAYER ====================
function normalizeEvents(snapshot) {
    const raw = snapshot.val() || {};
    return Object.keys(raw).map(key => ({
        id: raw[key].id || key,
        event_name: raw[key].event_name || '',
        department: raw[key].department || '',
        venue: raw[key].venue || '',
        event_time: raw[key].event_time || '',
        equipment: raw[key].equipment || '',
        reservation_date: raw[key].reservation_date || '',
        status: raw[key].status || 'active',
        created_by: raw[key].created_by || 'firebase'
    }));
}

function getLocalEvents() {
    return database.ref('events').once('value').then(snapshot => normalizeEvents(snapshot));
}

function setLocalEvents(events) {
    const updates = {};
    events.forEach(ev => {
        if (!ev.id) ev.id = createEventId();
        updates[ev.id] = ev;
    });
    return database.ref('events').set(updates);
}

function createEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadAllEventsForMonth(month, year) {
    const events = await getLocalEvents();
    allEventsData = events;
}

function generateCalendar(month, year) {
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthYearTitle = document.querySelector('.calendar-title');
    
    if (!calendarGrid || !monthYearTitle) return;
    
    monthYearTitle.textContent = new Date(year, month).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
    });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let calendarHTML = '';
    
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += `<div class="calendar-day other-month"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        
        calendarHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-events"></div>
                <div class="event-count"></div>
            </div>
        `;
    }
    
    calendarGrid.innerHTML = calendarHTML;
    loadEventsForMonth(month, year);
    attachCalendarListeners();
}

async function loadEventsForMonth(month, year) {
    const events = await getLocalEvents();
    const filtered = events.filter(e => {
        const d = new Date(e.reservation_date);
        return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
    
    document.querySelectorAll('.calendar-events').forEach(el => el.innerHTML = '');
    document.querySelectorAll('.event-count').forEach(el => el.innerHTML = '');
    
    const eventsByDate = {};
    filtered.forEach(event => {
        if (!eventsByDate[event.reservation_date]) {
            eventsByDate[event.reservation_date] = [];
        }
        eventsByDate[event.reservation_date].push(event);
    });
    
    Object.keys(eventsByDate).forEach(dateStr => {
        const container = document.querySelector(`[data-date="${dateStr}"] .calendar-events`);
        const countEl = document.querySelector(`[data-date="${dateStr}"] .event-count`);
        
        if (container) {
            eventsByDate[dateStr].slice(0, 3).forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event-item';
                eventDiv.textContent = event.event_name.substring(0, 12) + (event.event_name.length > 12 ? '...' : '');
                eventDiv.title = event.event_name + ' (' + formatTimeRange(event.event_time) + ') - ' + (event.status || 'active').toUpperCase();
                const statusColors = { active: '#2e7d32', done: '#1565C0', cancelled: '#c62828' };
                eventDiv.style.background = statusColors[event.status] || statusColors.active;
                container.appendChild(eventDiv);
            });
            
            if (eventsByDate[dateStr].length > 3) {
                const moreDiv = document.createElement('div');
                moreDiv.className = 'event-item';
                moreDiv.textContent = `+${eventsByDate[dateStr].length - 3} more`;
                moreDiv.style.background = '#ff9800';
                moreDiv.style.color = 'white';
                container.appendChild(moreDiv);
            }
        }
        
        if (countEl) {
            const count = eventsByDate[dateStr].length;
            countEl.textContent = count + (count === 1 ? ' event' : ' events');
            countEl.style.color = count >= 5 ? '#dc3545' : '#28a745';
        }
    });
}

function attachCalendarListeners() {
    document.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
        day.style.cursor = 'pointer';
        day.onclick = function() {
            selectedDate = this.dataset.date;
            showEventModal(selectedDate);
        };
    });
    
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) prevBtn.onclick = () => navigateMonth(-1);
    if (nextBtn) nextBtn.onclick = () => navigateMonth(1);
}

function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    generateCalendar(currentMonth, currentYear);
}

async function showEventModal(date) {
    selectedDate = date;
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = '';
    
    modalBody.innerHTML = '<div style="text-align:center;padding:40px;color:#666;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><br>Loading events...</div>';
    modal.style.display = 'block';
    
    const events = (await getLocalEvents()).filter(e => e.reservation_date === date)
        .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
    
    let content = '<div class="event-list">';
    
    if (events.length === 0) {
        content += '<p style="text-align:center;color:#666;padding:40px 20px;font-size:18px;">No events scheduled<br><small></small></p>';
    } else {
        const statusColors = { active: '#28a745', done: '#2196F3', cancelled: '#dc3545' };
        const statusLabels = { active: 'Active', done: 'Done', cancelled: 'Cancelled' };
        events.forEach(event => {
            const badgeColor = statusColors[event.status] || statusColors.active;
            const badgeText = statusLabels[event.status] || 'Active';
            content += `
                <div class="event-card" style="position:relative;">
                    <span style="position:absolute;bottom:10px;right:10px;background:${badgeColor};color:white;padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-transform:uppercase;z-index:1;">${badgeText}</span>
                    <div style="display:flex;justify-content:space-between;align-items:start;">
                        <div style="flex:1;">
                            <h4 style="margin:0 0 10px 0;color:#2c3e50;">${escapeHtml(event.event_name)}</h4>
                            <div style="font-size:14px;color:#666;line-height:1.6;">
                                <div><i class="fas fa-building" style="color:#667eea;"></i> ${escapeHtml(event.department)}</div>
                                <div><i class="fas fa-map-marker-alt" style="color:#667eea;"></i> ${escapeHtml(event.venue)}</div>
                                <div><i class="fas fa-clock" style="color:#667eea;"></i> ${formatTimeRange(event.event_time)}</div>
                                ${event.equipment ? `<div><i class="fas fa-tools" style="color:#667eea;"></i> ${escapeHtml(event.equipment)}</div>` : ''}
                            </div>
                        </div>
                        <div style="margin-left:10px;white-space:nowrap;">
                            <button class="btn btn-primary" onclick="editEvent('${event.id}')" title="Edit">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-danger" onclick="deleteEvent('${event.id}', '${event.reservation_date}', this)" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    content += '</div>';
    
    content += `
        <div style="text-align:center;margin-top:25px;padding-top:25px;border-top:2px solid #eee;">
            <button class="btn btn-primary" onclick="showAddEventModal()" style="font-size:18px;padding:15px 30px;">
                <i class="fas fa-plus-circle"></i> Add New Event
            </button>
        </div>
    `;
    
    modalBody.innerHTML = content;
}

function showAddEventModal() {
    editingEventId = null;
    const modal = document.getElementById('eventModal');
    const modalContent = document.querySelector('.modal-content');
    modal.style.display = 'block';
    
    if (!selectedDate) {
        modalContent.innerHTML = createEventFormWithDate('Add New Event');
    } else {
        modalContent.innerHTML = createEventForm('Add New Event', selectedDate);
    }
}

async function showEditEventModal(eventId) {
    editingEventId = eventId;
    const modal = document.getElementById('eventModal');
    modal.style.display = 'block';
    const modalContent = document.querySelector('.modal-content');
    
    modalContent.innerHTML = '<div style="text-align:center;padding:40px;color:#666;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><br>Loading...</div>';
    
    const event = (await getLocalEvents()).find(e => e.id == eventId);
    if (event) {
        if (modalContent) {
            modalContent.innerHTML = createEventFormWithDate('Edit Event', event);
        }
    }
}

function createEventForm(title, date, eventData = null) {
    const isEdit = eventData !== null;
    const action = isEdit ? 'edit' : 'add';
    const btnText = isEdit ? 'Update Event' : 'Save Event';
    
    let equipment = '', eventName = '', department = '', venue = '', eventTime = '', eventEndTime = '', status = 'active';
    
    if (isEdit) {
        eventName = eventData.event_name;
        department = eventData.department;
        venue = eventData.venue;
        const timeParts = (eventData.event_time || '').split(' - ');
        eventTime = timeParts[0] || '';
        eventEndTime = timeParts[1] || '';
        equipment = eventData.equipment || '';
        status = eventData.status || 'active';
    }
    
    const departments = ['Tourism Management', 'Information Technology', 'Nursing', 'Criminology', 'Accountancy', 'Hospitality Management', 'Psychology', 'Radiologic Technology', 'Business Administration', 'Communication'];
    const venues = ['Auditorium', 'Audio-Visual Room (AVR)', 'Conference', 'Gymnasium', 'Olivarez Coliseum', 'Quadrangle', 'Botanical', 'Resort', 'MMR'];
    
    return `
        <div class="modal-header">
            <h3><i class="fas fa-${isEdit ? 'edit' : 'plus'}-circle"></i> ${title}</h3>
            <p style="margin-top:5px;opacity:0.8;font-size:14px;">${new Date(date).toLocaleDateString('en-US')}</p>
        </div>
        <div class="modal-body">
            <form id="eventForm">
                <input type="hidden" name="action" value="${action}">
                <input type="hidden" name="date" value="${date}">
                ${isEdit ? `<input type="hidden" name="id" value="${eventData.id}">` : ''}
                
                <div class="form-group-modal">
                    <label>Event Name <span style="color:red;">*</span></label>
                    <input type="text" name="event_name" value="${escapeHtml(eventName)}" required maxlength="200">
                </div>
                
                <div class="form-group-modal">
                    <label>Department <span style="color:red;">*</span></label>
                    <input list="dept-list" name="department" value="${escapeHtml(department)}" required placeholder="Select or type department...">
                    <datalist id="dept-list">
                        ${departments.map(dept => `<option value="${dept}"></option>`).join('')}
                    </datalist>
                </div>
                
                <div class="form-group-modal">
                    <label>Venue <span style="color:red;">*</span></label>
                    <input list="venue-list" name="venue" value="${escapeHtml(venue)}" required placeholder="Select or type venue...">
                    <datalist id="venue-list">
                        ${venues.map(ven => `<option value="${ven}"></option>`).join('')}
                    </datalist>
                </div>
                
                <div class="form-group-modal">
                    <label>Event Time <span style="color:red;">*</span></label>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <input type="time" name="start_time" value="${escapeHtml(eventTime)}" required style="flex:1;">
                        <span style="font-weight:600;color:#333;">to</span>
                        <input type="time" name="end_time" value="${escapeHtml(eventEndTime)}" required style="flex:1;">
                    </div>
                </div>
                
                <div class="form-group-modal">
                    <label>Equipment Needed</label>
                    <textarea name="equipment" rows="3" maxlength="500">${escapeHtml(equipment)}</textarea>
                </div>
                
                <div class="form-group-modal">
                    <label>Status</label>
                    <select name="status" style="width:100%;padding:14px 16px;border:2px solid #cbd5c1;border-radius:16px;font-size:15px;background:#fafdfa;font-family:'Poppins',sans-serif;">
                        <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="done" ${status === 'done' ? 'selected' : ''}>Done</option>
                        <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEvent(this)" style="font-weight:bold;">
                <i class="fas fa-${isEdit ? 'save' : 'plus'}"></i> ${btnText}
            </button>
        </div>
    `;
}

function createEventFormWithDate(title, eventData = null) {
    const isEdit = eventData !== null;
    const action = isEdit ? 'edit' : 'add';
    const btnText = isEdit ? 'Update Event' : 'Save Event';
    
    let equipment = '', eventName = '', department = '', venue = '', eventTime = '', eventEndTime = '', eventDate = '', status = 'active';
    
    if (isEdit) {
        eventName = eventData.event_name;
        department = eventData.department;
        venue = eventData.venue;
        const timeParts = (eventData.event_time || '').split(' - ');
        eventTime = timeParts[0] || '';
        eventEndTime = timeParts[1] || '';
        equipment = eventData.equipment || '';
        eventDate = eventData.reservation_date;
        status = eventData.status || 'active';
    } else {
        eventDate = new Date().toISOString().split('T')[0];
    }
    
    const departments = ['Tourism Management', 'Information Technology', 'Nursing', 'Criminology', 'Accountancy', 'Hospitality Management', 'Psychology', 'Radiologic Technology', 'Business Administration', 'Communication'];
    const venues = ['Auditorium', 'Audio-Visual Room (AVR)', 'Conference', 'Gymnasium', 'Olivarez Coliseum', 'Quadrangle', 'Botanical', 'Resort', 'MMR'];
    
    return `
        <div class="modal-header">
            <h3><i class="fas fa-${isEdit ? 'edit' : 'plus'}-circle"></i> ${title}</h3>
        </div>
        <div class="modal-body">
            <form id="eventForm">
                <input type="hidden" name="action" value="${action}">
                ${isEdit ? `<input type="hidden" name="id" value="${eventData.id}">` : ''}
                
                <div class="form-group-modal">
                    <label>Event Date <span style="color:red;">*</span></label>
                    <input type="date" name="date" value="${eventDate}" required>
                </div>
                
                <div class="form-group-modal">
                    <label>Event Name <span style="color:red;">*</span></label>
                    <input type="text" name="event_name" value="${escapeHtml(eventName)}" required maxlength="200">
                </div>
                
                <div class="form-group-modal">
                    <label>Department <span style="color:red;">*</span></label>
                    <input list="dept-list" name="department" value="${escapeHtml(department)}" required placeholder="Select or type department...">
                    <datalist id="dept-list">
                        ${departments.map(dept => `<option value="${dept}"></option>`).join('')}
                    </datalist>
                </div>
                
                <div class="form-group-modal">
                    <label>Venue <span style="color:red;">*</span></label>
                    <input list="venue-list" name="venue" value="${escapeHtml(venue)}" required placeholder="Select or type venue...">
                    <datalist id="venue-list">
                        ${venues.map(ven => `<option value="${ven}"></option>`).join('')}
                    </datalist>
                </div>
                
                <div class="form-group-modal">
                    <label>Event Time <span style="color:red;">*</span></label>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <input type="time" name="start_time" value="${escapeHtml(eventTime)}" required style="flex:1;">
                        <span style="font-weight:600;color:#333;">to</span>
                        <input type="time" name="end_time" value="${escapeHtml(eventEndTime)}" required style="flex:1;">
                    </div>
                </div>
                
                <div class="form-group-modal">
                    <label>Equipment Needed</label>
                    <textarea name="equipment" rows="3" maxlength="500">${escapeHtml(equipment)}</textarea>
                </div>
                
                <div class="form-group-modal">
                    <label>Status</label>
                    <select name="status" style="width:100%;padding:14px 16px;border:2px solid #cbd5c1;border-radius:16px;font-size:15px;background:#fafdfa;font-family:'Poppins',sans-serif;">
                        <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="done" ${status === 'done' ? 'selected' : ''}>Done</option>
                        <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEvent(this)" style="font-weight:bold;">
                <i class="fas fa-${isEdit ? 'save' : 'plus'}"></i> ${btnText}
            </button>
        </div>
    `;
}

function editEvent(eventId) {
    showEditEventModal(eventId);
}

async function submitEvent(btn) {
    const form = document.getElementById('eventForm');
    const eventName = form.event_name.value.trim();
    const department = form.department.value.trim();
    const venue = form.venue.value.trim();
    const startTime = form.start_time.value.trim();
    const endTime = form.end_time.value.trim();
    const eventTime = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime;
    const eventDate = form.date ? form.date.value.trim() : selectedDate;
    const status = form.status ? form.status.value : 'active';
    
    if (!eventDate) {
        showToast('Event Date is required!', 'error');
        if (form.date) form.date.focus();
        return;
    }
    if (!eventName) {
        showToast('Event Name is required!', 'error');
        form.event_name.focus();
        return;
    }
    if (!department) {
        showToast('Department is required!', 'error');
        form.department.focus();
        return;
    }
    if (!venue) {
        showToast('Venue is required!', 'error');
        form.venue.focus();
        return;
    }
    if (!startTime || !endTime) {
        showToast('Event Time (start and end) is required!', 'error');
        if (!startTime && form.start_time) form.start_time.focus();
        else if (form.end_time) form.end_time.focus();
        return;
    }
    
    const saveBtn = btn;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
        const events = await getLocalEvents();
        const action = form.action.value;
        
        if (action === 'edit') {
            const id = form.id.value;
            const index = events.findIndex(e => e.id == id);
            if (index !== -1) {
                events[index] = {
                    ...events[index],
                    event_name: eventName,
                    department: department,
                    venue: venue,
                    event_time: eventTime,
                    equipment: form.equipment.value.trim(),
                    reservation_date: eventDate,
                    status: status
                };
                await updateEventInFirebase(events[index]);
            }
        } else {
            const newEvent = {
                id: createEventId(),
                event_name: eventName,
                department: department,
                venue: venue,
                event_time: eventTime,
                equipment: form.equipment.value.trim(),
                reservation_date: eventDate,
                status: status,
                created_by: 'firebase'
            };
            await addEventToFirebase(newEvent);
            events.push(newEvent);
        }
        
        allEventsData = events;
        generateCalendar(currentMonth, currentYear);
        closeModal();
        if (document.getElementById('list-view-container').style.display === 'block') {
            loadAllEvents();
        }
        showToast('Event saved successfully!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Error saving event', 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteEvent(eventId, date, btn) {
    if (!confirm('Delete this event permanently?')) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        await deleteEventFromFirebase(eventId);
        generateCalendar(currentMonth, currentYear);
        closeModal();
        if (document.getElementById('list-view-container').style.display === 'block') {
            loadAllEvents();
        }
        showToast('Event deleted!', 'success');
    } catch (error) {
        showToast('Error deleting event', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function addEventToFirebase(eventObj) {
    if (!database) return Promise.reject(new Error('Firebase not initialized'));
    const ref = database.ref('events').push();
    eventObj.id = ref.key;
    return ref.set(eventObj);
}

function updateEventInFirebase(eventObj) {
    if (!database) return Promise.reject(new Error('Firebase not initialized'));
    return database.ref('events/' + eventObj.id).set(eventObj);
}

function deleteEventFromFirebase(eventId) {
    if (!database) return Promise.reject(new Error('Firebase not initialized'));
    return database.ref('events/' + eventId).remove();
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;top:20px;right:20px;z-index:9999;
        padding:15px 20px;border-radius:8px;font-weight:500;
        color:white;min-width:300px;box-shadow:0 10px 25px rgba(0,0,0,0.2);
        transform:translateX(400px);transition:all 0.3s ease;
        background:${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}" style="margin-right:10px;"></i>${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.innerHTML = '<div id="modalTitle"></div><div id="modalBody"></div>';
    }
    editingEventId = null;
    selectedDate = null;
}

window.onclick = function(event) {
    if (event.target.id === 'eventModal') closeModal();
}

function attachViewToggleListeners() {
    const calendarBtn = document.getElementById('calendar-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    const calendarContainer = document.querySelector('.calendar-container');
    const listContainer = document.getElementById('list-view-container');
    
    if (calendarBtn && listBtn) {
        calendarBtn.onclick = function() {
            if (!this.classList.contains('active')) {
                this.classList.add('active');
                listBtn.classList.remove('active');
                calendarContainer.style.display = 'block';
                listContainer.style.display = 'none';
            }
        };
        
        listBtn.onclick = async function() {
            if (!this.classList.contains('active')) {
                this.classList.add('active');
                calendarBtn.classList.remove('active');
                calendarContainer.style.display = 'none';
                listContainer.style.display = 'block';
                await loadAllEvents();
            }
        };
    }
}

async function loadAllEvents() {
    const eventsList = document.getElementById('events-list');
    
    eventsList.innerHTML = '<div style="text-align:center;padding:40px;color:#666;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><br>Loading events...</div>';
    
    try {
        const events = await getLocalEvents();
        allEventsData = events;
        populateMonthFilter(events);
        renderEventsList(events);
        attachSearchListener();
    } catch (error) {
        eventsList.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">Error loading events from database.</p>';
    }
}

function populateMonthFilter(events) {
    const listFilter = document.getElementById('list-filter');
    if (!listFilter) return;
    
    const months = {};
    events.forEach(event => {
        const monthYear = event.reservation_date.substring(0, 7);
        if (!months[monthYear]) {
            const [y, m] = monthYear.split('-');
            months[monthYear] = new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        }
    });
    
    let options = '<option value="">All Months</option>';
    Object.keys(months).sort().forEach(key => {
        options += `<option value="${key}">${months[key]}</option>`;
    });
    listFilter.innerHTML = options;
}

function renderEventsList(events, filteredEvents = null) {
    const eventsList = document.getElementById('events-list');
    eventsList.innerHTML = '';
    
    const eventsToShow = filteredEvents || events;
    
    if (eventsToShow.length === 0) {
        eventsList.innerHTML = '<p style="text-align:center;color:#666;padding:40px;font-size:18px;">No events found</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'events-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Event Date</th>
            <th>Event Name</th>
            <th>Department</th>
            <th>Venue</th>
            <th>Event Time</th>
            <th>Equipment Needed</th>
            <th>Status</th>
            ${isAdmin ? '<th>Actions</th>' : ''}
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    eventsToShow.forEach(event => {
        const row = document.createElement('tr');
        row.className = 'event-row';
        row.dataset.eventId = event.id;
        
        row.innerHTML = `
            <td>${escapeHtml(formatDate(event.reservation_date))}</td>
            <td>${escapeHtml(event.event_name)}</td>
            <td>${escapeHtml(event.department)}</td>
            <td>${escapeHtml(event.venue)}</td>
            <td>${escapeHtml(formatTimeRange(event.event_time))}</td>
            <td>${escapeHtml(event.equipment || '')}</td>
            <td><span class="status-badge status-${event.status || 'active'}">${(event.status || 'active').toUpperCase()}</span></td>
            ${isAdmin ? `
                <td class="table-actions">
                    <button class="btn btn-primary btn-sm" onclick="editEvent('${event.id}')" title="Edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEvent('${event.id}', '${event.reservation_date}', this)" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            ` : ''}
        `;
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    eventsList.appendChild(table);
}

function formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const ampm = hours >= 12 ? 'pm' : 'am';
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatTimeRange(eventTime) {
    if (!eventTime) return '';
    const parts = eventTime.split(' - ');
    if (parts.length === 2) {
        return `${formatTime(parts[0])} - ${formatTime(parts[1])}`;
    }
    return formatTime(eventTime);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function attachSearchListener() {
    const searchInput = document.getElementById('list-search');
    const listFilter = document.getElementById('list-filter');
    
    if (searchInput) {
        searchInput.oninput = function() {
            applyFilters();
        };
    }
    
    if (listFilter) {
        listFilter.onchange = function() {
            applyFilters();
        };
    }
}

function applyFilters() {
    const searchInput = document.getElementById('list-search');
    const listFilter = document.getElementById('list-filter');
    const clearMonthBtn = document.getElementById('clear-month-btn');
    
    if (!searchInput || !listFilter) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const selectedMonth = listFilter.value;
    
    if (clearMonthBtn) {
        clearMonthBtn.style.display = selectedMonth ? 'inline-flex' : 'none';
    }
    
    const filtered = allEventsData.filter(event => {
        const matchesSearch = event.event_name.toLowerCase().includes(searchTerm) ||
                            event.department.toLowerCase().includes(searchTerm) ||
                            event.venue.toLowerCase().includes(searchTerm);
        const matchesMonth = !selectedMonth || event.reservation_date.startsWith(selectedMonth);
        return matchesSearch && matchesMonth;
    });
    
    renderEventsList(allEventsData, filtered);
}

async function clearMonthEvents() {
    const listFilter = document.getElementById('list-filter');
    const selectedMonth = listFilter.value;
    
    if (!selectedMonth) {
        showToast('Please select a month first', 'error');
        return;
    }
    
    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    if (!confirm(`Delete ALL events for ${monthName}? This cannot be undone.`)) return;
    
    showToast('Deleting events...', 'success');
    
    try {
        const events = await getLocalEvents();
        const before = events.length;
        events = events.filter(e => !e.reservation_date.startsWith(selectedMonth));
        const deletedCount = before - events.length;
        await setLocalEvents(events);
        
        showToast(`Deleted ${deletedCount} events for ${monthName}`, 'success');
        loadAllEvents();
        loadEventsForMonth(currentMonth, currentYear);
    } catch (error) {
        showToast('Error deleting events', 'error');
    }
}
