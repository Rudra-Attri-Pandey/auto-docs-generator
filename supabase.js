'use strict';
/* Minimal Supabase PostgREST client — zero deps, global fetch (Node 18+).
 * Credentials come ONLY from env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Never hardcode keys in this file. When unconfigured, sbConfigured() is
 * false and apps keep their local file stores (dev mode).
 */

function sbCfg() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key, ok: Boolean(url && key) };
}

function sbConfigured() {
  return sbCfg().ok;
}

function sbHeaders(extra) {
  const { key } = sbCfg();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

async function sbRequest(table, { method = 'GET', params = {}, body } = {}) {
  const { url, ok } = sbCfg();
  if (!ok) throw new Error('supabase: not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  const u = new URL(`${url}/rest/v1/${encodeURIComponent(table)}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  const mutating = method !== 'GET';
  const res = await fetch(u, {
    method,
    headers: sbHeaders(mutating ? { Prefer: 'return=representation' } : undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const detail = (data && (data.message || data.error_description || data.error)) || String(text).slice(0, 200);
    const err = new Error(`supabase ${method} ${table} -> HTTP ${res.status}: ${detail}`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

// Insert one row; returns the inserted row (return=representation) or null.
async function sbInsert(table, row) {
  const data = await sbRequest(table, { method: 'POST', body: row });
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

// List rows. opts.filter: { col: 'eq.val' } pairs; opts.order: 'col.desc' | 'col.asc';
// opts.limit: N. Filters are sent via URLSearchParams on the PostgREST query string.
async function sbList(table, opts = {}) {
  const params = {};
  for (const [col, op] of Object.entries(opts.filter || {})) params[col] = op;
  if (opts.order) params.order = opts.order;
  if (opts.limit !== undefined && opts.limit !== null) params.limit = String(opts.limit);
  const data = await sbRequest(table, { method: 'GET', params });
  return Array.isArray(data) ? data : [];
}

// Get a single row by primary-key id, or null.
async function sbGet(table, id) {
  const rows = await sbList(table, { filter: { id: `eq.${id}` }, limit: 1 });
  return rows[0] || null;
}

// Patch a row by id; returns the updated row, or null when nothing matched.
async function sbUpdate(table, id, patch) {
  const data = await sbRequest(table, { method: 'PATCH', params: { id: `eq.${id}` }, body: patch });
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

// Delete a row by id; returns true when a row was deleted.
async function sbDelete(table, id) {
  const data = await sbRequest(table, { method: 'DELETE', params: { id: `eq.${id}` } });
  return Array.isArray(data) ? data.length > 0 : true;
}

module.exports = { sbConfigured, sbInsert, sbList, sbGet, sbUpdate, sbDelete };
