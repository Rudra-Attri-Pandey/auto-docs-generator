const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sbConfigured, sbInsert, sbList, sbRequest } = require('./supabase');

// Supabase PostgREST table names (dual-mode: used only when sbConfigured())
const T_DOCS = 'docuai_docs';
const T_VECTORS = 'docuai_vectors';

const DB_PATH = process.env.NODE_ENV === 'production' 
  ? '/tmp/auto_docs.db' 
  : path.join(__dirname, 'auto_docs.db');

let db = null;
let memoryStore = [];
let memoryVectorStore = [];

// Which store is active for this process.
function storeMode() {
  return sbConfigured() ? 'supabase' : 'sqlite';
}

function uuid() {
  return crypto.randomUUID();
}

// Legacy TEXT-JSON columns (vector_json) may come back as strings; parse-if-string.
function maybeParseJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (_) { return v; }
  }
  return v;
}

async function getDB() {
  if (sbConfigured()) {
    // Supabase mode: no local sql.js database is used.
    throw new Error('supabase: getDB() unavailable in Supabase mode (use db helper functions)');
  }
  if (db) return db;

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(filebuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS docs_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        raw_code TEXT NOT NULL,
        generated_doc TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS doc_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        vector_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    saveDB();
    return db;
  } catch (err) {
    console.warn('WASM SQLite initialization fallback:', err.message);
    return {
      run: (query, params = []) => {
        if (query.includes('INSERT INTO docs_history')) {
          memoryStore.push({
            id: memoryStore.length + 1,
            title: params[0],
            format: params[1],
            raw_code: params[2],
            generated_doc: params[3],
            created_at: new Date().toISOString()
          });
        } else if (query.includes('INSERT INTO doc_vectors')) {
          memoryVectorStore.push({
            id: memoryVectorStore.length + 1,
            doc_id: params[0],
            title: params[1],
            format: params[2],
            chunk_text: params[3],
            vector_json: params[4],
            created_at: new Date().toISOString()
          });
        } else if (query.includes('DELETE FROM doc_vectors')) {
          memoryVectorStore = [];
        }
      },
      exec: (query) => {
        if (query.includes('FROM doc_vectors')) {
          return [{
            columns: ['id', 'doc_id', 'title', 'format', 'chunk_text', 'vector_json', 'created_at'],
            values: memoryVectorStore.map(item => [item.id, item.doc_id, item.title, item.format, item.chunk_text, item.vector_json, item.created_at])
          }];
        }
        return [{
          columns: ['id', 'title', 'format', 'raw_code', 'generated_doc', 'created_at'],
          values: memoryStore.map(item => [item.id, item.title, item.format, item.raw_code, item.generated_doc, item.created_at])
        }];
      }
    };
  }
}

function saveDB() {
  if (!db || typeof db.export !== 'function') return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.warn('DB Save warning:', e.message);
  }
}

// Insert one docs-history row. Returns the stored row.
async function insertDocHistory(entry) {
  if (sbConfigured()) {
    return sbInsert(T_DOCS, {
      title: entry.title,
      format: entry.format,
      raw_code: entry.raw_code,
      generated_doc: entry.generated_doc
    });
  }
  const database = await getDB();
  database.run(
    `INSERT INTO docs_history (title, format, raw_code, generated_doc) VALUES (?, ?, ?, ?)`,
    [entry.title, entry.format, entry.raw_code, entry.generated_doc]
  );
  saveDB();
  return { title: entry.title, format: entry.format };
}

// List recent docs-history rows (newest first).
async function listDocHistory(limit = 20) {
  if (sbConfigured()) {
    return sbList(T_DOCS, { order: 'created_at.desc,id.asc', limit });
  }
  const database = await getDB();
  const res = database.exec(`SELECT * FROM docs_history ORDER BY id DESC LIMIT ${Number(limit) || 20}`);
  if (!res || res.length === 0 || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj;
  });
}

// Delete one docs-history row by id.
async function deleteDocHistory(id) {
  if (sbConfigured()) {
    await sbRequest(T_DOCS, { method: 'DELETE', params: { id: `eq.${id}` } });
    return;
  }
  const database = await getDB();
  database.run(`DELETE FROM docs_history WHERE id = ?`, [id]);
  saveDB();
}

// Store RAG vectors. In Supabase mode vector_json is jsonb: the array is stored
// directly (not stringified); in SQLite mode it stays JSON text (legacy).
async function saveDocVectors(entries) {
  if (sbConfigured()) {
    for (const entry of entries) {
      await sbInsert(T_VECTORS, {
        doc_id: entry.doc_id,
        title: entry.title || 'Code Snippet',
        format: entry.format || 'RAW_CODE',
        chunk_text: entry.chunk_text,
        vector_json: entry.vector
      });
    }
    return;
  }
  const database = await getDB();
  for (const entry of entries) {
    database.run(
      `INSERT INTO doc_vectors (doc_id, title, format, chunk_text, vector_json) VALUES (?, ?, ?, ?, ?)`,
      [entry.doc_id, entry.title || 'Code Snippet', entry.format || 'RAW_CODE', entry.chunk_text, JSON.stringify(entry.vector)]
    );
  }
  saveDB();
}

async function getDocVectors() {
  if (sbConfigured()) {
    const rows = await sbList(T_VECTORS, { order: 'created_at.desc,id.asc' });
    return rows.map(r => ({
      id: r.id,
      doc_id: r.doc_id,
      title: r.title,
      format: r.format,
      chunk_text: r.chunk_text,
      vector: maybeParseJson(r.vector_json),
      created_at: r.created_at
    }));
  }
  const database = await getDB();
  const res = database.exec(`SELECT id, doc_id, title, format, chunk_text, vector_json, created_at FROM doc_vectors ORDER BY id DESC`);
  if (!res || res.length === 0 || !res[0].values) return [];
  
  return res[0].values.map(row => ({
    id: row[0],
    doc_id: row[1],
    title: row[2],
    format: row[3],
    chunk_text: row[4],
    vector: maybeParseJson(row[5]),
    created_at: row[6]
  }));
}

async function clearDocVectors() {
  if (sbConfigured()) {
    // 'not.is.null' matches every row: explicit filter for a bulk delete.
    await sbRequest(T_VECTORS, { method: 'DELETE', params: { id: 'not.is.null' } });
    return;
  }
  const database = await getDB();
  database.run(`DELETE FROM doc_vectors`);
  saveDB();
}

module.exports = {
  getDB,
  saveDB,
  storeMode,
  insertDocHistory,
  listDocHistory,
  deleteDocHistory,
  saveDocVectors,
  getDocVectors,
  clearDocVectors
};
