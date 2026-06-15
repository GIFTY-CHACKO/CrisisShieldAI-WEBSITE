import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database', 'disaster.db')

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table for storing disaster reports and verification checks
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            raw_text TEXT,
            translated_text TEXT,
            category TEXT,
            severity TEXT,
            priority TEXT,
            latitude REAL,
            longitude REAL,
            is_scam INTEGER,
            credibility_score INTEGER,
            analysis_summary TEXT
        )
    ''')
    conn.commit()
    conn.close()

def query_db(query, args=(), one=False):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(query, args)
    rv = cursor.fetchall()
    conn.commit()
    conn.close()
    return (rv[0] if rv else None) if one else rv