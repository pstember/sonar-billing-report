/**
 * Persistent store — SQLite-backed REST API for user configuration data.
 * Uses async sqlite3 driver so reads/writes never block the Node.js event loop.
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

await db.run('PRAGMA journal_mode = WAL');
await db.run('PRAGMA foreign_keys = ON');

await db.exec(`
  CREATE TABLE IF NOT EXISTS cost_centers (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT
  );

  CREATE TABLE IF NOT EXISTS cost_center_assignments (
    id                    TEXT PRIMARY KEY,
    cost_center_id        TEXT NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    type                  TEXT NOT NULL,
    project_key           TEXT,
    tag                   TEXT,
    allocation_percentage REAL NOT NULL DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS billing_config (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    contract_value REAL,
    default_rate   REAL,
    currency       TEXT NOT NULL DEFAULT 'EUR',
    language_rates TEXT,
    tiered_pricing TEXT
  );

  CREATE TABLE IF NOT EXISTS tag_mappings (
    tag         TEXT PRIMARY KEY,
    team_name   TEXT NOT NULL,
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

router.get('/costCenters', async (_req, res) => {
  try {
    const rows = await db.all('SELECT * FROM cost_centers ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put('/costCenters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    await db.run(
      `INSERT INTO cost_centers (id, name, code) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, code=excluded.code`,
      [id, name, code ?? null],
    );
    res.json({ id, name, code: code ?? null });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete('/costCenters/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM cost_centers WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Cost Center Assignments ───────────────────────────────────────────────────

router.get('/costCenterAssignments', async (req, res) => {
  try {
    const { costCenterId } = req.query;
    const rows = costCenterId
      ? await db.all('SELECT * FROM cost_center_assignments WHERE cost_center_id = ?', [costCenterId])
      : await db.all('SELECT * FROM cost_center_assignments');
    res.json(rows.map(mapAssignmentOut));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put('/costCenterAssignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { costCenterId, type, projectKey, tag, allocationPercentage } = req.body;
    await db.run(
      `INSERT INTO cost_center_assignments (id, cost_center_id, type, project_key, tag, allocation_percentage)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         cost_center_id=excluded.cost_center_id,
         type=excluded.type,
         project_key=excluded.project_key,
         tag=excluded.tag,
         allocation_percentage=excluded.allocation_percentage`,
      [id, costCenterId, type, projectKey ?? null, tag ?? null, allocationPercentage ?? 100],
    );
    res.json(mapAssignmentOut({
      id, cost_center_id: costCenterId, type,
      project_key: projectKey ?? null, tag: tag ?? null,
      allocation_percentage: allocationPercentage ?? 100,
    }));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete('/costCenterAssignments/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM cost_center_assignments WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: String(err) }); }
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

router.get('/billingConfig', async (_req, res) => {
  try {
    const row = await db.get('SELECT * FROM billing_config WHERE id = 1');
    res.json(row ? mapBillingConfigOut(row) : null);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put('/billingConfig', async (req, res) => {
  try {
    const { contractValue, defaultRate, currency, languageRates, tieredPricing } = req.body;
    await db.run(
      `INSERT INTO billing_config (id, contract_value, default_rate, currency, language_rates, tiered_pricing)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         contract_value=excluded.contract_value,
         default_rate=excluded.default_rate,
         currency=excluded.currency,
         language_rates=excluded.language_rates,
         tiered_pricing=excluded.tiered_pricing`,
      [
        contractValue ?? null,
        defaultRate ?? null,
        currency ?? 'EUR',
        languageRates != null ? JSON.stringify(languageRates) : null,
        tieredPricing != null ? JSON.stringify(tieredPricing) : null,
      ],
    );
    const row = await db.get('SELECT * FROM billing_config WHERE id = 1');
    res.json(mapBillingConfigOut(row));
  } catch (err) { res.status(500).json({ error: String(err) }); }
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

router.get('/tagMappings', async (_req, res) => {
  try {
    const rows = await db.all('SELECT * FROM tag_mappings ORDER BY tag');
    res.json(rows.map(mapTagMappingOut));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put('/tagMappings/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { teamName, costCenter, percentage, notes } = req.body;
    await db.run(
      `INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tag) DO UPDATE SET
         team_name=excluded.team_name,
         cost_center=excluded.cost_center,
         percentage=excluded.percentage,
         notes=excluded.notes`,
      [tag, teamName, costCenter ?? null, percentage ?? null, notes ?? null],
    );
    res.json(mapTagMappingOut({ tag, team_name: teamName, cost_center: costCenter ?? null, percentage: percentage ?? null, notes: notes ?? null }));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete('/tagMappings/:tag', async (req, res) => {
  try {
    await db.run('DELETE FROM tag_mappings WHERE tag = ?', [req.params.tag]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post('/tagMappings/import', async (req, res) => {
  const mappings = req.body;
  if (!Array.isArray(mappings)) return res.status(400).json({ error: 'Expected array' });
  try {
    await db.run('BEGIN');
    for (const m of mappings) {
      await db.run(
        `INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tag) DO UPDATE SET
           team_name=excluded.team_name,
           cost_center=excluded.cost_center,
           percentage=excluded.percentage,
           notes=excluded.notes`,
        [m.tag, m.teamName, m.costCenter ?? null, m.percentage ?? null, m.notes ?? null],
      );
    }
    await db.run('COMMIT');
    res.json({ imported: mappings.length });
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: String(err) });
  }
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

router.get('/settings/:key', async (req, res) => {
  try {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [req.params.key]);
    if (!row) return res.json(null);
    try { res.json(JSON.parse(row.value)); } catch { res.json(row.value); }
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.put('/settings/:key', async (req, res) => {
  try {
    const value = JSON.stringify(req.body.value);
    await db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [req.params.key, value],
    );
    res.json(req.body.value);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Historical Snapshots ──────────────────────────────────────────────────────

router.get('/historicalSnapshots', async (_req, res) => {
  try {
    const rows = await db.all('SELECT * FROM historical_snapshots ORDER BY date, team_name');
    res.json(rows.map(mapSnapshotOut));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post('/historicalSnapshots', async (req, res) => {
  const snapshots = req.body;
  if (!Array.isArray(snapshots)) return res.status(400).json({ error: 'Expected array' });
  try {
    await db.run('BEGIN');
    for (const s of snapshots) {
      await db.run(
        'INSERT INTO historical_snapshots (date, team_name, ncloc, cost) VALUES (?, ?, ?, ?)',
        [s.date, s.teamName, s.ncloc, s.cost],
      );
    }
    await db.run('COMMIT');
    res.status(201).json({ inserted: snapshots.length });
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/historicalSnapshots', async (_req, res) => {
  try {
    await db.run('DELETE FROM historical_snapshots');
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

function mapSnapshotOut(row) {
  return { id: row.id, date: row.date, teamName: row.team_name, ncloc: row.ncloc, cost: row.cost };
}

// ── Migration endpoint (one-time IndexedDB → SQLite) ─────────────────────────

router.post('/migrate', async (req, res) => {
  const { costCenters, costCenterAssignments, billingConfig, tagMappings, settings, historicalSnapshots } = req.body;
  try {
    await db.run('BEGIN');

    for (const cc of costCenters ?? []) {
      await db.run(
        `INSERT INTO cost_centers (id, name, code) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        [cc.id, cc.name, cc.code ?? null],
      );
    }

    for (const a of costCenterAssignments ?? []) {
      await db.run(
        `INSERT INTO cost_center_assignments (id, cost_center_id, type, project_key, tag, allocation_percentage)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        [a.id, a.costCenterId, a.type, a.projectKey ?? null, a.tag ?? null, a.allocationPercentage ?? 100],
      );
    }

    if (billingConfig) {
      const existing = await db.get('SELECT id FROM billing_config WHERE id = 1');
      if (!existing) {
        await db.run(
          `INSERT OR IGNORE INTO billing_config (id, contract_value, default_rate, currency, language_rates, tiered_pricing)
           VALUES (1, ?, ?, ?, ?, ?)`,
          [
            billingConfig.contractValue ?? null,
            billingConfig.defaultRate ?? null,
            billingConfig.currency ?? 'EUR',
            billingConfig.languageRates != null ? JSON.stringify(billingConfig.languageRates) : null,
            billingConfig.tieredPricing != null ? JSON.stringify(billingConfig.tieredPricing) : null,
          ],
        );
      }
    }

    for (const m of tagMappings ?? []) {
      await db.run(
        `INSERT INTO tag_mappings (tag, team_name, cost_center, percentage, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tag) DO NOTHING`,
        [m.tag, m.teamName, m.costCenter ?? null, m.percentage ?? null, m.notes ?? null],
      );
    }

    for (const [key, value] of Object.entries(settings ?? {})) {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
        [key, JSON.stringify(value)],
      );
    }

    const { n } = await db.get('SELECT COUNT(*) as n FROM historical_snapshots');
    if (n === 0) {
      for (const s of historicalSnapshots ?? []) {
        await db.run(
          'INSERT INTO historical_snapshots (date, team_name, ncloc, cost) VALUES (?, ?, ?, ?)',
          [s.date, s.teamName, s.ncloc, s.cost],
        );
      }
    }

    await db.run('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: String(err) });
  }
});

export default router;
