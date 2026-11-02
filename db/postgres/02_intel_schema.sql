
-- ============================================================================
-- Threat Intelligence Schema
-- ============================================================================


-- ============================================================================
-- 1. THREAT ACTORS
-- Stores information about people or groups responsible for cyber attacks.
-- ============================================================================

CREATE TABLE threat_actors (
    actor_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    aliases TEXT[] NOT NULL DEFAULT '{}',

    description TEXT,

    motivation VARCHAR(100),

    first_seen TIMESTAMPTZ,

    last_seen TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by INT REFERENCES users(user_id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_actor_name
        CHECK (length(trim(name)) >= 2),

    CONSTRAINT chk_actor_dates
        CHECK (
            last_seen IS NULL
            OR first_seen IS NULL
            OR last_seen >= first_seen
        )
);

-- Prevent duplicate actor names, ignoring uppercase/lowercase differences.
CREATE UNIQUE INDEX uq_threat_actors_name
    ON threat_actors (lower(name));


-- ============================================================================
-- 2. INDICATORS OF COMPROMISE (IOCs)
-- Stores malicious IPs, domains, URLs and file hashes.
-- ============================================================================

CREATE TABLE indicators (
    indicator_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    indicator_type VARCHAR(20) NOT NULL,

    value TEXT NOT NULL,

    hash_algorithm VARCHAR(10),

    confidence INT NOT NULL DEFAULT 50,

    source VARCHAR(255),

    first_seen TIMESTAMPTZ,

    last_seen TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by INT REFERENCES users(user_id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_indicator_value
        CHECK (length(trim(value)) > 0),

    CONSTRAINT chk_indicator_type
        CHECK (indicator_type IN ('IP', 'DOMAIN', 'URL', 'HASH')),

    CONSTRAINT chk_indicator_confidence
        CHECK (confidence BETWEEN 0 AND 100),

    CONSTRAINT chk_hash_algorithm
        CHECK (
            (indicator_type = 'HASH'
                AND hash_algorithm IN ('MD5', 'SHA1', 'SHA256'))
            OR
            (indicator_type <> 'HASH'
                AND hash_algorithm IS NULL)
        ),

    CONSTRAINT chk_hash_value
        CHECK (
            indicator_type <> 'HASH'
            OR
            (
                hash_algorithm = 'MD5'
                AND value ~ '^[A-Fa-f0-9]{32}$'
            )
            OR
            (
                hash_algorithm = 'SHA1'
                AND value ~ '^[A-Fa-f0-9]{40}$'
            )
            OR
            (
                hash_algorithm = 'SHA256'
                AND value ~ '^[A-Fa-f0-9]{64}$'
            )
        ),

    CONSTRAINT chk_indicator_dates
        CHECK (
            last_seen IS NULL
            OR first_seen IS NULL
            OR last_seen >= first_seen
        ),

    CONSTRAINT chk_indicator_expiry
        CHECK (
            expires_at IS NULL
            OR first_seen IS NULL
            OR expires_at >= first_seen
        )
);

-- Prevent duplicate indicators of the same type, ignoring letter case.
CREATE UNIQUE INDEX uq_indicators_type_value
    ON indicators (indicator_type, lower(value));

-- Indexes to improve IOC searching and filtering.
CREATE INDEX idx_indicators_type
    ON indicators (indicator_type);

CREATE INDEX idx_indicators_active
    ON indicators (is_active);

CREATE INDEX idx_indicators_expires_at
    ON indicators (expires_at);


-- ============================================================================
-- 3. THREAT ACTOR INDICATORS
-- Connects threat actors with their known indicators.
-- ============================================================================

CREATE TABLE threat_actor_indicators (
    actor_id INT NOT NULL REFERENCES threat_actors(actor_id)
        ON DELETE CASCADE,

    indicator_id INT NOT NULL REFERENCES indicators(indicator_id)
        ON DELETE CASCADE,

    confidence INT NOT NULL DEFAULT 50,

    source VARCHAR(255),

    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (actor_id, indicator_id),

    CONSTRAINT chk_actor_indicator_confidence
        CHECK (confidence BETWEEN 0 AND 100)
);

-- Helps find all threat actors associated with an indicator.
CREATE INDEX idx_threat_actor_indicators_indicator
    ON threat_actor_indicators (indicator_id);


-- ============================================================================
-- 4. INCIDENT INDICATORS
-- Connects security incidents with their related indicators.
-- ============================================================================

CREATE TABLE incident_indicators (
    incident_id INT NOT NULL REFERENCES incidents(incident_id)
        ON DELETE CASCADE,

    indicator_id INT NOT NULL REFERENCES indicators(indicator_id)
        ON DELETE CASCADE,

    relationship VARCHAR(100) NOT NULL DEFAULT 'RELATED',

    evidence TEXT,

    linked_by INT REFERENCES users(user_id) ON DELETE SET NULL,

    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (incident_id, indicator_id),

    CONSTRAINT chk_incident_indicator_relationship
        CHECK (length(trim(relationship)) > 0)
);

-- Helps find all incidents associated with an indicator.
CREATE INDEX idx_incident_indicators_indicator
    ON incident_indicators (indicator_id);


-- ============================================================================
-- END OF THREAT INTELLIGENCE SCHEMA
-- ============================================================================
