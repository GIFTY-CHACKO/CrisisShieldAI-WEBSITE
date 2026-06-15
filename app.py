import os
import sqlite3
from flask import Flask, request, jsonify, send_from_directory
from database import init_db, DB_PATH
import ai_engine

app = Flask(__name__, static_folder='../frontend', static_url_path='')

def upgrade_db_schema():
    """
    Safely checks and updates the existing SQLite table to add triage lifecycle parameters
    and custom manually-typed locations without losing any existing collected disaster rows.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all column names currently present in the incidents table
    cursor.execute("PRAGMA table_info(incidents);")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Dynamically inject the triage tracking parameters if they don't exist
    if 'status' not in columns:
        cursor.execute("ALTER TABLE incidents ADD COLUMN status TEXT DEFAULT 'Not Attended';")
    if 'assigned_teams' not in columns:
        cursor.execute("ALTER TABLE incidents ADD COLUMN assigned_teams TEXT DEFAULT '';")
    if 'requested_resources' not in columns:
        cursor.execute("ALTER TABLE incidents ADD COLUMN requested_resources TEXT DEFAULT '';")
        
    # NEW EXTRA FIELD: User Manual-Typed Landmark String Property Column Injection
    if 'typed_location' not in columns:
        cursor.execute("ALTER TABLE incidents ADD COLUMN typed_location TEXT DEFAULT '';")
        
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/dashboard')
def dashboard_page():
    return send_from_directory(app.static_folder, 'dashboard.html')

@app.route('/api/report', methods=['POST'])
def report_incident():
    data = request.json or {}
    raw_text = data.get('text', '')
    lat = data.get('latitude', 10.0) 
    lng = data.get('longitude', 76.2)
    typed_location = data.get('typed_location', '') # Intercept newly added custom location field
    
    if not raw_text:
        return jsonify({"error": "Message content cannot be blank"}), 400
        
    ai_result = ai_engine.analyze_incident_report(raw_text)
    
    # Embed the typed text address into the context summary block for immediate dispatcher scannability
    final_summary = ai_result.get('analysis_summary', '')
    if typed_location:
        final_summary = f"[Typed Landmark/Address: {typed_location}] - {final_summary}"

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO incidents (raw_text, translated_text, category, severity, priority, latitude, longitude, is_scam, credibility_score, analysis_summary, typed_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 100, ?, ?)
    ''', (raw_text, ai_result['translated_text'], ai_result['category'], ai_result['severity'], ai_result['priority'], lat, lng, final_summary, typed_location))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "data": ai_result})

@app.route('/api/verify', methods=['POST'])
def verify_message():
    data = request.json or {}
    content = data.get('text', '')
    
    if not content:
        return jsonify({"error": "Content cannot be blank"}), 400
        
    ai_result = ai_engine.evaluate_scam_or_rumor(content)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO incidents (raw_text, translated_text, category, severity, priority, latitude, longitude, is_scam, credibility_score, analysis_summary)
        VALUES (?, 'N/A', 'Verification Screen', 'N/A', 'Low', 0.0, 0.0, ?, ?, ?)
    ''', (content, ai_result['is_scam'], ai_result['credibility_score'], ai_result['analysis_summary']))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "data": ai_result})

@app.route('/api/incidents', methods=['GET'])
def get_incidents():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(ix) for ix in rows])

@app.route('/api/incidents/<int:incident_id>/update', methods=['POST'])
def update_incident_triage(incident_id):
    data = request.json or {}
    status = data.get('status', 'Not Attended')
    assigned_teams = data.get('assigned_teams', '')
    requested_resources = data.get('requested_resources', '')
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE incidents 
            SET status = ?, assigned_teams = ?, requested_resources = ?
            WHERE id = ?
        ''', (status, assigned_teams, requested_resources, incident_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Incident records updated dynamically."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_db()          
    upgrade_db_schema() 
    app.run(debug=True, port=5000)