-- Member A: Kallepalli Sai Meghana (PES1UG24AM911)
-- Incident response core: roles, users, assets, incidents, playbooks, tasks, audit log.

-- Reset (lets the script be re-run during development)
DROP TABLE IF EXISTS audit_log, incident_tasks, playbook_steps, playbooks,
    incident_status_history, incident_assets, incidents,
    incident_status_transitions, severity_sla, assets, users, roles CASCADE;
DROP TYPE IF EXISTS incident_severity, incident_status, incident_category CASCADE;

-- Enumerated types
CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status   AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'CONTAINED', 'RESOLVED', 'CLOSED');
CREATE TYPE incident_category AS ENUM (
    'MALWARE', 'PHISHING', 'RANSOMWARE', 'DATA_BREACH', 'DDOS',
    'UNAUTHORIZED_ACCESS', 'INSIDER_THREAT', 'VULNERABILITY_EXPLOIT', 'OTHER'
);

-- Roles (lookup table)
CREATE TABLE roles (
    role_id     SMALLINT PRIMARY KEY,
    role_name   VARCHAR(20)  NOT NULL UNIQUE CHECK (role_name = upper(role_name)),
    description VARCHAR(200) NOT NULL
);

INSERT INTO roles (role_id, role_name, description) VALUES
    (1, 'ADMIN',   'Manages users, assets and playbooks; full access to incidents'),
    (2, 'ANALYST', 'Triages and works incidents, maintains threat intelligence'),
    (3, 'VIEWER',  'Read-only access to incidents, intel and dashboards');

-- Users. Passwords are stored only as bcrypt hashes; the CHECK rejects anything else.
CREATE TABLE users (
    user_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) >= 2),
    email         CITEXT       NOT NULL UNIQUE
                  CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash CHAR(60)     NOT NULL
                  CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'),
    role_id       SMALLINT     NOT NULL REFERENCES roles (role_id),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Assets the organisation owns and defends
