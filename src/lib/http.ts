import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Friendly text for the CHECK constraints a user is most likely to hit from a form
const CONSTRAINT_MESSAGES: Record<string, string> = {
  users_email_check: "Email address is not valid",
  users_email_key: "A user with this email already exists",
  users_full_name_check: "Name must be at least 2 characters",
  incidents_title_check: "Title must be at least 5 characters",
  incidents_description_check: "Description must be at least 20 characters",
  chk_detected_not_future: "Detection time cannot be in the future",
  chk_resolution_required: "A resolution summary of at least 10 characters is required to resolve or close",
  incidents_source_alert_id_key: "This alert has already been turned into an incident",
  assets_hostname_key: "An asset with this hostname already exists",
  assets_hostname_check: "Hostname must be lower-case letters, digits, dots and hyphens",
  uq_assets_ip: "An asset with this IP address already exists",
  playbooks_name_key: "A playbook with this name already exists",
  incident_assets_pkey: "That asset is already linked to this incident",
};

// Foreign key failures read differently depending on direction:
// "still referenced" (delete of a parent) vs "not present" (insert of a child)
const FK_IN_USE: Record<string, string> = {
  incidents_reported_by_fkey: "This user has reported incidents and cannot be deleted; deactivate them instead",
  incident_assets_asset_id_fkey: "This asset is linked to incidents and cannot be deleted",
};
const FK_MISSING: Record<string, string> = {
  incident_assets_asset_id_fkey: "The selected asset does not exist",
  incident_tasks_assigned_to_fkey: "The selected user does not exist",
  fk_incidents_assigned_to: "The selected user does not exist",
};

type PgError = { code?: string; constraint?: string; message: string; detail?: string };

function isPgError(e: unknown): e is PgError {
  return typeof e === "object" && e !== null && "code" in e && typeof (e as PgError).code === "string";
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".");
    return NextResponse.json(
      { error: field ? `${field}: ${first.message}` : first?.message ?? "Invalid input", issues: err.issues },
      { status: 400 },
    );
  }
  if (isPgError(err)) {
    if (err.code === "23503" && err.constraint) {
      if (err.detail?.includes("is not present")) {
        return NextResponse.json({ error: FK_MISSING[err.constraint] ?? "A referenced record does not exist" }, { status: 400 });
      }
      return NextResponse.json({ error: FK_IN_USE[err.constraint] ?? "This record is still in use elsewhere" }, { status: 409 });
    }
    const friendly = err.constraint ? CONSTRAINT_MESSAGES[err.constraint] : undefined;
    const message = friendly ?? err.message;
    switch (err.code) {
      case "23514": // check_violation (also raised by our triggers)
      case "23502": // not_null_violation
      case "22P02": // invalid_text_representation, e.g. bad enum value
      case "22001": // string too long
      case "22007": // invalid datetime
      case "22023": // invalid_parameter_value
        return NextResponse.json({ error: message }, { status: 400 });
      case "23505": // unique_violation
      case "23503": // foreign_key_violation
        return NextResponse.json({ error: message }, { status: 409 });
      case "P0002": // no_data_found
        return NextResponse.json({ error: message }, { status: 404 });
      case "42501": // insufficient_privilege
        return NextResponse.json({ error: message }, { status: 403 });
    }
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler so every thrown error becomes a JSON response with the right status. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function parseId(raw: string, label = "id"): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${label}`);
  return n;
}
