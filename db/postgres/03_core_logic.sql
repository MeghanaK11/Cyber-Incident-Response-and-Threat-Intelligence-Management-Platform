-- Member A: Kallepalli Sai Meghana (PES1UG24AM911)
-- Functions, triggers, stored procedures and views for the incident response core.
--
-- The application opens a transaction and runs
--     SELECT set_config('app.current_user_id', '<id>', true);
-- so triggers know which user made the change. 'app.status_note' carries an
-- optional comment for the status history. 'app.event_time' lets seed scripts
-- replay historical events with their real timestamps; the app never sets it.

-- Helpers ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_current_actor() RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::INT
$$;

CREATE OR REPLACE FUNCTION fn_event_time() RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('app.event_time', true), '')::TIMESTAMPTZ, now())
$$;

-- Generic audit trigger. TG_ARGV[0] is the primary key column name.
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old := to_jsonb(OLD) - 'password_hash' - 'search_tsv';
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new := to_jsonb(NEW) - 'password_hash' - 'search_tsv';
    END IF;

    -- skip updates that changed nothing except updated_at
    IF TG_OP = 'UPDATE' AND (v_old - 'updated_at') = (v_new - 'updated_at') THEN
        RETURN NULL;
    END IF;

    INSERT INTO audit_log (table_name, record_id, action, actor_id, changed_at, old_data, new_data)
    VALUES (TG_TABLE_NAME,
            COALESCE(v_new, v_old) ->> TG_ARGV[0],
            TG_OP,
            fn_current_actor(),
            fn_event_time(),
            v_old,
            v_new);
    RETURN NULL;
END;
$$;

-- Incident triggers -------------------------------------------------------------

-- Reference code, SLA deadlines and initial status on insert
CREATE OR REPLACE FUNCTION fn_incident_before_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_sla severity_sla%ROWTYPE;
BEGIN
    IF NEW.status <> 'NEW' THEN
        RAISE EXCEPTION 'New incidents must start in status NEW (got %)', NEW.status
            USING ERRCODE = 'check_violation';
    END IF;

    NEW.created_at := COALESCE(NULLIF(current_setting('app.event_time', true), '')::TIMESTAMPTZ, NEW.created_at);
    NEW.updated_at := NEW.created_at;
    NEW.reference_code := 'INC-' || to_char(NEW.created_at, 'YYYY') || '-' || lpad(NEW.incident_id::TEXT, 6, '0');

    SELECT * INTO v_sla FROM severity_sla WHERE severity = NEW.severity;
    NEW.respond_by := NEW.created_at + v_sla.respond_within;
    NEW.resolve_by := NEW.created_at + v_sla.resolve_within;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_before_insert
BEFORE INSERT ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_incident_before_insert();

-- Status workflow, SLA recalculation and timestamps on update
CREATE OR REPLACE FUNCTION fn_incident_before_update() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_now        TIMESTAMPTZ := fn_event_time();
    v_sla        severity_sla%ROWTYPE;
    v_open_tasks INT;
BEGIN
    NEW.updated_at := v_now;

    -- An escalation or de-escalation restarts the SLA clock for an unresolved incident
    IF NEW.severity IS DISTINCT FROM OLD.severity AND NEW.resolved_at IS NULL THEN
        SELECT * INTO v_sla FROM severity_sla WHERE severity = NEW.severity;
        IF NEW.first_response_at IS NULL THEN
            NEW.respond_by := v_now + v_sla.respond_within;
        END IF;
        NEW.resolve_by := v_now + v_sla.resolve_within;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT EXISTS (SELECT 1 FROM incident_status_transitions
                       WHERE from_status = OLD.status AND to_status = NEW.status) THEN
            RAISE EXCEPTION 'Status change % -> % is not allowed', OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.status IN ('IN_PROGRESS', 'CONTAINED') AND NEW.assigned_to IS NULL THEN
            RAISE EXCEPTION 'Incident % must be assigned before moving to %', OLD.reference_code, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.status = 'RESOLVED' THEN
            SELECT count(*) INTO v_open_tasks
            FROM incident_tasks
            WHERE incident_id = NEW.incident_id AND status IN ('TODO', 'DOING');
            IF v_open_tasks > 0 THEN
                RAISE EXCEPTION 'Incident % still has % open task(s)', OLD.reference_code, v_open_tasks
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;

        IF OLD.status = 'NEW' AND NEW.first_response_at IS NULL THEN
            NEW.first_response_at := v_now;
        END IF;

        CASE NEW.status
            WHEN 'RESOLVED' THEN
                NEW.resolved_at := v_now;
            WHEN 'CLOSED' THEN
                NEW.closed_at := v_now;
            WHEN 'TRIAGED', 'IN_PROGRESS' THEN
                IF OLD.status IN ('RESOLVED', 'CLOSED') THEN   -- reopened
                    NEW.resolved_at := NULL;
                    NEW.closed_at   := NULL;
                END IF;
            ELSE
                NULL;
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_before_update
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_incident_before_update();

