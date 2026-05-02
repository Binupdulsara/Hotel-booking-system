from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import random
import json
import jwt
import datetime
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps

app = Flask(__name__, static_folder='.', static_url_path='/')
CORS(app)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

app.config['SECRET_KEY'] = 'super-secret-luxe-key-for-dev'

DB_PATH = 'hotel.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- Auth Decorators ---

def decode_token(req):
    """Decode JWT from Authorization header. Returns payload dict or None."""
    token = req.headers.get('Authorization')
    if not token:
        return None
    try:
        token = token.split(" ")[1]  # Bearer <token>
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return data
    except Exception:
        return None

def token_required(f):
    """Require any valid token (user or admin)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = decode_token(request)
        if not payload:
            return jsonify({'error': 'Token is missing or invalid!'}), 401
        request.user_payload = payload
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Require a valid admin token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = decode_token(request)
        if not payload:
            return jsonify({'error': 'Token is missing or invalid!'}), 401
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Admin access required!'}), 403
        request.user_payload = payload
        return f(*args, **kwargs)
    return decorated

# --- Auth Endpoints ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')
    full_name = data.get('fullName', '').strip()

    if not username or not password or not full_name:
        return jsonify({'error': 'All fields are required'}), 400

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    conn = get_db_connection()
    try:
        # Check if username already exists
        existing = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
        if existing:
            return jsonify({'error': 'Username already taken'}), 409

        password_hash = generate_password_hash(password)
        conn.execute(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            (username, password_hash, full_name, 'customer')
        )
        conn.commit()

        # Get the new user's ID
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

        token = jwt.encode({
            'user_id': user['id'],
            'user': user['username'],
            'role': user['role'],
            'fullName': user['full_name'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'token': token,
            'role': user['role'],
            'username': user['username'],
            'fullName': user['full_name']
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 401

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (data.get('username'),)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    if check_password_hash(user['password_hash'], data.get('password')):
        token = jwt.encode({
            'user_id': user['id'],
            'user': user['username'],
            'role': user['role'],
            'fullName': user['full_name'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'token': token,
            'role': user['role'],
            'username': user['username'],
            'fullName': user['full_name']
        })

    return jsonify({'error': 'Invalid credentials'}), 401


# --- Room Endpoints ---

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    show_all = request.args.get('showAll', 'false').lower() == 'true'
    conn = get_db_connection()
    if show_all:
        rooms = conn.execute('SELECT * FROM rooms').fetchall()
    else:
        rooms = conn.execute('SELECT * FROM rooms WHERE is_available = 1').fetchall()
    conn.close()
    return jsonify([dict(row) for row in rooms])


@app.route('/api/rooms', methods=['POST'])
@admin_required
def add_room():
    data = request.json
    try:
        conn = get_db_connection()
        room_id = data.get('id')

        if room_id:
            conn.execute('''
                INSERT INTO rooms (id, type, price, capacity, bed, is_available)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (room_id, data['type'], data['price'], data['capacity'], data['bed'], 1))
        else:
            conn.execute('''
                INSERT INTO rooms (type, price, capacity, bed, is_available)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['type'], data['price'], data['capacity'], data['bed'], 1))

        conn.commit()
        return jsonify({'success': True, 'message': 'Room added successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/rooms/<int:room_id>', methods=['PUT'])
@admin_required
def update_room(room_id):
    data = request.json
    try:
        conn = get_db_connection()

        if 'price' in data and 'is_available' in data:
             conn.execute('UPDATE rooms SET price = ?, is_available = ? WHERE id = ?',
                         (data['price'], data['is_available'], room_id))
        elif 'price' in data:
             conn.execute('UPDATE rooms SET price = ? WHERE id = ?', (data['price'], room_id))
        elif 'is_available' in data:
             conn.execute('UPDATE rooms SET is_available = ? WHERE id = ?', (data['is_available'], room_id))

        conn.commit()
        return jsonify({'success': True, 'message': 'Room updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --- Booking Endpoints ---

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    payload = decode_token(request)

    conn = get_db_connection()

    if payload and payload.get('role') == 'admin':
        # Admin sees all bookings
        bookings = conn.execute('SELECT * FROM bookings ORDER BY rowid DESC').fetchall()
    elif payload and payload.get('user_id'):
        # Logged-in user sees only their bookings
        bookings = conn.execute(
            'SELECT * FROM bookings WHERE user_id = ? ORDER BY rowid DESC',
            (payload['user_id'],)
        ).fetchall()
    else:
        # Not logged in — return empty
        conn.close()
        return jsonify([])

    conn.close()

    result = []
    for b in bookings:
        b_dict = dict(b)
        try:
            b_dict['amenities'] = json.loads(b_dict['amenities'])
        except:
            b_dict['amenities'] = []
        result.append(b_dict)

    return jsonify(result)


@app.route('/api/bookings', methods=['POST'])
@token_required
def create_booking():
    data = request.json
    room_id = data.get('roomId')
    guest_name = data.get('guestName')
    check_in = data.get('checkIn')
    check_out = data.get('checkOut')
    amenities = data.get('amenities', [])
    total_cost = data.get('totalCost')

    user_id = request.user_payload.get('user_id')

    # Security: Validate inputs
    if not all([room_id, guest_name, check_in, check_out, total_cost]):
        return jsonify({'error': 'Missing required fields'}), 400

    # Clean guest name to prevent simple XSS stored in DB
    guest_name = str(guest_name).replace('<', '&lt;').replace('>', '&gt;')

    conn = get_db_connection()
    try:
        # Begin transaction
        conn.execute('BEGIN TRANSACTION')

        # Prevent double booking: Check if room is still available
        room = conn.execute('SELECT * FROM rooms WHERE id = ? AND is_available = 1', (room_id,)).fetchone()

        if not room:
            conn.execute('ROLLBACK')
            return jsonify({'error': 'Room is no longer available'}), 409

        # Mark room as unavailable
        conn.execute('UPDATE rooms SET is_available = 0 WHERE id = ?', (room_id,))

        # Create booking
        booking_id = 'B-' + str(random.randint(1000, 9999))
        amenities_str = json.dumps(amenities)

        conn.execute('''
            INSERT INTO bookings (id, user_id, room_id, guest_name, check_in, check_out, total_cost, amenities, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (booking_id, user_id, room_id, guest_name, check_in, check_out, total_cost, amenities_str, 'Confirmed'))

        conn.commit()
        return jsonify({
            'success': True,
            'bookingId': booking_id,
            'message': 'Booking confirmed successfully!'
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/cancel', methods=['POST'])
@token_required
def cancel_booking():
    data = request.json
    booking_id = data.get('bookingId')

    if not booking_id:
        return jsonify({'error': 'Booking ID required'}), 400

    user_id = request.user_payload.get('user_id')
    role = request.user_payload.get('role')

    conn = get_db_connection()
    try:
        conn.execute('BEGIN TRANSACTION')

        booking = conn.execute('SELECT * FROM bookings WHERE id = ?', (booking_id,)).fetchone()
        if not booking:
            conn.execute('ROLLBACK')
            return jsonify({'error': 'Booking not found'}), 404

        # Only the booking owner or admin can cancel
        if role != 'admin' and booking['user_id'] != user_id:
            conn.execute('ROLLBACK')
            return jsonify({'error': 'Not authorized to cancel this booking'}), 403

        # Make room available again
        room_id = booking['room_id']
        conn.execute('UPDATE rooms SET is_available = 1 WHERE id = ?', (room_id,))

        # Delete booking
        conn.execute('DELETE FROM bookings WHERE id = ?', (booking_id,))

        conn.commit()
        return jsonify({'success': True, 'message': 'Booking cancelled'})

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
