-- Assignments: store the full Assignment object as JSONB
CREATE TABLE IF NOT EXISTS assignments (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions: track grading status and result
CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT        PRIMARY KEY,
  status      TEXT        NOT NULL DEFAULT 'pending',
  result      JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Batches: aggregate submission status
CREATE TABLE IF NOT EXISTS batches (
  id                   TEXT        PRIMARY KEY,
  total                INTEGER     NOT NULL,
  completed_count      INTEGER     NOT NULL DEFAULT 0,
  failed_count         INTEGER     NOT NULL DEFAULT 0,
  callback_url         TEXT,
  submission_ids       JSONB       NOT NULL DEFAULT '[]',
  submission_statuses  JSONB       NOT NULL DEFAULT '{}',
  submission_results   JSONB       NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
