const Database = require("better-sqlite3");

const db = new Database("unbothered.db");

// Create songs table
db.prepare(`
    CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        cover TEXT,
        audio TEXT NOT NULL,
        duration INTEGER,
        quality TEXT,
        release_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

console.log("Unbothered database is ready!");

module.exports = db;