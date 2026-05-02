// API Configuration
const API_BASE = 'http://127.0.0.1:5000/api';

// App State
let rooms = [];
let bookings = [];
let authToken = localStorage.getItem('luxe_token') || null;
let userRole = localStorage.getItem('luxe_role') || null;
let userName = localStorage.getItem('luxe_username') || null;
let userFullName = localStorage.getItem('luxe_fullname') || null;

// Initialize App
async function initApp() {
    updateAuthUI();
    await fetchState();
    setupEventListeners();
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// --- Auth UI ---
function updateAuthUI() {
    const signinLi = document.getElementById('nav-signin-li');
    const userLi = document.getElementById('nav-user-li');
    const logoutLi = document.getElementById('nav-logout-li');
    const adminLi = document.getElementById('nav-admin-li');

    if (authToken) {
        signinLi.style.display = 'none';
        userLi.style.display = 'block';
        logoutLi.style.display = 'block';
        document.getElementById('user-display-name').textContent = userFullName || userName || 'User';

        if (userRole === 'admin') {
            adminLi.style.display = 'block';
        } else {
            adminLi.style.display = 'none';
            const activeTab = document.querySelector('.nav-links a.active');
            if (activeTab && activeTab.dataset.target === 'admin-dashboard') {
                switchTab('dashboard');
            }
        }
    } else {
        signinLi.style.display = 'block';
        userLi.style.display = 'none';
        logoutLi.style.display = 'none';
        adminLi.style.display = 'none';
        const activeTab = document.querySelector('.nav-links a.active');
        if (activeTab && activeTab.dataset.target === 'admin-dashboard') {
            switchTab('dashboard');
        }
    }
}

function saveAuthData(data) {
    authToken = data.token;
    userRole = data.role;
    userName = data.username;
    userFullName = data.fullName;
    localStorage.setItem('luxe_token', authToken);
    localStorage.setItem('luxe_role', userRole);
    localStorage.setItem('luxe_username', userName);
    localStorage.setItem('luxe_fullname', userFullName);
}

function clearAuthData() {
    authToken = null; userRole = null; userName = null; userFullName = null;
    localStorage.removeItem('luxe_token');
    localStorage.removeItem('luxe_role');
    localStorage.removeItem('luxe_username');
    localStorage.removeItem('luxe_fullname');
}

// --- Auth Handlers ---
async function handleSignIn(e) {
    e.preventDefault();
    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;
    const btn = document.getElementById('signin-submit-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        saveAuthData(data);
        closeModals();
        document.getElementById('signin-form').reset();
        updateAuthUI();
        await fetchState();
        showToast(`Welcome back, ${data.fullName || data.username}!`, 'success');
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('register-fullname').value;
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }

    const btn = document.getElementById('register-submit-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        saveAuthData(data);
        closeModals();
        document.getElementById('register-form').reset();
        updateAuthUI();
        await fetchState();
        showToast(`Welcome, ${data.fullName}! Your account is ready.`, 'success');
    } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.role !== 'admin') throw new Error('This account does not have admin privileges');

        saveAuthData(data);
        closeModals();
        document.getElementById('admin-login-form').reset();
        updateAuthUI();
        switchTab('admin-dashboard');
        await fetchState();
        showToast('Admin access granted', 'success');
    } catch (err) {
        showToast(err.message || 'Admin login failed', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Authenticate';
    }
}

function handleLogout(e) {
    e.preventDefault();
    clearAuthData();
    updateAuthUI();
    switchTab('dashboard');
    bookings = [];
    renderMyBookings();
    showToast('You have been logged out', 'info');
}

// --- Auth Modal Tabs ---
function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelector(`[data-auth-tab="${tabName}"]`).classList.add('active');
    document.querySelector(`[data-auth-panel="${tabName}"]`).classList.add('active');
}

// --- Secret Admin Trigger (triple click logo) ---
let logoClickCount = 0;
let logoClickTimer = null;
function handleLogoClick() {
    logoClickCount++;
    if (logoClickCount === 3) {
        logoClickCount = 0;
        clearTimeout(logoClickTimer);
        document.getElementById('admin-login-modal').classList.add('active');
    } else {
        clearTimeout(logoClickTimer);
        logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 600);
    }
}

// --- Fetch State ---
async function fetchState() {
    try {
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const activeTab = document.querySelector('.nav-links a.active')?.dataset.target;
        let roomsRes;
        if (activeTab === 'admin-dashboard') {
            roomsRes = await fetch(`${API_BASE}/rooms?showAll=true`);
        } else {
            roomsRes = await fetch(`${API_BASE}/rooms`);
        }
        const bookingsRes = await fetch(`${API_BASE}/bookings`, { headers });
        if (!roomsRes.ok || !bookingsRes.ok) throw new Error('Failed to fetch data');
        rooms = await roomsRes.json();
        bookings = await bookingsRes.json();
        if (activeTab === 'dashboard') applyFilters();
        else if (activeTab === 'admin-dashboard') renderAdminDashboard();
        else renderMyBookings();
    } catch (error) {
        console.error("Error fetching state:", error);
    }
}

