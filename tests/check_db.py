import sqlite3
conn = sqlite3.connect('backend/grts.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM jobs WHERE description IS NOT NULL AND description != ""')
print(f"Jobs with description: {cursor.fetchone()[0]}")
cursor.execute('SELECT title, description FROM jobs WHERE description != "" LIMIT 1')
print(f"First match: {cursor.fetchone()}")
conn.close()
