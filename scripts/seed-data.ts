// Reference content for the demo seed. Everything here describes a fictional
// organisation. Attacker IPs use the documentation ranges reserved by RFC 5737
// (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), so none of them point at a
// real host.

export const ASSETS = [
  { hostname: "mail-gw-01.corp.internal", ip: "10.20.0.5", type: "SERVER", os: "Ubuntu 22.04", dept: "IT Infrastructure", crit: 5, internet: true },
  { hostname: "vpn-gw-01.corp.internal", ip: "10.20.0.2", type: "NETWORK_DEVICE", os: "Linux appliance", dept: "IT Infrastructure", crit: 5, internet: true },
  { hostname: "web-portal-01.corp.internal", ip: "10.30.0.10", type: "SERVER", os: "RHEL 9", dept: "Customer Services", crit: 5, internet: true },
  { hostname: "api-gw-01.corp.internal", ip: "10.30.0.20", type: "APPLICATION", os: "Kubernetes 1.30", dept: "Engineering", crit: 4, internet: true },
  { hostname: "db-core-01.corp.internal", ip: "10.50.0.11", type: "DATABASE", os: "PostgreSQL 15 on RHEL 9", dept: "Engineering", crit: 5, internet: false },
  { hostname: "dc-01.corp.internal", ip: "10.10.0.10", type: "SERVER", os: "Windows Server 2022", dept: "IT Infrastructure", crit: 5, internet: false },
  { hostname: "fs-finance-01.corp.internal", ip: "10.40.0.21", type: "SERVER", os: "Windows Server 2022", dept: "Finance", crit: 4, internet: false },
  { hostname: "hr-app-01.corp.internal", ip: "10.40.0.31", type: "APPLICATION", os: "Windows Server 2019", dept: "Human Resources", crit: 4, internet: false },
  { hostname: "backup-01.corp.internal", ip: "10.50.0.40", type: "SERVER", os: "Ubuntu 22.04", dept: "IT Infrastructure", crit: 4, internet: false },
  { hostname: "archive-bucket.corp.internal", ip: null, type: "CLOUD_INSTANCE", os: null, dept: "Engineering", crit: 4, internet: true },
  { hostname: "fin-ws-114.corp.internal", ip: "10.40.1.114", type: "WORKSTATION", os: "Windows 11", dept: "Finance", crit: 3, internet: false },
  { hostname: "fin-ws-122.corp.internal", ip: "10.40.1.122", type: "WORKSTATION", os: "Windows 11", dept: "Finance", crit: 3, internet: false },
  { hostname: "hr-ws-031.corp.internal", ip: "10.40.2.31", type: "WORKSTATION", os: "Windows 11", dept: "Human Resources", crit: 2, internet: false },
  { hostname: "eng-lt-207.corp.internal", ip: "10.60.1.207", type: "WORKSTATION", os: "macOS 14", dept: "Engineering", crit: 3, internet: false },
  { hostname: "eng-lt-219.corp.internal", ip: "10.60.1.219", type: "WORKSTATION", os: "Ubuntu 24.04", dept: "Engineering", crit: 3, internet: false },
  { hostname: "cctv-nvr-01.corp.internal", ip: "10.70.0.5", type: "IOT", os: "Embedded Linux", dept: "Facilities", crit: 2, internet: false },
];

type Step = [title: string, instructions: string, minutes: number];
type PlaybookDef = { name: string; category: string | null; description: string; steps: Step[] };