// --- Render Dashboard ---
function renderDashboard(filterType = 'all', minCapacity = 0, maxPrice = Infinity) {
    const grid = document.getElementById('rooms-grid');
    grid.innerHTML = '';
    const filtered = rooms.filter(r => {
        return (filterType === 'all' || r.type === filterType) && r.capacity >= minCapacity && r.price <= maxPrice;
    });
    filtered.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card glass-effect';
        const avail = room.isAvailable || room.is_available;
        const badgeClass = avail ? 'status-available' : 'status-booked';
        const badgeText = avail ? 'Available' : 'Booked';
        const btnHTML = avail
            ? `<button class="btn btn-primary btn-block" onclick="openBookingModal(${room.id})">Book Now</button>`
            : `<button class="btn btn-secondary btn-block" disabled>Unavailable</button>`;
        let panoImage = '';
        if (room.type === 'Suite') panoImage = 'images/pano_suite.png';
        if (room.type === 'Single' || room.type === 'Double') panoImage = 'images/pano_boutique.png';
        const panoBtn = `<button class="btn btn-secondary btn-block" style="margin-top: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);" onclick="openPano('${panoImage}', '${room.type} Room')"><i class="fa-solid fa-vr-cardboard"></i> 360° View</button>`;
        let imageUrl = 'images/single.png';
        if (room.type === 'Double') imageUrl = 'images/double.png';
        if (room.type === 'Suite') imageUrl = 'images/suite.png';
        card.innerHTML = `
            <div class="status-badge ${badgeClass}">${badgeText}</div>
            <div class="room-image-container"><img src="${imageUrl}" alt="${room.type} Room" class="room-image" /></div>
            <div class="room-details">
                <div class="room-type">${room.type} Room</div>
                <div class="room-number">Room ${room.id}</div>
                <div class="room-meta">
                    <span><i class="fa-solid fa-users"></i> ${room.capacity} Guests</span>
                    <span><i class="fa-solid fa-bed"></i> ${room.bed}</span>
                </div>
                <div class="room-price">$${room.price} <span>/ night</span></div>
                ${btnHTML}
                ${panoBtn}
            </div>`;
        grid.appendChild(card);
    });
}

// --- Render My Bookings ---
function renderMyBookings() {
    const list = document.getElementById('bookings-list');
    list.innerHTML = '';
    if (!authToken) {
        list.innerHTML = `<div class="glass-effect" style="padding: 40px; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-right-to-bracket" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <p>Please <a href="#" onclick="document.getElementById('auth-modal').classList.add('active'); return false;" style="color: var(--primary);">sign in</a> to view your bookings.</p>
        </div>`;
        return;
    }
    if (bookings.length === 0) {
        list.innerHTML = `<div class="glass-effect" style="padding: 40px; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-calendar-xmark" style="font-size: 3rem; margin-bottom: 15px;"></i>
            <p>You have no active bookings.</p>
        </div>`;
        return;
    }
    bookings.forEach(booking => {
        const room = rooms.find(r => r.id === booking.room_id || r.id === booking.roomId);
        const item = document.createElement('div');
        item.className = 'booking-item glass-effect';
        item.innerHTML = `
            <div class="booking-info">
                <h4>Room ${booking.room_id || booking.roomId} - ${room ? room.type : 'Unknown'}</h4>
                <p><i class="fa-regular fa-calendar"></i> ${booking.check_in || booking.checkIn} to ${booking.check_out || booking.checkOut}</p>
                <p style="margin-top: 5px;"><strong>Ref:</strong> ${booking.id} | <strong>Guest:</strong> ${booking.guest_name || booking.guestName}</p>
            </div>
            <div><button class="btn btn-danger" onclick="cancelBooking('${booking.id}')"><i class="fa-solid fa-ban"></i> Cancel</button></div>`;
        list.appendChild(item);
    });
}

// --- Navigation ---
function switchTab(targetId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    const tabLink = document.querySelector(`[data-target="${targetId}"]`);
    if (tabLink) tabLink.classList.add('active');
    if (targetId === 'dashboard') applyFilters();
    if (targetId === 'my-bookings') renderMyBookings();
    if (targetId === 'admin-dashboard') renderAdminDashboard();
}