-- Only active ADMIN or ANALYST users can own an incident
CREATE OR REPLACE FUNCTION fn_check_assignee() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = NEW.assigned_to
          AND u.is_active
          AND r.role_name IN ('ADMIN', 'ANALYST')) THEN
        RAISE EXCEPTION 'User % cannot be assigned: must be an active ADMIN or ANALYST', NEW.assigned_to
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_check_assignee
BEFORE INSERT OR UPDATE OF assigned_to ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_check_assignee();

CREATE TRIGGER trg_task_check_assignee
BEFORE INSERT OR UPDATE OF assigned_to ON incident_tasks
FOR EACH ROW EXECUTE FUNCTION fn_check_assignee();

-- Status history row for every insert and status change
CREATE OR REPLACE FUNCTION fn_log_status_change() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO incident_status_history (incident_id, old_status, new_status, changed_by, changed_at, note)
        VALUES (NEW.incident_id,
                CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
                NEW.status,
                COALESCE(fn_current_actor(), CASE WHEN TG_OP = 'INSERT' THEN NEW.reported_by END),
                fn_event_time(),
                NULLIF(current_setting('app.status_note', true), ''));
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_incident_status_history
AFTER INSERT OR UPDATE OF status ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_log_status_change();

-- Task completion timestamps
CREATE OR REPLACE FUNCTION fn_task_completion() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('DONE', 'SKIPPED') THEN
        IF TG_OP = 'INSERT' OR OLD.status NOT IN ('DONE', 'SKIPPED') THEN
            NEW.completed_at := fn_event_time();
        END IF;
    ELSE
        NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_completion
BEFORE INSERT OR UPDATE OF status ON incident_tasks
FOR EACH ROW EXECUTE FUNCTION fn_task_completion();

-- Audit triggers
CREATE TRIGGER trg_audit_users     AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('user_id');
CREATE TRIGGER trg_audit_assets    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('asset_id');
CREATE TRIGGER trg_audit_incidents AFTER INSERT OR UPDATE OR DELETE ON incidents
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('incident_id');
CREATE TRIGGER trg_audit_playbooks AFTER INSERT OR UPDATE OR DELETE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('playbook_id');
CREATE TRIGGER trg_audit_tasks     AFTER INSERT OR UPDATE OR DELETE ON incident_tasks
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('task_id');

-- Functions and procedures --------------------------------------------------------

-- Analyst with the lightest open workload, weighted by severity
CREATE OR REPLACE FUNCTION fn_pick_analyst() RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT u.user_id
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    LEFT JOIN incidents i
           ON i.assigned_to = u.user_id
          AND i.status NOT IN ('RESOLVED', 'CLOSED')
    WHERE r.role_name = 'ANALYST' AND u.is_active
    GROUP BY u.user_id
    ORDER BY COALESCE(SUM(CASE i.severity
                              WHEN 'CRITICAL' THEN 8
                              WHEN 'HIGH'     THEN 4
                              WHEN 'MEDIUM'   THEN 2
                              WHEN 'LOW'      THEN 1 END), 0),
             u.user_id
    LIMIT 1
$$;

