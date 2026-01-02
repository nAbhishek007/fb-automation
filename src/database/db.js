import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils/helpers.js';

// Ensure data directory exists
const dataDir = './data';
ensureDir(dataDir);

const dbPath = path.join(dataDir, 'videos.db');

let db = null;

/**
 * Initialize the database
 */
async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS uploaded_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tiktok_id TEXT UNIQUE NOT NULL,
      tiktok_url TEXT NOT NULL,
      video_hash TEXT NOT NULL,
      original_title TEXT,
      original_description TEXT,
      generated_title TEXT,
      generated_description TEXT,
      facebook_post_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      uploaded_at TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_tiktok_id ON uploaded_videos(tiktok_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_video_hash ON uploaded_videos(video_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON uploaded_videos(status)`);

  saveDb();
  return db;
}

/**
 * Save database to disk
 */
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Get database instance (auto-initialize)
 */
async function getDb() {
  if (!db) await initDb();
  return db;
}

/**
 * Check if a video has already been uploaded
 */
export async function isVideoUploaded(tiktokId) {
  const database = await getDb();
  const result = database.exec(`SELECT id FROM uploaded_videos WHERE tiktok_id = ? AND status = 'uploaded'`, [tiktokId]);
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * Check if video hash already exists (duplicate content detection)
 */
export async function isHashExists(hash) {
  const database = await getDb();
  const result = database.exec(`SELECT id FROM uploaded_videos WHERE video_hash = ?`, [hash]);
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * Record a new video for processing
 */
export async function recordVideo(videoData) {
  const database = await getDb();

  try {
    database.run(
      `INSERT OR IGNORE INTO uploaded_videos 
       (tiktok_id, tiktok_url, video_hash, original_title, original_description, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        videoData.tiktokId,
        videoData.tiktokUrl,
        videoData.videoHash,
        videoData.originalTitle || '',
        videoData.originalDescription || ''
      ]
    );
    saveDb();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Update video with generated content
 */
export async function updateGeneratedContent(tiktokId, title, description) {
  const database = await getDb();
  database.run(
    `UPDATE uploaded_videos 
     SET generated_title = ?, generated_description = ?, status = 'ready'
     WHERE tiktok_id = ?`,
    [title, description, tiktokId]
  );
  saveDb();
}

/**
 * Mark video as uploaded with Facebook post ID
 */
export async function markAsUploaded(tiktokId, facebookPostId) {
  const database = await getDb();
  database.run(
    `UPDATE uploaded_videos 
     SET facebook_post_id = ?, status = 'uploaded', uploaded_at = datetime('now')
     WHERE tiktok_id = ?`,
    [facebookPostId, tiktokId]
  );
  saveDb();
}

/**
 * Mark video as failed
 */
export async function markAsFailed(tiktokId) {
  const database = await getDb();
  database.run(
    `UPDATE uploaded_videos 
     SET status = 'failed'
     WHERE tiktok_id = ?`,
    [tiktokId]
  );
  saveDb();
}

/**
 * Get recent upload statistics
 */
export async function getStats() {
  const database = await getDb();

  const total = database.exec('SELECT COUNT(*) as count FROM uploaded_videos');
  const uploaded = database.exec("SELECT COUNT(*) as count FROM uploaded_videos WHERE status = 'uploaded'");
  const failed = database.exec("SELECT COUNT(*) as count FROM uploaded_videos WHERE status = 'failed'");
  const pending = database.exec("SELECT COUNT(*) as count FROM uploaded_videos WHERE status = 'pending'");

  return {
    total: total[0]?.values[0]?.[0] || 0,
    uploaded: uploaded[0]?.values[0]?.[0] || 0,
    failed: failed[0]?.values[0]?.[0] || 0,
    pending: pending[0]?.values[0]?.[0] || 0,
  };
}

/**
 * Get recent uploads
 */
export async function getRecentUploads(limit = 10) {
  const database = await getDb();
  const result = database.exec(
    `SELECT * FROM uploaded_videos 
     WHERE status = 'uploaded' 
     ORDER BY uploaded_at DESC 
     LIMIT ?`,
    [limit]
  );

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// Initialize on import
initDb().catch(console.error);

export default {
  isVideoUploaded,
  isHashExists,
  recordVideo,
  updateGeneratedContent,
  markAsUploaded,
  markAsFailed,
  getStats,
  getRecentUploads,
};
