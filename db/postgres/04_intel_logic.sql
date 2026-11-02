
-- ============================================================================
-- Threat Intelligence Logic
-- ============================================================================


-- ============================================================================
-- 1. Automatically updates the updated_at timestamp.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_intel_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- 2. Validates and normalizes indicator values.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validate_indicator()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Remove unnecessary spaces.
    NEW.value := trim(NEW.value);

    -- Reject empty values.
    IF NEW.value = '' THEN
        RAISE EXCEPTION 'Indicator value cannot be empty';
    END IF;


    -- Validate IP addresses.
    IF NEW.indicator_type = 'IP' THEN

        -- Only individual IP addresses are allowed.
        IF NEW.value LIKE '%/%' THEN
            RAISE EXCEPTION
                'Enter a single IP address, not a network range';
        END IF;

        BEGIN
            NEW.value := host(NEW.value::inet);

        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION
                    'Invalid IP address: %', NEW.value;
        END;


    -- Validate domain names.
    ELSIF NEW.indicator_type = 'DOMAIN' THEN

        NEW.value := lower(NEW.value);

        IF length(NEW.value) > 253
           OR NEW.value !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'
           OR NEW.value LIKE '%..%'
           OR EXISTS (
                SELECT 1
                FROM unnest(string_to_array(NEW.value, '.')) AS label
                WHERE length(label) > 63
                   OR label = ''
                   OR label LIKE '-%'
                   OR label LIKE '%-'
           )
        THEN
            RAISE EXCEPTION 'Invalid domain name: %', NEW.value;
        END IF;


    -- Validate URLs.
    ELSIF NEW.indicator_type = 'URL' THEN

        IF NEW.value !~* '^https?://[^[:space:]]+$' THEN
            RAISE EXCEPTION 'Invalid URL: %', NEW.value;
        END IF;


    -- Normalize hash values.
    ELSIF NEW.indicator_type = 'HASH' THEN

        NEW.value := lower(NEW.value);

    END IF;

    RETURN NEW;
END;
$$;


-- ============================================================================
-- 3. Automatically update threat actor timestamps.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_threat_actors_updated_at
ON threat_actors;

CREATE TRIGGER trg_threat_actors_updated_at
BEFORE UPDATE ON threat_actors
FOR EACH ROW
EXECUTE FUNCTION fn_intel_set_updated_at();


-- ============================================================================
-- 4. Automatically update indicator timestamps.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_indicators_updated_at
ON indicators;

CREATE TRIGGER trg_indicators_updated_at
BEFORE UPDATE ON indicators
FOR EACH ROW
EXECUTE FUNCTION fn_intel_set_updated_at();


-- ============================================================================
-- 5. Validate indicators before insertion or modification.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_validate_indicator
ON indicators;

CREATE TRIGGER trg_validate_indicator
BEFORE INSERT OR UPDATE OF indicator_type, value, hash_algorithm
ON indicators
FOR EACH ROW
EXECUTE FUNCTION fn_validate_indicator();


-- ============================================================================
-- 6. Adds a new indicator of compromise (IOC).
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_add_indicator(
    p_indicator_type VARCHAR(20),
    p_value TEXT,
    p_hash_algorithm VARCHAR(10) DEFAULT NULL,
    p_confidence INT DEFAULT 50,
    p_source VARCHAR(255) DEFAULT NULL,
    p_created_by INT DEFAULT NULL,
    p_first_seen TIMESTAMPTZ DEFAULT NULL,
    p_last_seen TIMESTAMPTZ DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_indicator_id INT;
BEGIN
    INSERT INTO indicators (
        indicator_type,
        value,
        hash_algorithm,
        confidence,
        source,
        created_by,
        first_seen,
        last_seen,
        expires_at
    )
    VALUES (
        p_indicator_type,
        p_value,
        p_hash_algorithm,
        p_confidence,
        p_source,
        p_created_by,
        p_first_seen,
        p_last_seen,
        p_expires_at
    )
    RETURNING indicator_id INTO v_indicator_id;

    RETURN v_indicator_id;
END;
$$;


-- ============================================================================
-- 7. Links an indicator to a threat actor.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_link_indicator_to_actor(
    p_actor_id INT,
    p_indicator_id INT,
    p_confidence INT DEFAULT 50,
    p_source VARCHAR(255) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO threat_actor_indicators (
        actor_id,
        indicator_id,
        confidence,
        source
    )
    VALUES (
        p_actor_id,
        p_indicator_id,
        p_confidence,
        p_source
    )
    ON CONFLICT (actor_id, indicator_id)
    DO UPDATE SET
        confidence = EXCLUDED.confidence,
        source = EXCLUDED.source,
        observed_at = now();
END;
$$;


-- ============================================================================
-- 8. Links an indicator to a security incident.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_link_indicator_to_incident(
    p_incident_id INT,
    p_indicator_id INT,
    p_relationship VARCHAR(100) DEFAULT 'RELATED',
    p_evidence TEXT DEFAULT NULL,
    p_linked_by INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO incident_indicators (
        incident_id,
        indicator_id,
        relationship,
        evidence,
        linked_by
    )
    VALUES (
        p_incident_id,
        p_indicator_id,
        p_relationship,
        p_evidence,
        p_linked_by
    )
    ON CONFLICT (incident_id, indicator_id)
    DO UPDATE SET
        relationship = EXCLUDED.relationship,
        evidence = EXCLUDED.evidence,
        linked_by = EXCLUDED.linked_by,
        linked_at = now();
END;
$$;


-- ============================================================================
-- 9. Retrieves all indicators associated with a threat actor.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_actor_indicators(
    p_actor_id INT
)
RETURNS TABLE (
    indicator_id INT,
    indicator_type VARCHAR(20),
    indicator_value TEXT,
    confidence INT,
    source VARCHAR(255),
    observed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.indicator_id,
        i.indicator_type,
        i.value,
        tai.confidence,
        tai.source,
        tai.observed_at
    FROM threat_actor_indicators tai
    JOIN indicators i
        ON i.indicator_id = tai.indicator_id
    WHERE tai.actor_id = p_actor_id
    ORDER BY tai.observed_at DESC;
END;
$$;


-- ============================================================================
-- 10. Retrieves all indicators associated with a security incident.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_incident_indicators(
    p_incident_id INT
)
RETURNS TABLE (
    indicator_id INT,
    indicator_type VARCHAR(20),
    indicator_value TEXT,
    relationship VARCHAR(100),
    evidence TEXT,
    linked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.indicator_id,
        i.indicator_type,
        i.value,
        ii.relationship,
        ii.evidence,
        ii.linked_at
    FROM incident_indicators ii
    JOIN indicators i
        ON i.indicator_id = ii.indicator_id
    WHERE ii.incident_id = p_incident_id
    ORDER BY ii.linked_at DESC;
END;
$$;
