
-- ============================================================================
-- Threat Intelligence Tests
-- Member B: Threat Intelligence
-- All test data is rolled back at the end.
-- Run:
-- psql "$DATABASE_URL" -f db/tests/02_intel_tests.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- Load the shared test helper functions.
\ir 00_test_helpers.sql

BEGIN;

-- ============================================================================
-- Test fixtures: create a test user and use its actual generated ID.
-- ============================================================================

INSERT INTO users (full_name, email, password_hash, role_id)
VALUES (
    'Intel Test User',
    'intel.test@cirt.test',
    crypt('IntelTest!123', gen_salt('bf', 10)),
    1
)
RETURNING user_id AS intel_test_user_id \gset

SELECT set_config(
    'app.current_user_id',
    :'intel_test_user_id',
    true
);

SELECT set_config(
    'app.intel_test_user_id',
    :'intel_test_user_id',
    true
);

-- ============================================================================
-- Test 1: Add a valid IP address indicator.
-- ============================================================================

DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'IP'
      AND lower(value) = lower('192.168.10.25');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'IP', '192.168.10.25', NULL, 90,
            'Automated test',
            current_setting('app.intel_test_user_id')::INT,
            CURRENT_TIMESTAMP, NULL, NULL
        );
    END IF;

    PERFORM pg_temp.check(
        v_indicator_id IS NOT NULL,
        'Test 1: Valid IP indicator can be added'
    );
END;
$$;

-- ============================================================================
-- Test 2: Add a valid domain indicator.
-- ============================================================================

DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'DOMAIN'
      AND lower(value) = lower('test-malicious-example.com');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'DOMAIN', 'test-malicious-example.com', NULL, 85,
            'Automated test',
            current_setting('app.intel_test_user_id')::INT,
            CURRENT_TIMESTAMP, NULL, NULL
        );
    END IF;

    PERFORM pg_temp.check(
        v_indicator_id IS NOT NULL,
        'Test 2: Valid domain indicator can be added'
    );
END;
$$;

-- ============================================================================
-- Test 3: Reject an invalid IP address.
-- ============================================================================

SELECT pg_temp.expect_error(
    $$SELECT fn_add_indicator(
        'IP', 'not-an-ip', NULL, 90,
        'Automated test',
        current_setting('app.intel_test_user_id')::INT,
        CURRENT_TIMESTAMP, NULL, NULL
    )$$,
    'Test 3: Invalid IP address is rejected'
);

-- ============================================================================
-- Test 4: Add a valid URL indicator.
-- ============================================================================

DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'URL'
      AND lower(value) = lower('https://test-example.com/login');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'URL', 'https://test-example.com/login', NULL, 85,
            'Automated test',
            current_setting('app.intel_test_user_id')::INT,
            CURRENT_TIMESTAMP, NULL, NULL
        );
    END IF;

    PERFORM pg_temp.check(
        v_indicator_id IS NOT NULL,
        'Test 4: Valid URL indicator can be added'
    );
END;
$$;

-- ============================================================================
-- Test 5: Add a valid SHA256 hash.
-- ============================================================================

DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'HASH'
      AND lower(value) = lower(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      );

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'HASH',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'SHA256',
            95,
            'Automated test',
            current_setting('app.intel_test_user_id')::INT,
            CURRENT_TIMESTAMP, NULL, NULL
        );
    END IF;

    PERFORM pg_temp.check(
        v_indicator_id IS NOT NULL,
        'Test 5: Valid SHA256 hash can be added'
    );
END;
$$;

-- ============================================================================
-- Test 6: Reject an invalid SHA256 hash.
-- ============================================================================

SELECT pg_temp.expect_error(
    $$SELECT fn_add_indicator(
        'HASH', '12345', 'SHA256', 90,
        'Automated test',
        current_setting('app.intel_test_user_id')::INT,
        CURRENT_TIMESTAMP, NULL, NULL
    )$$,
    'Test 6: Invalid SHA256 hash is rejected'
);

-- ============================================================================
-- Test 7: Reject confidence greater than 100.
-- ============================================================================

SELECT pg_temp.expect_error(
    $$SELECT fn_add_indicator(
        'DOMAIN', 'invalid-confidence-example.com', NULL, 150,
        'Automated test',
        current_setting('app.intel_test_user_id')::INT,
        CURRENT_TIMESTAMP, NULL, NULL
    )$$,
    'Test 7: Confidence above 100 is rejected'
);

-- ============================================================================
-- Test 8: Reject negative confidence.
-- ============================================================================

SELECT pg_temp.expect_error(
    $$SELECT fn_add_indicator(
        'DOMAIN', 'negative-confidence-example.com', NULL, -10,
        'Automated test',
        current_setting('app.intel_test_user_id')::INT,
        CURRENT_TIMESTAMP, NULL, NULL
    )$$,
    'Test 8: Negative confidence is rejected'
);

-- ============================================================================
-- Test 9: Create a threat actor and link an indicator.
-- ============================================================================

DO $$
DECLARE
    v_actor_id INT;
    v_indicator_id INT;
    v_count INT;
BEGIN
    SELECT indicator_id INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'DOMAIN'
      AND value = 'test-malicious-example.com';

    IF v_indicator_id IS NULL THEN
        RAISE EXCEPTION 'Test 9 failed: Test indicator does not exist';
    END IF;

    SELECT actor_id INTO v_actor_id
    FROM threat_actors
    WHERE name = 'TEST_APT_GROUP';

    IF v_actor_id IS NULL THEN
        INSERT INTO threat_actors (
            name, description, motivation
        )
        VALUES (
            'TEST_APT_GROUP',
            'Automated test threat actor',
            'Espionage'
        )
        RETURNING actor_id INTO v_actor_id;
    END IF;

    PERFORM fn_link_indicator_to_actor(
        v_actor_id,
        v_indicator_id,
        90,
        'Automated test'
    );

    SELECT COUNT(*) INTO v_count
    FROM threat_actor_indicators
    WHERE actor_id = v_actor_id
      AND indicator_id = v_indicator_id;

    PERFORM pg_temp.check(
        v_count = 1,
        'Test 9: Threat actor is linked to the indicator'
    );
END;
$$;

-- ============================================================================
-- Test 10: Retrieve indicators associated with a threat actor.
-- ============================================================================

DO $$
DECLARE
    v_actor_id INT;
    v_count INT;
BEGIN
    SELECT actor_id INTO v_actor_id
    FROM threat_actors
    WHERE name = 'TEST_APT_GROUP';

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Test 10 failed: Test actor does not exist';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM fn_get_actor_indicators(v_actor_id)
    WHERE indicator_value = 'test-malicious-example.com';

    PERFORM pg_temp.check(
        v_count = 1,
        'Test 10: Actor indicators are retrieved successfully'
    );
END;
$$;

-- ============================================================================
-- Roll back all test data.
-- ============================================================================

ROLLBACK;