// --- Admin Dashboard ---
function renderAdminDashboard() {
    const list = document.getElementById('admin-rooms-list');
    list.innerHTML = '';
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'booking-item glass-effect';
        item.style.display = 'flex'; item.style.justifyContent = 'space-between'; item.style.alignItems = 'center';
        const isAvail = room.isAvailable || room.is_available;
        const statusColor = isAvail ? 'var(--accent)' : 'var(--text-muted)';
        const statusText = isAvail ? 'Active' : 'Out of Service';
        const toggleAction = isAvail ? 0 : 1;
        const toggleBtnText = isAvail ? 'Take Out of Service' : 'Put in Service';
        item.innerHTML = `
            <div>
                <h4>Room ${room.id} (${room.type})</h4>
                <p>Price: $${room.price} | Capacity: ${room.capacity} | Bed: ${room.bed}</p>
                <p style="color: ${statusColor}; font-weight: bold;">Status: ${statusText}</p>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="updateRoomStatus(${room.id}, ${toggleAction})">${toggleBtnText}</button>
            </div>`;
        list.appendChild(item);
    });
}

// --- Room Actions ---
async function handleAddRoom(e) {
    e.preventDefault();
    const id = document.getElementById('new-room-id').value;
    const type = document.getElementById('new-room-type').value;
    const price = document.getElementById('new-room-price').value;
    const capacity = document.getElementById('new-room-capacity').value;
    const bed = document.getElementById('new-room-bed').value;
    try {
        const res = await fetch(`${API_BASE}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ id, type, price, capacity, bed })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(data.message, 'success');
        document.getElementById('add-room-form').reset();
        await fetchState();
    } catch (err) { showToast(err.message, 'error'); }
}

async function updateRoomStatus(roomId, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ is_available: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchState();
    } catch (err) { showToast(err.message, 'error'); }
}

// --- Booking Modal ---
function openBookingModal(roomId) {
    if (!authToken) {
        showToast('Please sign in to book a room', 'warning');
        document.getElementById('auth-modal').classList.add('active');
        return;
    }
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('book-room-number').value = roomId;
    document.getElementById('modal-room-summary').innerHTML = `
        <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.2rem; font-family: var(--font-serif);">Room ${room.id}</span>
                <span style="color: var(--primary); font-weight: bold;">$${room.price} / night</span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">${room.type} Room • ${room.bed}</div>
        </div>`;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('check-in').min = today;
    document.getElementById('check-out').min = today;
    document.getElementById('booking-form').reset();
    // Pre-fill guest name
    document.getElementById('guest-name').value = userFullName || '';
    updateLiveCost();
    document.getElementById('booking-modal').classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    if (typeof currentPano !== 'undefined' && currentPano) { currentPano.destroy(); currentPano = null; }
}

// --- 360 Viewer ---
let currentPano = null;
function openPano(imagePath, title) {
    document.getElementById('pano-title').innerText = title + " - 360° Virtual Tour";
    document.getElementById('pano-modal').classList.add('active');
    if (currentPano) currentPano.destroy();
    currentPano = pannellum.viewer('panorama-container', {
        type: "equirectangular", panorama: imagePath, autoLoad: true, compass: false, showFullscreenCtrl: false
    });
}
function closePano() {
    document.getElementById('pano-modal').classList.remove('active');
    if (currentPano) { currentPano.destroy(); currentPano = null; }
}

// --- Cost Calculation ---
function calculateDays(checkIn, checkOut) {
    const diff = Math.abs(new Date(checkOut) - new Date(checkIn));
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
}

function updateLiveCost() {
    const roomId = parseInt(document.getElementById('book-room-number').value);
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const checkIn = document.getElementById('check-in').value;
    const checkOut = document.getElementById('check-out').value;
    let nights = 1;
    if (checkIn && checkOut && checkOut > checkIn) nights = calculateDays(checkIn, checkOut);
    let total = nights * room.price;
    total += document.getElementById('addon-airport').checked ? 50 : 0;
    total += document.getElementById('addon-breakfast').checked ? 20 * nights : 0;
    total += document.getElementById('addon-spa').checked ? 100 : 0;
    document.getElementById('live-total-cost').innerText = `$${total}`;
}

// --- Handle Booking ---
async function handleBooking(e) {
    e.preventDefault();
    const roomId = parseInt(document.getElementById('book-room-number').value);
    const guestName = document.getElementById('guest-name').value;
    const checkIn = document.getElementById('check-in').value;
    const checkOut = document.getElementById('check-out').value;
    if (checkOut <= checkIn) { showToast('Check-out must be after check-in', 'error'); return; }
    const room = rooms.find(r => r.id === roomId);
    if (!room || (!room.isAvailable && !room.is_available)) {
        showToast('Room is no longer available', 'error'); closeModals(); await fetchState(); return;
    }
    const nights = calculateDays(checkIn, checkOut);
    let amenitiesCost = 0; const amenities = [];
    if (document.getElementById('addon-airport').checked) { amenitiesCost += 50; amenities.push('Airport Transfer'); }
    if (document.getElementById('addon-breakfast').checked) { amenitiesCost += 20 * nights; amenities.push('Breakfast'); }
    if (document.getElementById('addon-spa').checked) { amenitiesCost += 100; amenities.push('Spa Access'); }
    const totalCost = (nights * room.price) + amenitiesCost;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Processing...';
    try {
        const res = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ roomId: room.id, guestName, checkIn, checkOut, totalCost, amenities })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Booking failed');
        closeModals();
        await fetchState();
        showReceipt({ id: data.bookingId, guestName, checkIn, checkOut, totalCost, amenities }, room, nights);
        showToast('Booking confirmed!', 'success');
    } catch (err) { showToast(err.message, 'error'); await fetchState(); }
    finally { btn.disabled = false; btn.innerText = 'Confirm Booking'; }
}

// --- Receipt ---
function showReceipt(booking, room, nights) {
    document.getElementById('receipt-details').innerHTML = `
        <div class="receipt-row"><span>Booking Ref:</span><span>${booking.id}</span></div>
        <div class="receipt-row"><span>Guest Name:</span><span>${booking.guestName}</span></div>
        <div class="receipt-row"><span>Room:</span><span>${room.id} (${room.type})</span></div>
        <div class="receipt-row"><span>Check-in:</span><span>${booking.checkIn}</span></div>
        <div class="receipt-row"><span>Check-out:</span><span>${booking.checkOut}</span></div>
        <div class="receipt-row"><span>Duration:</span><span>${nights} night(s)</span></div>
        <div class="receipt-row"><span>Rate:</span><span>$${room.price} / night</span></div>
        ${booking.amenities.length > 0 ? `<div class="receipt-row"><span>Add-ons:</span><span>${booking.amenities.join(', ')}</span></div>` : ''}
        <div class="receipt-row receipt-total"><span>Total:</span><span>$${booking.totalCost}</span></div>`;
    document.getElementById('receipt-modal').classList.add('active');
}

// --- Cancel Booking ---
async function cancelBooking(bookingId) {
    if (!confirm("Cancel this booking?")) return;
    try {
        const res = await fetch(`${API_BASE}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ bookingId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchState();
        showToast('Booking cancelled', 'info');
    } catch (err) { showToast(err.message, 'error'); }
}

function applyFilters() {
    const type = document.getElementById('type-filter').value;
    const minCap = parseInt(document.getElementById('capacity-filter').value) || 0;
    const maxPrice = parseInt(document.getElementById('max-price-filter').value) || Infinity;
    renderDashboard(type, minCap, maxPrice);
}

// --- Password Toggle ---
function setupPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text'; icon.className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password'; icon.className = 'fa-solid fa-eye';
            }
        });
    });
}