-- Assign an incident. Passing NULL picks the least-loaded analyst.
-- Open tasks held by the previous owner move to the new owner.
CREATE OR REPLACE PROCEDURE sp_assign_incident(
    p_incident_id INT,
    INOUT p_assignee INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_old_assignee INT;
    v_status       incident_status;
BEGIN
    SELECT assigned_to, status INTO v_old_assignee, v_status
    FROM incidents WHERE incident_id = p_incident_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % not found', p_incident_id USING ERRCODE = 'no_data_found';
    END IF;
    IF v_status IN ('RESOLVED', 'CLOSED') THEN
        RAISE EXCEPTION 'Cannot reassign a % incident', v_status USING ERRCODE = 'check_violation';
    END IF;

    IF p_assignee IS NULL THEN
        p_assignee := fn_pick_analyst();
        IF p_assignee IS NULL THEN
            RAISE EXCEPTION 'No active analyst available' USING ERRCODE = 'no_data_found';
        END IF;
    END IF;

    UPDATE incidents SET assigned_to = p_assignee WHERE incident_id = p_incident_id;

    UPDATE incident_tasks
    SET assigned_to = p_assignee
    WHERE incident_id = p_incident_id
      AND status IN ('TODO', 'DOING')
      AND (assigned_to IS NULL OR assigned_to = v_old_assignee);
END;
$$;

-- Turn a playbook's steps into tasks on an incident. Runs as one unit: if any
-- check fails, no tasks are created. Due dates add up the expected minutes.
CREATE OR REPLACE PROCEDURE sp_apply_playbook(
    p_incident_id INT,
    p_playbook_id INT,
    INOUT p_tasks_created INT DEFAULT 0)
LANGUAGE plpgsql AS $$
DECLARE
    v_incident incidents%ROWTYPE;
    v_playbook playbooks%ROWTYPE;
    v_now      TIMESTAMPTZ := fn_event_time();
BEGIN
    SELECT * INTO v_incident FROM incidents WHERE incident_id = p_incident_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % not found', p_incident_id USING ERRCODE = 'no_data_found';
    END IF;
    IF v_incident.status IN ('RESOLVED', 'CLOSED') THEN
        RAISE EXCEPTION 'Cannot apply a playbook to a % incident', v_incident.status
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_playbook FROM playbooks WHERE playbook_id = p_playbook_id;
    IF NOT FOUND OR NOT v_playbook.is_active THEN
        RAISE EXCEPTION 'Playbook % not found or inactive', p_playbook_id USING ERRCODE = 'no_data_found';
    END IF;
    IF v_playbook.category IS NOT NULL AND v_playbook.category <> v_incident.category THEN
        RAISE EXCEPTION 'Playbook "%" is for % incidents, this incident is %',
            v_playbook.name, v_playbook.category, v_incident.category
            USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM incident_tasks
               WHERE incident_id = p_incident_id AND playbook_id = p_playbook_id) THEN
        RAISE EXCEPTION 'Playbook "%" is already applied to %', v_playbook.name, v_incident.reference_code
            USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO incident_tasks (incident_id, playbook_id, step_no, title, details, assigned_to, due_at, created_at)
    SELECT p_incident_id,
           s.playbook_id,
           s.step_no,
           s.title,
           s.instructions,
           v_incident.assigned_to,
           v_now + make_interval(mins => SUM(s.expected_minutes) OVER (ORDER BY s.step_no)::INT),
           v_now
    FROM playbook_steps s
    WHERE s.playbook_id = p_playbook_id
    ORDER BY s.step_no;

    GET DIAGNOSTICS p_tasks_created = ROW_COUNT;

    IF p_tasks_created = 0 THEN
        RAISE EXCEPTION 'Playbook "%" has no steps', v_playbook.name USING ERRCODE = 'no_data_found';
    END IF;

    IF v_incident.status = 'NEW' THEN
        UPDATE incidents SET status = 'TRIAGED' WHERE incident_id = p_incident_id;
    END IF;
END;
$$;

-- Views ---------------------------------------------------------------------------