// Steps follow the NIST SP 800-61 phases: detection and analysis, containment,
// eradication, recovery, post-incident activity.
export const PLAYBOOKS: PlaybookDef[] = [
  {
    name: "Credential phishing response",
    category: "PHISHING",
    description: "Contain a phishing campaign, find who clicked, and reset exposed credentials.",
    steps: [
      ["Collect the reported email and headers", "Save the original message with full headers. Note sender, return path, links and attachments.", 15],
      ["Purge the message from all mailboxes", "Run a mailbox search on sender and subject and delete every copy.", 20],
      ["Block sender, URLs and IPs", "Add the sender domain to the mail gateway blocklist and the URLs and IPs to the web proxy.", 20],
      ["Identify users who clicked", "Check proxy logs for the phishing URL and sign-in logs for logins from new locations.", 30],
      ["Reset credentials and revoke sessions", "Force a password reset and revoke all active sessions and refresh tokens for affected users.", 45],
      ["Notify users and record lessons", "Tell affected users what happened and add the lure to awareness training material.", 20],
    ],
  },
  {
    name: "Ransomware containment and recovery",
    category: "RANSOMWARE",
    description: "Stop encryption from spreading, preserve evidence, and restore from clean backups.",
    steps: [
      ["Isolate affected hosts", "Disconnect affected machines from the network through EDR or switch port shutdown. Do not power them off.", 10],
      ["Disable compromised accounts", "Disable accounts seen on affected hosts and block SMB between workstation subnets.", 20],
      ["Identify the strain and scope", "Match the ransom note and file extension to a known family and list every encrypted share.", 60],
      ["Preserve evidence", "Capture memory and disk images of at least one affected host before cleanup.", 60],
      ["Restore from the last clean backup", "Restore encrypted data from the most recent backup taken before the first encryption event and verify integrity.", 240],
      ["Reset credentials and monitor", "Reset domain admin and service account passwords and watch for re-entry for 14 days.", 120],
    ],
  },
  {
    name: "Malware triage and eradication",
    category: "MALWARE",
    description: "Contain an infected endpoint, scope the spread, and remove the malware and its persistence.",
    steps: [
      ["Isolate the host through EDR", "Put the host in network containment so it can only reach the EDR console.", 10],
      ["Collect the sample and hash", "Pull the file, record its SHA-256 and detonate it in the sandbox.", 30],
      ["Sweep the fleet for the same IOCs", "Search every endpoint for the hash, file path, mutex and C2 domain.", 45],
      ["Remove malware and persistence", "Delete the binary, scheduled tasks, run keys and services it created.", 60],
      ["Reimage if persistence remains", "If any persistence cannot be explained, reimage the host from the gold image.", 180],
    ],
  },
  {
    name: "DDoS mitigation",
    category: "DDOS",
    description: "Absorb or filter attack traffic and keep public services reachable.",
    steps: [
      ["Confirm the traffic profile", "Check edge metrics for volume, protocol and top sources to confirm it is an attack and not a traffic spike.", 15],
      ["Enable upstream scrubbing", "Ask the ISP or CDN to route traffic through scrubbing and turn on rate limits at the edge.", 20],
      ["Block top sources", "Add the heaviest source ranges and countries with no customers to the edge blocklist.", 15],
      ["Monitor until traffic normalises", "Watch error rates and latency on the affected service until they are back to baseline for an hour.", 60],
      ["Review capacity", "Record peak traffic and decide whether autoscaling or CDN limits need changing.", 30],
    ],
  },
  {
    name: "Compromised account response",
    category: "UNAUTHORIZED_ACCESS",
    description: "Lock out an attacker using valid credentials and close the ways back in.",
    steps: [
      ["Lock the account and end sessions", "Disable sign-in and revoke all sessions and tokens for the account.", 10],
      ["Review sign-in history", "List source IPs, devices and times of every sign-in over the last 30 days.", 30],
      ["Check for persistence", "Look for new inbox rules, MFA devices, app passwords, OAuth grants and API keys.", 30],
      ["Reset credentials and re-enrol MFA", "Set a new password and have the user enrol MFA again in person or over a verified call.", 20],
      ["Hunt for the same sources elsewhere", "Search sign-in logs for the attacker IPs across all other accounts.", 45],
    ],
  },
  {
    name: "Personal data exposure handling",
    category: "DATA_BREACH",
    description: "Stop the exposure, measure what leaked, and meet notification duties under the DPDP Act 2023.",
    steps: [
      ["Stop the exposure", "Remove public access, revoke leaked keys or take the affected endpoint offline.", 15],
      ["Measure what was exposed", "List data fields, number of records and number of data principals affected.", 120],
      ["Preserve logs and evidence", "Export access logs covering the exposure window before they rotate.", 60],
      ["Assess notification duty with legal", "Brief the Data Protection Officer and legal on whether the breach must be reported to the Data Protection Board of India.", 30],
      ["Notify affected data principals", "If notification is required, send clear notices describing the breach, its impact and steps taken.", 60],
    ],
  },
  {
    name: "Exploited vulnerability response",
    category: "VULNERABILITY_EXPLOIT",
    description: "Patch an exploited flaw and check whether the attacker left anything behind.",
    steps: [
      ["Confirm the CVE and affected versions", "Match the exploit traffic to a CVE and list every host running an affected version.", 30],
      ["Patch or apply the vendor mitigation", "Install the fixed version or apply the documented workaround on every affected host.", 60],
      ["Check for webshells and new accounts", "Search web roots for recently modified scripts and review local and domain accounts created since the first exploit attempt.", 60],
      ["Rotate secrets on affected hosts", "Rotate any credentials, keys and tokens stored on the exploited hosts.", 30],
    ],
  },
  {
    name: "Initial alert triage",
    category: null,
    description: "Quick first pass for any alert before a category playbook is chosen.",
    steps: [
      ["Rule out a false positive", "Check whether the alert matches known benign activity such as scheduled scans or admin scripts.", 15],
      ["Set severity and scope", "Confirm the severity and link every affected asset.", 15],
      ["Page the on-call lead for HIGH or CRITICAL", "Call the on-call lead directly for HIGH and CRITICAL incidents.", 5],
    ],
  },
];

