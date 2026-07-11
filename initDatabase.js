const db = require("./db");

async function initDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        wallet NUMERIC(12,2) DEFAULT 0
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(100) NOT NULL,
        contribution_amount NUMERIC(12,2) NOT NULL,
        max_members INTEGER NOT NULL,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        current_position INTEGER DEFAULT 1,
        randomized BOOLEAN DEFAULT FALSE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        position INTEGER NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS contributions (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP
      );
    `);

    console.log("✅ Database tables created successfully.");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}

module.exports = initDatabase;