CREATE TABLE assets (
    asset_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hostname           VARCHAR(253) NOT NULL UNIQUE
                       CHECK (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'),
    ip_address         INET,
    asset_type         VARCHAR(20)  NOT NULL CHECK (asset_type IN (
                           'SERVER', 'WORKSTATION', 'NETWORK_DEVICE', 'CLOUD_INSTANCE',
                           'DATABASE', 'APPLICATION', 'IOT')),
    operating_system   VARCHAR(60),
    department         VARCHAR(60)  NOT NULL,
    criticality        SMALLINT     NOT NULL CHECK (criticality BETWEEN 1 AND 5),
    is_internet_facing BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_assets_ip ON assets (ip_address) WHERE ip_address IS NOT NULL;

-- SLA targets per severity. Triggers read this to compute deadlines.
CREATE TABLE severity_sla (
    severity       incident_severity PRIMARY KEY,
    respond_within INTERVAL NOT NULL CHECK (respond_within > INTERVAL '0'),
    resolve_within INTERVAL NOT NULL,
    CHECK (resolve_within > respond_within)
);

INSERT INTO severity_sla (severity, respond_within, resolve_within) VALUES
    ('CRITICAL', INTERVAL '15 minutes', INTERVAL '4 hours'),
    ('HIGH',     INTERVAL '1 hour',     INTERVAL '24 hours'),
    ('MEDIUM',   INTERVAL '4 hours',    INTERVAL '3 days'),
    ('LOW',      INTERVAL '24 hours',   INTERVAL '7 days');

-- Allowed status changes. The status trigger rejects any pair not listed here.
CREATE TABLE incident_status_transitions (
    from_status incident_status NOT NULL,
    to_status   incident_status NOT NULL,
    PRIMARY KEY (from_status, to_status),
    CHECK (from_status <> to_status)
);

INSERT INTO incident_status_transitions (from_status, to_status) VALUES
    ('NEW',         'TRIAGED'),
    ('NEW',         'CLOSED'),        -- false positive
    ('TRIAGED',     'IN_PROGRESS'),
    ('TRIAGED',     'CLOSED'),        -- false positive after triage
    ('IN_PROGRESS', 'CONTAINED'),
    ('IN_PROGRESS', 'RESOLVED'),
    ('CONTAINED',   'IN_PROGRESS'),   -- threat came back
    ('CONTAINED',   'RESOLVED'),
    ('RESOLVED',    'CLOSED'),
    ('RESOLVED',    'IN_PROGRESS'),   -- reopened
    ('CLOSED',      'TRIAGED');       -- reopened after closure

-- Incidents
CREATE TABLE incidents (
    incident_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_code     VARCHAR(20) UNIQUE,            -- filled by trigger, e.g. INC-2026-000042
    title              VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 5),
    description        TEXT         NOT NULL CHECK (length(trim(description)) >= 20),
    category           incident_category NOT NULL,
    severity           incident_severity NOT NULL,
    status             incident_status   NOT NULL DEFAULT 'NEW',
    reported_by        INT NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
    assigned_to        INT,
    source_alert_id    CHAR(24) UNIQUE CHECK (source_alert_id ~ '^[0-9a-f]{24}$'),  -- MongoDB ObjectId of the alert
    detected_at        TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    respond_by         TIMESTAMPTZ,
    resolve_by         TIMESTAMPTZ,
    first_response_at  TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    closed_at          TIMESTAMPTZ,
    resolution_summary TEXT,
    search_tsv         TSVECTOR GENERATED ALWAYS AS (
                           setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                           setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                           setweight(to_tsvector('english', coalesce(resolution_summary, '')), 'C')
                       ) STORED,
    CONSTRAINT chk_detected_not_future CHECK (detected_at <= created_at + INTERVAL '5 minutes'),
    CONSTRAINT chk_resolution_required CHECK (
        status NOT IN ('RESOLVED', 'CLOSED')
        OR (resolution_summary IS NOT NULL AND length(trim(resolution_summary)) >= 10)),
    CONSTRAINT chk_resolved_after_detected CHECK (resolved_at IS NULL OR resolved_at >= detected_at),
    CONSTRAINT chk_closed_after_resolved CHECK (closed_at IS NULL OR resolved_at IS NULL OR closed_at >= resolved_at)
);

-- ALTER: the assignee FK is added separately so it can use ON DELETE SET NULL
ALTER TABLE incidents
    ADD CONSTRAINT fk_incidents_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users (user_id) ON DELETE SET NULL;

CREATE INDEX idx_incidents_status_severity ON incidents (status, severity);
CREATE INDEX idx_incidents_open_assignee   ON incidents (assigned_to)
    WHERE status NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX idx_incidents_created_at      ON incidents (created_at DESC);
CREATE INDEX idx_incidents_search          ON incidents USING GIN (search_tsv);

-- Assets involved in an incident (M:N)
CREATE TABLE incident_assets (
    incident_id INT NOT NULL REFERENCES incidents (incident_id) ON DELETE CASCADE,
    asset_id    INT NOT NULL REFERENCES assets (asset_id) ON DELETE RESTRICT,
    impact      VARCHAR(12) NOT NULL CHECK (impact IN ('TARGETED', 'AFFECTED', 'COMPROMISED')),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (incident_id, asset_id)
);

CREATE INDEX idx_incident_assets_asset ON incident_assets (asset_id);

-- Every status change, written by trigger
CREATE TABLE incident_status_history (
    history_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents (incident_id) ON DELETE CASCADE,
    old_status  incident_status,
    new_status  incident_status NOT NULL,
    changed_by  INT REFERENCES users (user_id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    note        VARCHAR(500)
);

CREATE INDEX idx_status_history_incident ON incident_status_history (incident_id, changed_at);

-- Response playbooks and their ordered steps
CREATE TABLE playbooks (
    playbook_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    category    incident_category,              -- NULL means usable for any category
    description TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  INT REFERENCES users (user_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE playbook_steps (
    playbook_id      INT      NOT NULL REFERENCES playbooks (playbook_id) ON DELETE CASCADE,
    step_no          SMALLINT NOT NULL CHECK (step_no > 0),
    title            VARCHAR(150) NOT NULL,
    instructions     TEXT NOT NULL,
    expected_minutes INT  NOT NULL CHECK (expected_minutes BETWEEN 1 AND 10080),
    PRIMARY KEY (playbook_id, step_no)
);

-- Tasks on an incident, either created from a playbook or added by hand
CREATE TABLE incident_tasks (
    task_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id  INT NOT NULL REFERENCES incidents (incident_id) ON DELETE CASCADE,
    playbook_id  INT,
    step_no      SMALLINT,
    title        VARCHAR(150) NOT NULL CHECK (length(trim(title)) >= 3),
    details      TEXT,
    status       VARCHAR(10) NOT NULL DEFAULT 'TODO'
                 CHECK (status IN ('TODO', 'DOING', 'DONE', 'SKIPPED')),
    assigned_to  INT REFERENCES users (user_id) ON DELETE SET NULL,
    due_at       TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_tasks_playbook_step FOREIGN KEY (playbook_id, step_no)
        REFERENCES playbook_steps (playbook_id, step_no) ON DELETE SET NULL,
    CONSTRAINT chk_playbook_step_pair CHECK ((playbook_id IS NULL) = (step_no IS NULL)),
    CONSTRAINT chk_completed_matches_status CHECK (
        (status IN ('DONE', 'SKIPPED')) = (completed_at IS NOT NULL)),
    CONSTRAINT uq_task_playbook_step UNIQUE (incident_id, playbook_id, step_no)
);

CREATE INDEX idx_tasks_incident ON incident_tasks (incident_id);
CREATE INDEX idx_tasks_open_assignee ON incident_tasks (assigned_to)
    WHERE status IN ('TODO', 'DOING');

-- Row-level audit trail, written by trigger
CREATE TABLE audit_log (
    audit_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(63) NOT NULL,
    record_id  VARCHAR(64) NOT NULL,
    action     VARCHAR(6)  NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_id   INT REFERENCES users (user_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_data   JSONB,
    new_data   JSONB
);

CREATE INDEX idx_audit_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_changed_at   ON audit_log (changed_at DESC);
