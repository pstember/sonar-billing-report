/**
 * Persistent store — SQLite-backed REST API for user configuration data.
 * Replaces IndexedDB/Dexie for: costCenters, costCenterAssignments,
 * billingConfig, tagMappings, settings, historicalSnapshots.
 */

import Database from 'better-sqlite3';
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cost_centers (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT
  );

  CREATE TABLE IF NOT EXISTS cost_center_assignments (
    id                   TEXT PRIMARY KEY,
    cost_center_id       TEXT NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    type                 TEXT NOT NULL,
    project_key          TEXT,
    tag                  TEXT,
    allocation_percentage REAL NOT NULL DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS billing_config (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    contract_value  REAL,
    default_rate    REAL,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    language_rates  TEXT,
    tiered_pricing  TEXT
  );

  CREATE TABLE IF NOT EXISTS tag_mappings (
    tag        TEXT PRIMARY KEY,
    team_name  TEXT NOT NULL,
    cost_center TEXT,
    percentage  REAL,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS historical_snapshots (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT NOT NULL,
    team_name TEXT NOT NULL,
    ncloc     REAL NOT NULL,
    cost      REAL NOT NULL
  );
`);

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

// ── Cost Centers ──────────────────────────────────────────────────────────────

router.get('/costCenters', (_req, res) => {
  const rows = db.prepare('SELECT * FROM cost_centers ORDER BY name').all();
  res.json(rows);
});

router.put('/costCenters/:id', (req, res) => {
  const { id } = req.params;
  const { name, code } = req.body;
  db.prepare(`
    INSERT INTO cost_centers (id, name, code) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, code=excluded.code
  `).run(id, name, code ?? null);
  res.json({ id, name, code: code ?? null });
});

router.delete('/costCenters/:id', (req, res) => {
  db.prepare('DELETE FROM cost_centers WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ── Cost Center Assignments ───────────────────────────────────────────────────

router.get('/costCenterAssignments', (req, res) => {
  const { costCenterId } = req.query;
  const rows = costCenterId
    ? db.prepare('SELECT * FROM cost_center_assignments WHERE cost_center_id = ?').all(costCenterId)
    : db.prepare('SELECT * FROM cost_center_assignments').all();
  // Map snake_case → camelCase for frontend
  res.json(rows.map(mapAssignmentOut));
});

router.put('/costCenterAssignments/:id', (req, res) => {
  const { id } = req.params;
  const { costCenterId, type, projectKey, tag, allocationPercentage } = req.body;
  db.prepare(`
    INSERT INTO cost_center_assignments (id, cost_center_id, type, project_key, tag, allocation_percentage)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      cost_center_id=excluded.cost_center_id,
      type=excluded.type,
      project_key=excluded.project_key,
      tag=excluded.tag,
      allocation_percentage=excluded.allocation_percentage
  `).run(id, costCenterId, type, projectKey ?? null, tag ?? null, allocationPercentage ?? 100);
  res.json(mapAssignmentOut({ id, cost_center_id: costCenterId, type, project_key: projectKey ?? null, tag: tag ?? null, allocation_percentage: allocationPercentage ?? 100 }));
});

router.delete('/costCenterAssignments/:id', (req, res) => {
  db.prepare('DELETE FROM cost_center_assignments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

function mapAssignmentOut(row) {
  return {
    id: row.id,
    costCenterId: row.cost_center_id,
    type: row.type,
    projectKey: row.project_key ?? undefined,
    tag: row.tag ?? undefined,
    allocationPercentage: row.allocation_percentage,
  };
}

// ── Billing Config ────────────────────────────────────────────────────────────

router.get('/billingConfig', (_req, res) => {
  const row = db.prepare('SELECT * FROM billing_config WHERE id = 1').get();
  if (!row) return res.json(null);
  res.json(mapBillingConfigOut(row));
});

router.put('/billingConfig', (req, res) => {
  const { contractValue, defaultRate, currency, languageRates, tieredPricing } = req.body;
  db.prepare(`
    INSERT INTO billing_config (id, contract_value, default_rate, currency, language_rates, tiered_pricing)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      contract_value=excluded.contract_value,
      default_rate=excluded.default_rate,
      currency=excluded.currency,
      language_rates=excluded.language_rates,
      tiered_pricing=excluded.tiered_pricing
  `).run(
    contractValue ?? null,
    defaultRate ?? null,
    currency ?? 'EUR',
    languageRates != null ? JSON.stringify(languageRates) : null,
    tieredPricing != null ? JSON.stringify(tieredPricing) : null,
  );
  const row = db.prepare('SELECT * FROM billing_config WHERE id = 1').get();
  res.json(mapBillingConfigOut(row));
});

function mapBillingConfigOut(row) {
  return {
    contractValue: row.contract_value ?? undefined,
    defaultRate: row.default_rate ?? undefined,
    currency: row.currency,
    languageRates: row.language_rates ? JSON.parse(row.language_rates) : undefined,
    tieredPricing: row.tiered_pricing ? JSON.parse(row.tiered_pricing) : undefined,
  };
}

// ── Tag Mappings ──────────────────────────────────────────────────────────────

router.get('/tagMappings', (_req, res) => {
  const rows = db.prepare('SELECT * FROM tag_mappings ORDER BY tag').all();
  res.json(rows.map(mapTagMappingOut));
});

router.put('/tagMappings/:tag', (req, res) => {
  const { tag } = req.params;
  const { teamName, costCenter, percentage, notes } = req.body;
  db.prepare(`
    INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tag) DO UPDATE SET
      team_name=excluded.team_name,
      cost_center=excluded.cost_center,
      percentage=excluded.percentage,
      notes=excluded.notes
  `).run(tag, teamName, costCenter ?? null, percentage ?? null, notes ?? null);
  res.json(mapTagMappingOut({ tag, team_name: teamName, cost_center: costCenter ?? null, percentage: percentage ?? null, notes: notes ?? null }));
});

router.delete('/tagMappings/:tag', (req, res) => {
  db.prepare('DELETE FROM tag_mappings WHERE tag = ?').run(req.params.tag);
  res.status(204).end();
});

router.post('/tagMappings/import', (req, res) => {
  const mappings = req.body;
  if (!Array.isArray(mappings)) return res.status(400).json({ error: 'Expected array' });

  const upsert = db.prepare(`
    INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tag) DO UPDATE SET
      team_name=excluded.team_name,
      cost_center=excluded.cost_center,
      percentage=excluded.percentage,
      notes=excluded.notes
  `);
  const importAll = db.transaction((items) => {
    for (const m of items) {
      upsert.run(m.tag, m.teamName, m.costCenter ?? null, m.percentage ?? null, m.notes ?? null);
    }
  });
  importAll(mappings);
  res.json({ imported: mappings.length });
});

function mapTagMappingOut(row) {
  return {
    tag: row.tag,
    teamName: row.team_name,
    costCenter: row.cost_center ?? undefined,
    percentage: row.percentage ?? undefined,
    notes: row.notes ?? undefined,
  };
}

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.json(null);
  try {
    res.json(JSON.parse(row.value));
  } catch {
    res.json(row.value);
  }
});

router.put('/settings/:key', (req, res) => {
  const value = JSON.stringify(req.body.value);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(req.params.key, value);
  res.json(req.body.value);
});

// ── Historical Snapshots ──────────────────────────────────────────────────────

router.get('/historicalSnapshots', (_req, res) => {
  const rows = db.prepare('SELECT * FROM historical_snapshots ORDER BY date, team_name').all();
  res.json(rows.map(mapSnapshotOut));
});

router.post('/historicalSnapshots', (req, res) => {
  const snapshots = req.body;
  if (!Array.isArray(snapshots)) return res.status(400).json({ error: 'Expected array' });

  const insert = db.prepare(
    'INSERT INTO historical_snapshots (date, team_name, ncloc, cost) VALUES (?, ?, ?, ?)'
  );
  const insertAll = db.transaction((items) => {
    for (const s of items) {
      insert.run(s.date, s.teamName, s.ncloc, s.cost);
    }
  });
  insertAll(snapshots);
  res.status(201).json({ inserted: snapshots.length });
});

router.delete('/historicalSnapshots', (_req, res) => {
  db.prepare('DELETE FROM historical_snapshots').run();
  res.status(204).end();
});

function mapSnapshotOut(row) {
  return {
    id: row.id,
    date: row.date,
    teamName: row.team_name,
    ncloc: row.ncloc,
    cost: row.cost,
  };
}

// ── Migration endpoint (one-time IndexedDB → SQLite) ─────────────────────────

router.post('/migrate', (req, res) => {
  const { costCenters, costCenterAssignments, billingConfig, tagMappings, settings, historicalSnapshots } = req.body;

  const migrate = db.transaction(() => {
    // Cost centers
    const upsertCC = db.prepare(`
      INSERT INTO cost_centers (id, name, code) VALUES (?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const cc of costCenters ?? []) {
      upsertCC.run(cc.id, cc.name, cc.code ?? null);
    }

    // Assignments
    const upsertA = db.prepare(`
      INSERT INTO cost_center_assignments (id, cost_center_id, type, project_key, tag, allocation_percentage)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const a of costCenterAssignments ?? []) {
      upsertA.run(a.id, a.costCenterId, a.type, a.projectKey ?? null, a.tag ?? null, a.allocationPercentage ?? 100);
    }

    // Billing config (only insert if table is empty)
    if (billingConfig) {
      const existing = db.prepare('SELECT id FROM billing_config WHERE id = 1').get();
      if (!existing) {
        db.prepare(`
          INSERT OR IGNORE INTO billing_config (id, contract_value, default_rate, currency, language_rates, tiered_pricing)
          VALUES (1, ?, ?, ?, ?, ?)
        `).run(
          billingConfig.contractValue ?? null,
          billingConfig.defaultRate ?? null,
          billingConfig.currency ?? 'EUR',
          billingConfig.languageRates != null ? JSON.stringify(billingConfig.languageRates) : null,
          billingConfig.tieredPricing != null ? JSON.stringify(billingConfig.tieredPricing) : null,
        );
      }
    }

    // Tag mappings
    const upsertTM = db.prepare(`
      INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tag) DO NOTHING
    `);
    for (const m of tagMappings ?? []) {
      upsertTM.run(m.tag, m.teamName, m.costCenter ?? null, m.percentage ?? null, m.notes ?? null);
    }

    // Settings
    const upsertS = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO NOTHING
    `);
    for (const [key, value] of Object.entries(settings ?? {})) {
      upsertS.run(key, JSON.stringify(value));
    }

    // Historical snapshots (only if empty)
    const count = db.prepare('SELECT COUNT(*) as n FROM historical_snapshots').get();
    if (count.n === 0) {
      const insertSnap = db.prepare(
        'INSERT INTO historical_snapshots (date, team_name, ncloc, cost) VALUES (?, ?, ?, ?)'
      );
      for (const s of historicalSnapshots ?? []) {
        insertSnap.run(s.date, s.teamName, s.ncloc, s.cost);
      }
    }
  });

  migrate();
  res.json({ ok: true });
});

export default router;