-- One row per incident with people, SLA state and task progress
CREATE OR REPLACE VIEW v_incident_overview AS
SELECT i.incident_id,
       i.reference_code,
       i.title,
       i.category,
       i.severity,
       i.status,
       i.detected_at,
       i.created_at,
       i.updated_at,
       i.respond_by,
       i.resolve_by,
       i.first_response_at,
       i.resolved_at,
       i.closed_at,
       i.source_alert_id,
       rep.user_id   AS reporter_id,
       rep.full_name AS reporter_name,
       asg.user_id   AS assignee_id,
       asg.full_name AS assignee_name,
       CASE
           WHEN i.resolved_at IS NOT NULL THEN
               CASE WHEN i.resolved_at <= i.resolve_by THEN 'MET' ELSE 'BREACHED' END
           WHEN i.status = 'CLOSED' THEN 'NOT_APPLICABLE'
           WHEN now() > i.resolve_by THEN 'BREACHED'
           WHEN now() > i.resolve_by - (i.resolve_by - i.created_at) * 0.25 THEN 'AT_RISK'
           ELSE 'ON_TRACK'
       END AS sla_state,
       COALESCE(t.total_tasks, 0)::INT AS total_tasks,
       COALESCE(t.done_tasks, 0)::INT  AS done_tasks,
       COALESCE(a.asset_count, 0)::INT AS asset_count
FROM incidents i
JOIN users rep      ON rep.user_id = i.reported_by
LEFT JOIN users asg ON asg.user_id = i.assigned_to
LEFT JOIN (
    SELECT incident_id,
           count(*)                                          AS total_tasks,
           count(*) FILTER (WHERE status IN ('DONE', 'SKIPPED')) AS done_tasks
    FROM incident_tasks
    GROUP BY incident_id
) t ON t.incident_id = i.incident_id
LEFT JOIN (
    SELECT incident_id, count(*) AS asset_count
    FROM incident_assets
    GROUP BY incident_id
) a ON a.incident_id = i.incident_id;

-- Current load and track record per analyst
CREATE OR REPLACE VIEW v_analyst_workload AS
SELECT u.user_id,
       u.full_name,
       r.role_name,
       count(i.incident_id) FILTER (WHERE i.status NOT IN ('RESOLVED', 'CLOSED'))::INT
           AS open_incidents,
       count(i.incident_id) FILTER (WHERE i.status NOT IN ('RESOLVED', 'CLOSED') AND i.severity = 'CRITICAL')::INT
           AS open_critical,
       count(i.incident_id) FILTER (WHERE i.status NOT IN ('RESOLVED', 'CLOSED') AND now() > i.resolve_by)::INT
           AS open_breached,
       count(i.incident_id) FILTER (WHERE i.resolved_at >= now() - INTERVAL '30 days')::INT
           AS resolved_last_30d,
       round(avg(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600)
             FILTER (WHERE i.resolved_at IS NOT NULL)::NUMERIC, 1)
           AS avg_hours_to_resolve
FROM users u
JOIN roles r ON r.role_id = u.role_id
LEFT JOIN incidents i ON i.assigned_to = u.user_id
WHERE r.role_name IN ('ADMIN', 'ANALYST') AND u.is_active
GROUP BY u.user_id, u.full_name, r.role_name;

-- Monthly counts, mean time to respond / resolve, and SLA breach rate per category
CREATE OR REPLACE VIEW v_incident_monthly_stats AS
SELECT date_trunc('month', i.created_at)::DATE AS month,
       i.category,
       count(*)::INT AS incidents,
       (count(*) FILTER (WHERE i.severity IN ('HIGH', 'CRITICAL')))::INT AS high_or_critical,
       round(avg(EXTRACT(EPOCH FROM (i.first_response_at - i.created_at)) / 60)::NUMERIC, 1)
           AS mean_minutes_to_respond,
       round(avg(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600)::NUMERIC, 1)
           AS mean_hours_to_resolve,
       round(100.0 * count(*) FILTER (WHERE i.resolved_at > i.resolve_by)
             / NULLIF(count(*) FILTER (WHERE i.resolved_at IS NOT NULL), 0), 1)
           AS pct_resolved_late
FROM incidents i
GROUP BY 1, 2;