// Incident templates. {ip}, {ip2}, {n}, {m} and {host} are filled in per incident.
export type Template = {
  category: string;
  severities: string[]; // picked at random
  title: string;
  description: string;
  resolution: string;
  assets: string[]; // hostname prefixes to choose from
  impact: "TARGETED" | "AFFECTED" | "COMPROMISED";
  contain?: boolean; // goes through CONTAINED
};

export const TEMPLATES: Template[] = [
  {
    category: "PHISHING", severities: ["MEDIUM", "HIGH"], impact: "TARGETED",
    title: "Fake Microsoft 365 login page sent to finance team",
    description: "{n} finance staff received an email claiming their mailbox was full, linking to a look-alike Microsoft 365 sign-in page hosted on a newly registered domain. {m} users reported it; proxy logs show two clicks.",
    resolution: "Domain blocked at mail gateway and proxy, all {n} copies purged. The two users who clicked had passwords reset and sessions revoked. No sign-ins from attacker IPs found.",
    assets: ["mail-gw", "fin-ws"],
  },
  {
    category: "PHISHING", severities: ["HIGH"], impact: "COMPROMISED",
    title: "Invoice lure with credential harvesting link clicked by accounts payable",
    description: "An accounts payable clerk opened a fake vendor invoice email and entered credentials on the linked page. Within 40 minutes a sign-in from {ip} succeeded and an inbox rule forwarding mail with 'payment' in the subject was created.",
    resolution: "Account locked, forwarding rule removed, password reset and MFA re-enrolled. Vendor bank change request that arrived the next day was flagged and rejected. Sender domain blocked.",
    assets: ["fin-ws", "mail-gw"],
  },
  {
    category: "PHISHING", severities: ["LOW", "MEDIUM"], impact: "TARGETED",
    title: "HR policy update phishing with malicious QR code",
    description: "Staff received a PDF titled 'Revised leave policy' asking them to scan a QR code to acknowledge it. The QR code points to a credential harvesting page. {n} recipients, no confirmed submissions.",
    resolution: "Message purged from all mailboxes, landing page reported for takedown and URL blocked. Awareness note sent to all staff explaining QR code phishing.",
    assets: ["mail-gw", "hr-ws"],
  },
  {
    category: "PHISHING", severities: ["MEDIUM"], impact: "TARGETED",
    title: "Courier delivery SMS phishing reported by employees",
    description: "{n} employees reported text messages about a failed courier delivery with a link to pay a small redelivery fee. The page collects card details and corporate email logins.",
    resolution: "Phishing domain added to the proxy blocklist and reported to the registrar. Reminder sent to staff not to enter corporate credentials on links from SMS.",
    assets: ["mail-gw"],
  },
  {
    category: "RANSOMWARE", severities: ["CRITICAL"], impact: "COMPROMISED", contain: true,
    title: "Ransomware encrypted files on finance file share",
    description: "Files on the finance share were renamed with a .lockbit extension and a ransom note was dropped in every folder. Encryption started from {host} using a domain account that had logged in from {ip} the night before.",
    resolution: "Affected workstation isolated, the abused account disabled and SMB blocked between workstation subnets. Share restored from the previous night's backup; about 3 hours of changes lost. Domain admin passwords rotated.",
    assets: ["fs-finance", "fin-ws"],
  },
  {
    category: "RANSOMWARE", severities: ["CRITICAL", "HIGH"], impact: "AFFECTED", contain: true,
    title: "Encryption attempt blocked on engineering laptop",
    description: "EDR stopped a process on {host} that began renaming files in the user's documents folder with a random extension. {n} files were encrypted before the process was killed. The binary arrived as a fake software update.",
    resolution: "Host isolated and reimaged. The {n} encrypted files restored from the user's cloud backup. Hash added to the EDR blocklist and the fake update site blocked.",
    assets: ["eng-lt"],
  },
  {
    category: "MALWARE", severities: ["HIGH", "MEDIUM"], impact: "COMPROMISED", contain: true,
    title: "Info-stealer detected on workstation after cracked software install",
    description: "EDR flagged a known info-stealer on {host} after the user installed a cracked PDF editor. The malware read saved browser passwords and sent them to {ip} over HTTPS.",
    resolution: "Host isolated and reimaged. All passwords saved in the browser were reset, including two shared service accounts. C2 address blocked at the firewall. User reminded of the software installation policy.",
    assets: ["fin-ws", "hr-ws", "eng-lt"],
  },
  {
    category: "MALWARE", severities: ["MEDIUM"], impact: "AFFECTED",
    title: "Malicious macro in shared spreadsheet",
    description: "A spreadsheet shared over email contained a macro that tried to download a second-stage payload from {ip}. Macros are blocked by policy on most machines but {n} users had an old exception.",
    resolution: "Payload download blocked by the proxy, no second stage executed. The legacy macro exception was removed for all {n} users and the file hash blocked.",
    assets: ["fin-ws", "hr-ws"],
  },
  {
    category: "MALWARE", severities: ["LOW", "MEDIUM"], impact: "AFFECTED",
    title: "Cryptominer running on build server container",
    description: "CPU on a build agent stayed at 100% for six hours. A container started from an outdated public image was running a Monero miner connecting to a mining pool.",
    resolution: "Container and image removed, base images pinned to signed versions from the internal registry. Pull from public registries blocked on build agents.",
    assets: ["api-gw"],
  },
  {
    category: "MALWARE", severities: ["HIGH"], impact: "COMPROMISED", contain: true,
    title: "USB worm spreading through shared office workstations",
    description: "A worm copied itself to removable drives and to {n} workstations through a shared folder. It creates a scheduled task named after a printer driver update.",
    resolution: "All {n} machines cleaned and the scheduled tasks removed. USB storage blocked by device control policy except for approved encrypted drives.",
    assets: ["hr-ws", "fin-ws"],
  },
  {
    category: "DDOS", severities: ["HIGH", "CRITICAL"], impact: "AFFECTED",
    title: "Volumetric DDoS against customer portal",
    description: "Inbound traffic to the customer portal reached {n} Gbps, mostly UDP reflection from thousands of sources. Page load time went above 30 seconds and the login page timed out for most users.",
    resolution: "Traffic routed through the CDN scrubbing service and UDP dropped at the edge. Service recovered in under an hour. Autoscaling limits raised for the portal.",
    assets: ["web-portal"],
  },
  {
    category: "DDOS", severities: ["MEDIUM", "HIGH"], impact: "AFFECTED",
    title: "HTTP flood on public API login endpoint",
    description: "The API gateway received about {n}k requests per minute to the login endpoint from rotating residential IPs, starting from {ip}. Legitimate API clients saw 429 and 503 errors.",
    resolution: "Rate limit per client ID added to the login endpoint and a challenge enabled for unauthenticated traffic. Error rates back to normal within 40 minutes.",
    assets: ["api-gw"],
  },
  {
    category: "UNAUTHORIZED_ACCESS", severities: ["MEDIUM", "HIGH"], impact: "TARGETED",
    title: "Password spraying against VPN gateway",
    description: "Over {n} failed VPN logins from {ip} and nearby addresses in 20 minutes, trying common passwords across many accounts. {m} accounts were locked out by policy.",
    resolution: "Source ranges blocked at the VPN gateway. No successful logins from the attacker ranges. Locked accounts unlocked after users confirmed. MFA enforcement extended to the remaining legacy VPN group.",
    assets: ["vpn-gw"],
  },
  {
    category: "UNAUTHORIZED_ACCESS", severities: ["HIGH", "CRITICAL"], impact: "COMPROMISED",
    title: "Impossible travel sign-in on admin account",
    description: "An IT admin account signed in from Bengaluru and, 12 minutes later, from {ip} in another country. The second session added a new MFA device and listed users in the directory.",
    resolution: "Account disabled, rogue MFA device removed, all sessions revoked. Admin confirmed the first sign-in only. Password reset in person and MFA re-enrolled. No changes made by the attacker beyond directory reads.",
    assets: ["dc"],
  },
  {
    category: "UNAUTHORIZED_ACCESS", severities: ["MEDIUM"], impact: "AFFECTED",
    title: "Former employee account used after exit date",
    description: "An account belonging to an employee who left three weeks ago signed in to the HR application from {ip}. Offboarding missed the application's local account.",
    resolution: "Local account disabled. Access logs show the former employee viewed their own payslips only. Offboarding checklist updated to include application-local accounts.",
    assets: ["hr-app"],
  },
  {
    category: "UNAUTHORIZED_ACCESS", severities: ["HIGH"], impact: "COMPROMISED",
    title: "Brute-forced SSH on internet-facing server",
    description: "{host} accepted an SSH password login for a test account after {n} attempts from {ip}. The attacker downloaded a script and added an authorised key.",
    resolution: "Test account removed, authorised key deleted, server rebuilt from the base image. Password authentication disabled for SSH on all servers and port 22 closed to the internet.",
    assets: ["web-portal", "mail-gw"],
  },
  {
    category: "DATA_BREACH", severities: ["CRITICAL", "HIGH"], impact: "COMPROMISED", contain: true,
    title: "Public cloud storage bucket exposed customer records",
    description: "A storage bucket holding exported customer support tickets was set to public read during a migration. Access logs show downloads from {ip} and {ip2}. About {n} records include names, phone numbers and email addresses.",
    resolution: "Public access removed and bucket policy locked down. {n} affected data principals identified. Legal assessed the duty under the DPDP Act 2023 and the breach was reported to the Data Protection Board; affected customers notified by email.",
    assets: ["archive-bucket"],
  },
  {
    category: "DATA_BREACH", severities: ["HIGH"], impact: "AFFECTED",
    title: "Employee emailed payroll file to personal address",
    description: "DLP flagged an outgoing email from an HR user to a personal mailbox with a spreadsheet containing salary and bank details for {n} employees.",
    resolution: "User confirmed they wanted to work from home over the weekend. Personal copy deleted in front of HR. Personal email domains added to the DLP block policy for files tagged confidential.",
    assets: ["hr-ws", "mail-gw"],
  },
  {
    category: "DATA_BREACH", severities: ["MEDIUM", "HIGH"], impact: "AFFECTED",
    title: "API returned other customers' order details",
    description: "A customer reported seeing another person's order history in the mobile app. A caching bug in the API gateway served responses across sessions for about {m} hours, affecting around {n} requests.",
    resolution: "Cache key fixed to include the session, cache flushed. {n} affected requests traced to individual customers; legal concluded notification was required and customers were informed.",
    assets: ["api-gw"],
  },
  {
    category: "VULNERABILITY_EXPLOIT", severities: ["CRITICAL", "HIGH"], impact: "COMPROMISED", contain: true,
    title: "Webshell found after exploit of file upload flaw",
    description: "WAF logs showed exploit attempts against an unpatched file upload endpoint on {host} from {ip}. A PHP webshell was found in the uploads folder, used to run 'whoami' and list configuration files.",
    resolution: "Webshell removed, upload endpoint patched and uploads now stored outside the web root. Database credentials found in the config file rotated. No evidence of database access.",
    assets: ["web-portal"],
  },
  {
    category: "VULNERABILITY_EXPLOIT", severities: ["HIGH"], impact: "TARGETED",
    title: "Mass scanning for VPN appliance vulnerability",
    description: "Thousands of requests from {ip} and other hosts probing the VPN portal path used by a recently published remote code execution flaw. Our appliance was one version behind the fix.",
    resolution: "Vendor patch applied the same day. Integrity check tool from the vendor showed no compromise. Scanner ranges blocked.",
    assets: ["vpn-gw"],
  },
  {
    category: "VULNERABILITY_EXPLOIT", severities: ["MEDIUM"], impact: "TARGETED",
    title: "Outdated firmware on CCTV recorder with default credentials",
    description: "An internal scan found the CCTV recorder running firmware with a known authentication bypass and still using the default admin password. Logs show login attempts from {host}.",
    resolution: "Firmware updated, default password changed and the recorder moved to an isolated VLAN with no internet access.",
    assets: ["cctv-nvr"],
  },
  {
    category: "INSIDER_THREAT", severities: ["HIGH"], impact: "AFFECTED",
    title: "Bulk download of design documents before resignation",
    description: "An engineer who had just resigned downloaded {n} files from the design repository in one evening, about ten times their usual volume, and synced them to a personal cloud drive.",
    resolution: "Access revoked, HR and legal involved. The employee returned and deleted the files under supervision and signed a declaration. Personal cloud sync blocked on managed laptops.",
    assets: ["eng-lt"],
  },
  {
    category: "OTHER", severities: ["LOW"], impact: "TARGETED",
    title: "Port scan of DMZ range from external host",
    description: "The perimeter firewall logged a full TCP port sweep of the DMZ from {ip}. No unusual open ports were found and no follow-up connection attempts were seen.",
    resolution: "Source blocked at the firewall. Confirmed only expected services are exposed. No further action needed.",
    assets: ["web-portal", "mail-gw"],
  },
  {
    category: "OTHER", severities: ["LOW", "MEDIUM"], impact: "AFFECTED",
    title: "Backup job failures left servers unprotected",
    description: "Nightly backups for {n} servers failed for four days because the backup service account password had expired. Nobody was alerted.",
    resolution: "Service account moved to a managed secret with automatic rotation, full backups re-run and verified. Alert added for any failed backup job.",
    assets: ["backup"],
  },
];

export const FALSE_POSITIVE_NOTES = [
  "False positive: the alert was triggered by the quarterly vulnerability scan run by IT.",
  "False positive: traffic came from an approved penetration test scheduled for this week.",
  "False positive: the 'suspicious' script was an admin's software inventory job.",
  "False positive: user confirmed the login from a new device was their replacement laptop.",
];
