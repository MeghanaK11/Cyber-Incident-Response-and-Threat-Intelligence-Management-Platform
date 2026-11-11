import { z } from "zod";
 
// App-side validation gives quick, readable errors. The database enforces the
// same rules again with CHECK constraints and triggers, so nothing slips through
// if a request bypasses these schemas.
 
export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "CONTAINED", "RESOLVED", "CLOSED"] as const;
export const CATEGORIES = [
  "MALWARE", "PHISHING", "RANSOMWARE", "DATA_BREACH", "DDOS",
  "UNAUTHORIZED_ACCESS", "INSIDER_THREAT", "VULNERABILITY_EXPLOIT", "OTHER",
] as const;
export const ROLES = ["ADMIN", "ANALYST", "VIEWER"] as const;
export const TASK_STATUSES = ["TODO", "DOING", "DONE", "SKIPPED"] as const;
export const ASSET_TYPES = [
  "SERVER", "WORKSTATION", "NETWORK_DEVICE", "CLOUD_INSTANCE", "DATABASE", "APPLICATION", "IOT",
] as const;
export const IMPACTS = ["TARGETED", "AFFECTED", "COMPROMISED"] as const;
 
const id = z.coerce.number().int().positive();
 
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required").max(200),
});
 
// At least 10 characters with a letter, a digit and a symbol
const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt limit
  .regex(/[A-Za-z]/, "Password needs a letter")
  .regex(/[0-9]/, "Password needs a digit")
  .regex(/[^A-Za-z0-9]/, "Password needs a symbol");
 
export const userCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  role: z.enum(ROLES),
  password,
});
 
// Public sign-up. Viewer needs no code. Analyst and Admin need their own code
// from .env (ANALYST_SIGNUP_CODE, ADMIN_SIGNUP_CODE), checked in the sign-up route.
export const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
    role: z.enum(ROLES).default("VIEWER"),
    role_code: z.string().max(200).optional(),
    password,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
 
export const userUpdateSchema = z
  .object({
    full_name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(ROLES).optional(),
    is_active: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
 
export const incidentCreateSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(20000),
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  detected_at: z.coerce.date(),
  assets: z
    .array(z.object({ asset_id: id, impact: z.enum(IMPACTS) }))
    .max(50)
    .default([]),
  auto_assign: z.boolean().default(false),
});
 
export const incidentUpdateSchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    description: z.string().trim().min(20).max(20000).optional(),
    category: z.enum(CATEGORIES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    status: z.enum(STATUSES).optional(),
    resolution_summary: z.string().trim().min(10).max(20000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "note"), "Nothing to update");
 
export const assignSchema = z.object({
  assignee_id: id.nullable(), // null = pick the least-loaded analyst
});
 
export const applyPlaybookSchema = z.object({ playbook_id: id });
 
export const taskCreateSchema = z.object({
  title: z.string().trim().min(3).max(150),
  details: z.string().trim().max(5000).optional(),
  assigned_to: id.nullable().optional(),
  due_at: z.coerce.date().nullable().optional(),
});
 
export const taskUpdateSchema = z
  .object({
    status: z.enum(TASK_STATUSES).optional(),
    assigned_to: id.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
 
export const incidentAssetSchema = z.object({ asset_id: id, impact: z.enum(IMPACTS) });
 
export const incidentListSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  assignee: z.union([z.literal("me"), z.literal("none"), id]).optional(),
  sla: z.enum(["ON_TRACK", "AT_RISK", "BREACHED", "MET"]).optional(),
  open: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "oldest", "severity", "deadline"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20),
});
 
export type IncidentListParams = z.infer<typeof incidentListSchema>;
 
// --- Assets -------------------------------------------------------------------
 
const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, "Use letters, digits, dots and hyphens");
 
const ipAddress = z
  .string()
  .trim()
  .refine((v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || /^[0-9a-fA-F:]+$/.test(v), "Not a valid IP address");
 
export const assetCreateSchema = z.object({
  hostname,
  ip_address: ipAddress.nullable().optional(),
  asset_type: z.enum(ASSET_TYPES),
  operating_system: z.string().trim().max(60).nullable().optional(),
  department: z.string().trim().min(2).max(60),
  criticality: z.coerce.number().int().min(1).max(5),
  is_internet_facing: z.boolean().default(false),
});
 
export const assetUpdateSchema = assetCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
 
// --- Playbooks -----------------------------------------------------------------
 
export const playbookStepSchema = z.object({
  title: z.string().trim().min(3).max(150),
  instructions: z.string().trim().min(5).max(5000),
  expected_minutes: z.coerce.number().int().min(1).max(10080),
});
 
export const playbookCreateSchema = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.enum(CATEGORIES).nullable(),
  description: z.string().trim().min(10).max(5000),
  steps: z.array(playbookStepSchema).min(1, "Add at least one step").max(30),
});
 
export const playbookUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    category: z.enum(CATEGORIES).nullable().optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
 
export const playbookStepsSchema = z.object({
  steps: z.array(playbookStepSchema).min(1, "Add at least one step").max(30),
});
 