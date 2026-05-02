import sqlite3
import os

def init_db():
    db_path = 'hotel.db'
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create Users Table (unified for customers and admins)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'customer'
        )
    ''')

    # Create Rooms Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY,
            type TEXT NOT NULL,
            price REAL NOT NULL,
            capacity INTEGER NOT NULL,
            bed TEXT NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT 1
        )
    ''')

    # Create Bookings Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT NOT NULL,
            total_cost REAL NOT NULL,
            amenities TEXT,
            status TEXT NOT NULL,
            FOREIGN KEY(room_id) REFERENCES rooms(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Insert Initial Rooms
    initial_rooms = [
        (101, "Single", 100, 1, "1 Twin", True),
        (102, "Single", 100, 1, "1 Twin", True),
        (103, "Double", 150, 2, "1 Queen", True),
        (104, "Double", 150, 2, "1 Queen", True),
        (105, "Suite", 300, 4, "1 King, 1 Sofa", True),
        (106, "Suite", 300, 4, "1 King, 1 Sofa", True),
    ]

    cursor.executemany('''
        INSERT INTO rooms (id, type, price, capacity, bed, is_available)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', initial_rooms)

    # Insert default admin: admin / password123
    from werkzeug.security import generate_password_hash
    default_hash = generate_password_hash('password123')
    
    cursor.execute(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        ('admin', default_hash, 'Administrator', 'admin')
    )

    conn.commit()
    conn.close()
    print("Database initialized successfully!")

if __name__ == '__main__':
    init_db()