// --- Event Listeners ---
function setupEventListeners() {
    // Nav tabs
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.id === 'nav-signin-btn' || link.id === 'nav-logout-btn') return;
        link.addEventListener('click', e => { e.preventDefault(); switchTab(e.target.closest('a').dataset.target); });
    });

    // Auth
    document.getElementById('nav-signin-btn').addEventListener('click', e => {
        e.preventDefault(); document.getElementById('auth-modal').classList.add('active');
    });
    document.getElementById('nav-logout-btn').addEventListener('click', handleLogout);
    document.getElementById('signin-form').addEventListener('submit', handleSignIn);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.authTab));
    });
    document.querySelectorAll('.auth-switch-link').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); switchAuthTab(link.dataset.switchTo); });
    });

    // Secret admin trigger
    document.getElementById('logo-trigger').addEventListener('click', handleLogoClick);

    // Filters
    document.getElementById('type-filter').addEventListener('change', applyFilters);
    document.getElementById('capacity-filter').addEventListener('input', applyFilters);
    document.getElementById('max-price-filter').addEventListener('input', applyFilters);

    // Live cost
    document.getElementById('check-in').addEventListener('change', updateLiveCost);
    document.getElementById('check-out').addEventListener('change', updateLiveCost);
    document.querySelectorAll('.addon-checkbox').forEach(cb => cb.addEventListener('change', updateLiveCost));

    // Forms
    document.getElementById('booking-form').addEventListener('submit', handleBooking);
    const addRoomForm = document.getElementById('add-room-form');
    if (addRoomForm) addRoomForm.addEventListener('submit', handleAddRoom);

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModals));
    document.getElementById('close-receipt-btn').addEventListener('click', () => { closeModals(); switchTab('my-bookings'); });
    window.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeModals(); });

    // Password toggles
    setupPasswordToggles();
}

document.addEventListener('DOMContentLoaded', initApp);
