-- D1 schema for shared annotations

CREATE TABLE IF NOT EXISTS annotations (
  client_slug TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  shapes_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (client_slug, asset_id)
);

