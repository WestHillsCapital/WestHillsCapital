CREATE TABLE IF NOT EXISTS saml_connections (
  id               SERIAL      PRIMARY KEY,
  account_id       INTEGER     NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
  enforced         BOOLEAN     NOT NULL DEFAULT FALSE,
  domain           TEXT        NOT NULL,
  idp_entity_id    TEXT        NOT NULL DEFAULT '',
  idp_sso_url      TEXT        NOT NULL DEFAULT '',
  idp_certificate  TEXT        NOT NULL DEFAULT '',
  sp_entity_id     TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id),
  UNIQUE (domain)
);
