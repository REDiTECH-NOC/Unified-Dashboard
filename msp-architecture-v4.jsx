const { useState, useEffect } = React;

// ── RESPONSIVE HOOK ──
const useWindowWidth = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
};

// Breakpoints: mobile < 640, tablet 640-960, desktop > 960
const useResponsive = () => {
  const w = useWindowWidth();
  return { isMobile: w < 640, isTablet: w >= 640 && w <= 960, isDesktop: w > 960, width: w };
};

// Responsive grid helper — returns column string based on screen size
const rGrid = (mobile, tablet, desktop) => {
  const w = window.innerWidth;
  if (w < 640) return mobile;
  if (w <= 960) return tablet;
  return desktop;
};

// ── THEME ──
const COLORS = {
  bg: "#0a0e1a",
  card: "#111827",
  cardHover: "#1a2236",
  border: "#1e293b",
  accent: "#3b82f6",
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  yellow: "#eab308",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
};

// ── ALL 20 TOOL INTEGRATIONS ──
const tools = [
  // Security & Endpoint Protection
  { id: "sentinelone", name: "SentinelOne", category: "EDR", group: "Security", color: COLORS.red, icon: "🛡️", apiType: "REST API", dataPoints: ["Threat data", "Agent health", "Incidents", "Forensics", "Quarantine"] },
  { id: "blackpoint", name: "Blackpoint Compass One", category: "MDR/SOC/ITDR", group: "Security", color: COLORS.red, icon: "🔒", apiType: "Webhook + API", dataPoints: ["MDR alerts", "365 ITDR", "Vuln scans", "Threat intel", "Response actions"] },
  { id: "avanan", name: "Avanan", category: "Email Security", group: "Security", color: COLORS.orange, icon: "📧", apiType: "REST API", dataPoints: ["Email threats", "Phishing blocks", "Quarantine", "DLP events"] },
  { id: "dnsfilter", name: "DNS Filter", category: "DNS Filtering", group: "Security", color: COLORS.orange, icon: "🌐", apiType: "REST API", dataPoints: ["DNS blocks", "Policy violations", "Categories", "Threat logs"] },
  { id: "huntress", name: "Huntress SAT", category: "Security Training", group: "Security", color: COLORS.orange, icon: "🎣", apiType: "REST API", dataPoints: ["Phishing sim results", "Training completion", "Risk scores", "Campaigns"] },
  // Identity & Access
  { id: "duo", name: "Duo MFA", category: "MFA", group: "Identity", color: COLORS.green, icon: "🔑", apiType: "Admin API", dataPoints: ["Auth logs", "Bypass events", "Enrollment %", "Device trust"] },
  { id: "autoelevate", name: "AutoElevate", category: "PAM", group: "Identity", color: COLORS.purple, icon: "⬆️", apiType: "REST API", dataPoints: ["Elevation requests", "Approvals", "Denials", "Rules"] },
  { id: "quickpass", name: "Quickpass", category: "Password Rotation", group: "Identity", color: COLORS.purple, icon: "🪪", apiType: "REST API", dataPoints: ["Verification events", "Password resets", "Identity checks"] },
  // RMM & Operations
  { id: "ninjaone", name: "NinjaRMM", category: "RMM", group: "Operations", color: COLORS.green, icon: "🖥️", apiType: "REST API", dataPoints: ["Device status", "Patch compliance", "Alerts", "Scripts", "AV status"] },
  { id: "connectwise", name: "ConnectWise PSA", category: "PSA/Ticketing", group: "Operations", color: COLORS.accent, icon: "🎫", apiType: "REST API", dataPoints: ["Tickets", "Time entries", "Billing", "SLAs", "Projects"] },
  { id: "cipp", name: "CIPP", category: "365 Management", group: "Operations", color: COLORS.accent, icon: "☁️", apiType: "REST API", dataPoints: ["Tenant health", "Secure Score", "Licenses", "GDAP management"] },
  // Backup & Recovery
  { id: "cove", name: "Cove Backups", category: "Server/Workstation Backup", group: "Backup", color: COLORS.cyan, icon: "💾", apiType: "REST API", dataPoints: ["Backup status", "Job history", "Failure alerts", "Storage usage"] },
  { id: "dropsuite", name: "Dropsuite", category: "365 Backup", group: "Backup", color: COLORS.cyan, icon: "📦", apiType: "REST API", dataPoints: ["Mailbox backup", "OneDrive backup", "SharePoint backup", "Restore logs"] },
  // Documentation & Knowledge
  { id: "itglue", name: "IT Glue", category: "Documentation", group: "Knowledge", color: COLORS.cyan, icon: "📋", apiType: "REST API", dataPoints: ["Configs", "Passwords (MFA-gated)", "Contacts", "Assets", "Diagrams"] },
  { id: "sharepoint", name: "SharePoint & OneNote", category: "Internal Knowledge", group: "Knowledge", color: COLORS.purple, icon: "📓", apiType: "Graph API", dataPoints: ["Runbooks", "SOPs", "KB articles", "Procedures", "Process docs"] },
  { id: "keeper", name: "Keeper", category: "Password Manager", group: "Identity", color: COLORS.yellow, icon: "🔐", apiType: "REST API", dataPoints: ["Client vaults (read-only)", "Shared folders", "Breach reports"] },
  // Networking
  { id: "unifi", name: "Unifi", category: "Switches/APs", group: "Network", color: COLORS.green, icon: "📡", apiType: "REST API (local)", dataPoints: ["Device status", "Client count", "Throughput", "AP health", "Alerts"] },
  { id: "watchguard", name: "WatchGuard", category: "Firewalls", group: "Network", color: COLORS.red, icon: "🔥", apiType: "REST API", dataPoints: ["VPN status", "Threat logs", "Interface health", "Tunnel status"] },
  // Business & Licensing
  { id: "pax8", name: "PAX8", category: "Licensing", group: "Business", color: COLORS.yellow, icon: "🏷️", apiType: "REST API", dataPoints: ["License counts", "Subscriptions", "Billing data", "Product catalog"] },
  { id: "threecx", name: "3CX", category: "Phone System", group: "Business", color: COLORS.pink, icon: "📞", apiType: "API + Webhooks", dataPoints: ["Call logs", "Queue stats", "Voicemails + transcription", "Presence + ring groups", "SMS alerts to on-call techs", "Emergency VM → auto-ticket"] },
];

const toolGroups = [
  { key: "Security", label: "Security & Endpoint", color: COLORS.red },
  { key: "Identity", label: "Identity & Access", color: COLORS.purple },
  { key: "Operations", label: "RMM & Operations", color: COLORS.accent },
  { key: "Backup", label: "Backup & Recovery", color: COLORS.cyan },
  { key: "Knowledge", label: "Documentation & Knowledge", color: COLORS.cyan },
  { key: "Network", label: "Networking", color: COLORS.green },
  { key: "Business", label: "Business & Licensing", color: COLORS.yellow },
];

// ── PLATFORM SERVICES (not tool integrations) ──
const platformServices = [
  { id: "entra", name: "Entra ID", category: "Identity/SSO", color: COLORS.yellow, icon: "🔐", desc: "OIDC + PKCE, MFA step-up, Conditional Access, RBAC groups" },
  { id: "azureai", name: "Azure OpenAI", category: "AI Engine", color: COLORS.pink, icon: "🤖", desc: "GPT-4o function calling, text-embedding-3-small for RAG" },
  { id: "keyvault", name: "Azure Key Vault", category: "Secrets", color: COLORS.orange, icon: "🗝️", desc: "All API keys, connection strings, credentials" },
  { id: "n8n", name: "n8n", category: "Orchestration", color: COLORS.accent, icon: "⚡", desc: "Workflow automation, API polling, webhook routing" },
  { id: "teams", name: "Microsoft Teams", category: "Notifications", color: COLORS.purple, icon: "💬", desc: "Outbound alert webhooks via Notification Engine — on-call, daily, escalation alerts" },
  { id: "grafana", name: "Grafana", category: "Analytics", color: COLORS.orange, icon: "📊", desc: "4th Docker container — advanced dashboards, ad-hoc queries, iframe embedded for power users" },
];

// ── 5-LAYER ARCHITECTURE ──
const tiers = [
  {
    id: "auth", name: "LAYER 0 — IDENTITY & COMPLIANCE", subtitle: "Entra ID SSO + MFA + Immutable Audit Logging", color: COLORS.yellow,
    items: [
      { title: "Entra ID SSO (OIDC + PKCE)", desc: "Single sign-on via existing M365 tenant with Conditional Access" },
      { title: "MFA Step-Up Gate", desc: "Password retrieval triggers Microsoft Authenticator push with number matching" },
      { title: "Immutable Audit Engine", desc: "Every action logged — who, what, when, where, outcome — 7-year retention" },
      { title: "RBAC via Entra Groups", desc: "Tech, Manager, Admin, Client roles with per-function permission gating" },
    ]
  },
  {
    id: "ai", name: "LAYER 1 — AI OPERATIONS ASSISTANT", subtitle: "Azure OpenAI GPT-4o + IT Glue/OneNote/SharePoint RAG", color: COLORS.pink,
    items: [
      { title: "Alert Triage Agent", desc: "Merges related alerts and tickets, auto-troubleshoots via n8n (ping, WAN checks, subnet scans)" },
      { title: "Ticket Agent", desc: "Create, search, filter, assign, and update ConnectWise tickets using natural language" },
      { title: "Knowledge Base Agent (RAG)", desc: "Search + create/update IT Glue docs, OneNote, SharePoint — write capability per-user gated" },
      { title: "Password & TOTP Agent (MFA-Gated)", desc: "Retrieve IT Glue credentials + TOTP/MFA codes — Entra MFA, 2hr session, adjustable rate limit" },
    ]
  },
  {
    id: "ingestion", name: "LAYER 2 — INGESTION & AUTOMATION", subtitle: "n8n orchestration → polling + webhooks → Redis queue → Notification & Alerting Engine", color: COLORS.accent,
    items: [
      { title: "API Polling Engine", desc: "Scheduled pulls every 1-5 min from all 20 tools via n8n workflows" },
      { title: "Webhook Listeners", desc: "Real-time inbound events from Blackpoint, 3CX, NinjaRMM, ConnectWise" },
      { title: "Notification & Alerting Engine", desc: "Customizable outbound alerts — Teams webhooks, SMS via 3CX, email — daily schedules + on-call rotation" },
      { title: "On-Call & Escalation", desc: "Rotation schedules with substitutions. If no response within X min → escalate to secondary tech → manager" },
      { title: "Alert-to-Ticket Engine", desc: "Dedup + severity scoring → auto-creates ConnectWise tickets" },
      { title: "3CX Voicemail Automation", desc: "Emergency VM → OpenAI transcription → caller lookup in PSA → auto-ticket → notify on-call tech" },
      { title: "Event Queue (Azure Redis)", desc: "Buffered ingestion with retry logic and dead-letter handling" },
    ]
  },
  {
    id: "processing", name: "LAYER 3 — NORMALIZATION & ENRICHMENT", subtitle: "Unified schema + context enrichment + severity scoring", color: COLORS.purple,
    items: [
      { title: "Schema Normalizer", desc: "Unified alert/event model across all 20 sources" },
      { title: "IT Glue Enrichment", desc: "Auto-attach documentation, configs, and contacts to alerts" },
      { title: "Client Correlation Engine", desc: "Cross-tool tenant mapping (ConnectWise company → tool-specific IDs)" },
      { title: "Severity Scoring Engine", desc: "Multi-signal prioritization using cross-tool intelligence" },
    ]
  },
  {
    id: "presentation", name: "LAYER 4 — DASHBOARD & REPORTING", subtitle: "Alert triage + AI chat + built-in dashboards + Grafana analytics + health scorecards + QBR reports", color: COLORS.green,
    items: [
      { title: "Unified Alert Triage", desc: "Single alert queue with enriched context from all tools" },
      { title: "AI Chat Sidebar", desc: "Conversational assistant for ticket ops, lookups, knowledge queries" },
      { title: "Notification & On-Call Manager", desc: "Configure alert rules, on-call rotations, escalation paths, substitutions, daily/weekly schedules" },
      { title: "Built-In Dashboards (Tremor + Recharts)", desc: "Real-time KPI charts, trend lines, bar/pie/area charts — embedded in every page. Replaces BrightGauge." },
      { title: "Grafana Analytics (Embedded)", desc: "4th Docker container — advanced ad-hoc dashboards, iframe embedded. Same PostgreSQL data source." },
      { title: "Client Health Scorecards", desc: "6 weighted metrics: patch, backup, EDR, MFA, training, tickets" },
      { title: "Contract Reconciliation (Future)", desc: "License counts vs. billing per client per vendor — device/user matching across tools. Replaces Gradient MSP." },
      { title: "QBR & Compliance Reports", desc: "Auto-generated PDFs with health trends, incidents, recommendations" },
    ]
  }
];

// ── SHARED COMPONENTS ──
const ToolCard = ({ tool, isSelected, onClick }) => (
  <div onClick={onClick} style={{
    background: isSelected ? COLORS.cardHover : COLORS.card,
    border: `1px solid ${isSelected ? tool.color : COLORS.border}`,
    borderRadius: 10, padding: "10px 12px", cursor: "pointer",
    transition: "all 0.2s", boxShadow: isSelected ? `0 0 20px ${tool.color}30` : "none",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>{tool.icon}</span>
      <span style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 11.5 }}>{tool.name}</span>
    </div>
    <div style={{ display: "inline-block", fontSize: 9, fontWeight: 600, color: tool.color, background: `${tool.color}18`, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>{tool.category}</div>
    {isSelected && (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tool.apiType}</div>
        {tool.dataPoints.map((dp, i) => (
          <div key={i} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "1px 0", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: tool.color, flexShrink: 0 }} />{dp}
          </div>
        ))}
      </div>
    )}
  </div>
);

const TierSection = ({ tier, isActive, onClick }) => (
  <div onClick={onClick} style={{
    background: isActive ? COLORS.cardHover : COLORS.card,
    border: `1px solid ${isActive ? tier.color : COLORS.border}`,
    borderRadius: 12, padding: 14, cursor: "pointer",
    transition: "all 0.2s", boxShadow: isActive ? `0 0 24px ${tier.color}20` : "none",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color, boxShadow: `0 0 8px ${tier.color}80` }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: tier.color, letterSpacing: "0.08em" }}>{tier.name}</span>
    </div>
    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: isActive ? 10 : 0, marginLeft: 16 }}>{tier.subtitle}</div>
    {isActive && (
      <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 640 ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
        {tier.items.map((item, i) => (
          <div key={i} style={{ background: `${tier.color}08`, border: `1px solid ${tier.color}25`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 2 }}>{item.title}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.4 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const FlowArrow = ({ color = COLORS.textMuted, label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5px 0" }}>
    <div style={{ width: 2, height: 10, background: `linear-gradient(to bottom, ${color}40, ${color})` }} />
    {label && <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", background: `${color}12`, borderRadius: 4, margin: "2px 0" }}>{label}</div>}
    <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid ${color}` }} />
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: 14 }}>
    <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, margin: "0 0 4px" }}>{title}</h3>
    {subtitle && <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>{subtitle}</p>}
  </div>
);

const StatBox = ({ value, label, desc, color }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${color}30`, borderRadius: 10, padding: 14, textAlign: "center" }}>
    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{label}</div>
    {desc && <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{desc}</div>}
  </div>
);

// ── ARCHITECTURE TAB ──
const ArchitectureView = ({ selectedTool, setSelectedTool, activeTier, setActiveTier }) => {
  const r = useResponsive();
  const toolCols = r.isMobile ? 2 : r.isTablet ? 3 : 5;
  const platCols = r.isMobile ? 1 : r.isTablet ? 2 : 3;
  return (
  <div>
    <SectionHeader title="Tool Integrations (20)" subtitle="Click any tool to see API details and data points — grouped by function" />

    {toolGroups.map(group => {
      const groupTools = tools.filter(t => t.group === group.key);
      return (
        <div key={group.key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: group.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>
            {group.label} ({groupTools.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(groupTools.length, toolCols)}, 1fr)`, gap: 7 }}>
            {groupTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} isSelected={selectedTool === tool.id} onClick={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)} />
            ))}
          </div>
        </div>
      );
    })}

    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>
        PLATFORM SERVICES
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${platCols}, 1fr)`, gap: 7, marginBottom: 4 }}>
        {platformServices.map(svc => (
          <div key={svc.id} style={{ background: COLORS.card, border: `1px solid ${svc.color}25`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>{svc.icon}</span>
              <span style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 11.5 }}>{svc.name}</span>
            </div>
            <div style={{ display: "inline-block", fontSize: 9, fontWeight: 600, color: svc.color, background: `${svc.color}18`, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>{svc.category}</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.4 }}>{svc.desc}</div>
          </div>
        ))}
      </div>
    </div>

    <FlowArrow color={COLORS.accent} label="REST APIs + Webhooks + Graph API + OIDC" />

    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {tiers.map(tier => (
        <TierSection key={tier.id} tier={tier} isActive={activeTier === tier.id} onClick={() => setActiveTier(activeTier === tier.id ? null : tier.id)} />
      ))}
    </div>
  </div>
  );
};

// ── COMPLIANCE AUDIT VIEW ──
const ComplianceView = () => {
  const auditCategories = [
    {
      title: "Authentication Events", color: COLORS.yellow, icon: "🔐",
      events: [
        { event: "user.login", fields: "user, IP, device, MFA method, result, Entra token ID" },
        { event: "user.login.failed", fields: "user, IP, device, failure reason, lockout status" },
        { event: "user.logout", fields: "user, session duration, trigger (manual/timeout)" },
        { event: "user.mfa.stepup", fields: "user, operation requested, MFA method, result" },
      ]
    },
    {
      title: "Credential Access", color: COLORS.red, icon: "🔑",
      events: [
        { event: "credential.requested", fields: "user, client, credential name, source (IT Glue/Keeper)" },
        { event: "credential.mfa.sent", fields: "user, MFA method (MS Authenticator), challenge ID" },
        { event: "credential.mfa.result", fields: "user, result (approved/denied/timeout), latency" },
        { event: "credential.revealed", fields: "user, credential ID, auto-clear timer, copy action" },
        { event: "credential.expired", fields: "user, credential ID, reveal duration (60s)" },
      ]
    },
    {
      title: "AI Assistant Actions", color: COLORS.pink, icon: "🤖",
      events: [
        { event: "ai.conversation.start", fields: "user, session ID, agent type, timestamp" },
        { event: "ai.function.called", fields: "user, function name, parameters, target client/device" },
        { event: "ai.function.result", fields: "session, function, success/failure, response summary" },
        { event: "ai.ticket.created", fields: "user, CW ticket ID, client, board, priority, AI-drafted" },
        { event: "ai.knowledge.query", fields: "user, query text, sources returned, RAG confidence" },
        { event: "ai.alert.triaged", fields: "alert IDs merged, correlation reason, severity adjustment" },
      ]
    },
    {
      title: "Ticket & Alert Operations", color: COLORS.accent, icon: "🎫",
      events: [
        { event: "alert.ingested", fields: "source tool, alert ID, client, severity, category" },
        { event: "alert.deduplicated", fields: "new alert ID, matched existing ID, match reason" },
        { event: "alert.escalated", fields: "alert ID, old severity, new severity, scoring factors" },
        { event: "ticket.auto_created", fields: "CW ticket ID, source alert(s), client, board, priority" },
        { event: "alert.acknowledged", fields: "user, alert ID, acknowledgment type" },
        { event: "alert.resolved", fields: "user, alert ID, resolution type, time-to-resolve" },
      ]
    },
    {
      title: "System & Integration Health", color: COLORS.green, icon: "⚙️",
      events: [
        { event: "connector.poll.success", fields: "tool, endpoint, records fetched, latency" },
        { event: "connector.poll.failure", fields: "tool, endpoint, error code, retry count" },
        { event: "connector.ratelimit", fields: "tool, limit hit, backoff duration" },
        { event: "rag.index.updated", fields: "source (OneNote/ITGlue/SharePoint), chunks indexed, duration" },
        { event: "platform.health", fields: "CPU, memory, disk, DB connections, Redis status, uptime" },
      ]
    },
    {
      title: "Notifications, On-Call & Voicemail", color: COLORS.pink, icon: "📞",
      events: [
        { event: "notification.sent", fields: "rule ID, alert ID, channel (Teams/SMS/email), recipient, delivery status" },
        { event: "notification.acknowledged", fields: "notification ID, tech user, response time, channel" },
        { event: "notification.escalated", fields: "notification ID, escalation level, timeout_min, next recipient" },
        { event: "oncall.schedule.updated", fields: "admin user, schedule changes, substitutions, effective dates" },
        { event: "voicemail.received", fields: "3CX call ID, caller number, queue, duration, timestamp" },
        { event: "voicemail.transcribed", fields: "call ID, OpenAI transcription text, confidence, language" },
        { event: "voicemail.caller.matched", fields: "call ID, matched client, contact, match method (number/transcription)" },
        { event: "voicemail.ticket.created", fields: "call ID, CW ticket ID, client, contact, priority, transcription" },
      ]
    },
    {
      title: "Data Access & Export", color: COLORS.purple, icon: "📊",
      events: [
        { event: "report.generated", fields: "user, report type (QBR/health/audit), client, format" },
        { event: "report.exported", fields: "user, report ID, format (PDF/CSV), file size" },
        { event: "audit.log.exported", fields: "user, date range, filters, record count" },
        { event: "client.data.accessed", fields: "user, client, data type, access context" },
      ]
    },
  ];

  return (
    <div>
      <SectionHeader title="Compliance Audit Log Framework" subtitle="Every action across the platform generates immutable, timestamped audit entries — append-only, tamper-evident" />
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 10, marginBottom: 16 }}>
        {auditCategories.map((cat, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${cat.color}25`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, letterSpacing: "0.04em" }}>{cat.title}</span>
            </div>
            {cat.events.map((ev, j) => (
              <div key={j} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: j < cat.events.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textPrimary, fontFamily: "monospace" }}>{ev.event}</div>
                <div style={{ fontSize: 9, color: COLORS.textMuted, lineHeight: 1.4 }}>{ev.fields}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr 1fr", "1fr 1fr 1fr"), gap: 10 }}>
        <StatBox value="7 years" label="Retention" desc="Hot (PostgreSQL) + cold (compressed archive)" color={COLORS.accent} />
        <StatBox value="CSV / SIEM" label="Export" desc="On-demand export, Syslog forwarding, SIEM integration" color={COLORS.purple} />
        <StatBox value="SOC 2 / HIPAA" label="Compliance" desc="Framework-aligned logging for client audit requests" color={COLORS.green} />
      </div>
    </div>
  );
};

// ── AI ASSISTANT VIEW ──
const AIAssistantView = () => {
  const [activeDemo, setActiveDemo] = useState(0);
  const [activeSection, setActiveSection] = useState("privacy");

  const demos = [
    {
      title: "Alert Triage", color: COLORS.red,
      messages: [
        { role: "system", text: "🔔 INCOMING ALERTS (last 15 min):\n• NinjaRMM: CONTOSO-DC01 — Disk space critical (5% free)\n• SentinelOne: CONTOSO-DC01 — Suspicious PowerShell execution\n• Blackpoint MDR: Contoso — Lateral movement detected\n• Avanan: Contoso CEO — Phishing email quarantined" },
        { role: "ai", text: "🔍 ALERT TRIAGE ANALYSIS\n\nI've identified 2 distinct incidents from these 4 alerts:\n\n🔴 INCIDENT 1 — CRITICAL: Possible Compromise (3 correlated alerts)\n• SentinelOne threat + Blackpoint lateral movement + disk space (possible data staging)\n• Device: CONTOSO-DC01 (Domain Controller)\n• Recommendation: Isolate endpoint, escalate to SOC\n\n🟡 INCIDENT 2 — MEDIUM: Phishing Attempt (1 alert)\n• Avanan quarantined phishing targeting CEO\n• No click-through detected, email contained credential harvesting link\n• Recommendation: Verify no other recipients, check Duo for suspicious auth\n\n📋 TICKET DRAFT — Incident 1:\nBoard: Service — Emergency\nPriority: Critical\nCompany: Contoso Ltd\n\nShall I create tickets for both incidents?" },
      ]
    },
    {
      title: "Ticket Creation", color: COLORS.accent,
      messages: [
        { role: "tech", text: "Create a ticket for Contoso — their CEO Sarah Johnson can't access email. Outlook keeps prompting for credentials. She has a meeting in 20 minutes." },
        { role: "ai", text: "Pulling context across your tools...\n\n✅ Sarah Johnson found (ConnectWise → Contoso Ltd, CEO)\n✅ Device: CONTOSO-CEO-01 (NinjaRMM: online, patches current)\n✅ SentinelOne: No threats detected\n✅ Duo: Last MFA auth 2 hours ago — healthy\n✅ Avanan: No email quarantine issues\n\nThis looks like an Outlook credential/auth issue, not security-related." },
        { role: "ticket", text: "📋 TICKET DRAFT\nBoard: Service — Tier 1\nCompany: Contoso Ltd | Contact: Sarah Johnson (CEO)\nPriority: High (executive + time-sensitive)\nSummary: Outlook credential prompt loop — CEO laptop\nDevice: CONTOSO-CEO-01\n\nInitial Notes:\n- No security threats detected across EDR/MDR/email\n- Device online, patches current\n- Likely auth token expiry or profile corruption\n\n🔍 Audit: ai.ticket.created will log your identity + all details\n\nShall I create this ticket?" },
      ]
    },
    {
      title: "Password + TOTP (MFA-Gated)", color: COLORS.red,
      messages: [
        { role: "tech", text: "I need the admin password for Contoso's 365 global admin" },
        { role: "ai", text: "Found in IT Glue: Contoso Ltd → Microsoft 365 Global Admin\n\n⚠️ Privileged credential — MFA verification required.\n🔐 Sending push to your Microsoft Authenticator now..." },
        { role: "system", text: "🔔 ENTRA MFA PUSH SENT → Approve with number matching\n\n📝 Compliance audit trail:\n• Tech: you@reditech.com\n• Credential: Contoso — 365 Global Admin\n• Events: credential.revealed + credential.totp.generated\n• Rate limit: 7 of 10 remaining (adjustable by Admin)\n• Retention: 7 years" },
        { role: "ai", text: "✅ MFA verified.\n\n🔑 365 Global Admin — Contoso\nUsername: admin@contoso.com\nPassword: ••••••••••  [Copy Password]\nTOTP Code: 847 293  ⏱️ 18s remaining  [Copy TOTP]\n\n⏱️ Auto-clears in 60 seconds\n📝 Logged: credential.revealed + credential.totp.generated → audit trail" },
      ]
    },
    {
      title: "Knowledge Base Q&A", color: COLORS.green,
      messages: [
        { role: "tech", text: "How do we set up VPN for new Contoso employees?" },
        { role: "ai", text: "Found the procedure from two sources:\n\n📓 SharePoint → Client Runbooks → Contoso → VPN Setup:\n1. Create user in Entra ID (via CIPP)\n2. Add to \"VPN-Users\" security group\n3. WatchGuard SSL VPN client config\n   • Server: vpn.contoso.com:443\n   • Pre-shared key: [🔐 Requires MFA to view]\n4. Install client from \\\\contoso-dc01\\software\\vpn\\\n5. Test + verify split tunnel routes\n\n📋 IT Glue: WatchGuard config + VLAN layout + network diagram available\n\n📝 Logged: ai.knowledge.query → sources: SharePoint, IT Glue\n\nWant me to create a setup ticket?" },
      ]
    },
    {
      title: "Emergency Voicemail", color: COLORS.pink,
      messages: [
        { role: "system", text: "📞 INCOMING EMERGENCY VOICEMAIL — 3CX After-Hours Queue\n\nCaller: (555) 234-5678 | Duration: 47 seconds | Queue: Emergency\nTimestamp: 11:43 PM EST" },
        { role: "ai", text: "🔍 VOICEMAIL PROCESSING\n\n1. OpenAI Whisper transcription complete:\n\"Hi, this is Mike from — I think Contoso — our server is down and nobody can access email or files. This is urgent, we have a deadline tomorrow morning. Please call me back at 555-234-5678.\"\n\n2. Caller lookup: (555) 234-5678 → ConnectWise PSA\n   ✅ Match: Mike Torres — Contoso Ltd (IT Contact)\n\n3. Auto-creating ConnectWise ticket..." },
        { role: "ticket", text: "📋 AUTO-CREATED TICKET\nBoard: Service — Emergency\nCompany: Contoso Ltd | Contact: Mike Torres\nPriority: Emergency (after-hours + server down)\nSummary: Server down — no email or file access (reported via voicemail)\n\nNotes:\n• OpenAI transcription attached\n• Callback: (555) 234-5678\n• Deadline mentioned: tomorrow morning\n\n📱 On-Call Tech: Jake Miller (primary)\n• Teams alert sent with transcription\n• SMS sent via 3CX: \"EMERGENCY: Contoso server down — see Teams for details\"\n• Email sent with full VM transcription\n\n⏱️ Escalation: If Jake doesn't acknowledge within 15 min → alert Sarah Chen (secondary) → then manager\n\n📝 Logged: voicemail.received → voicemail.transcribed → voicemail.caller.matched → voicemail.ticket.created → oncall.tech.notified" },
      ]
    },
  ];

  const demo = demos[activeDemo];
  const roleStyles = {
    tech: { bg: `${COLORS.accent}15`, border: `${COLORS.accent}30`, label: "TECHNICIAN", labelColor: COLORS.accent },
    ai: { bg: `${COLORS.pink}10`, border: `${COLORS.pink}25`, label: "AI ASSISTANT", labelColor: COLORS.pink },
    ticket: { bg: `${COLORS.orange}10`, border: `${COLORS.orange}25`, label: "TICKET DRAFT", labelColor: COLORS.orange },
    system: { bg: `${COLORS.yellow}10`, border: `${COLORS.yellow}25`, label: "SYSTEM", labelColor: COLORS.yellow },
  };

  const secSections = [
    { id: "privacy", label: "Privacy & Isolation" },
    { id: "rulesets", label: "Agent Rulesets" },
    { id: "safeguards", label: "Data Safeguards" },
    { id: "costmgmt", label: "Cost Management" },
    { id: "demos", label: "Live Demos" },
    { id: "functions", label: "Function Catalog" },
  ];

  return (
    <div>
      <SectionHeader title="AI Operations Assistant" subtitle="Private Azure OpenAI — no internet access, per-agent security rulesets, every action audited" />

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {secSections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            background: activeSection === s.id ? `${COLORS.pink}20` : COLORS.card,
            border: `1px solid ${activeSection === s.id ? COLORS.pink : COLORS.border}`,
            borderRadius: 8, padding: "7px 14px", cursor: "pointer",
            color: activeSection === s.id ? COLORS.textPrimary : COLORS.textSecondary,
            fontSize: 11, fontWeight: 600, transition: "all 0.2s",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── PRIVACY & ISOLATION ── */}
      {activeSection === "privacy" && (
        <div>
          {/* Key message banner */}
          <div style={{ background: `${COLORS.green}10`, border: `2px solid ${COLORS.green}40`, borderRadius: 12, padding: 18, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.green, marginBottom: 6 }}>This is NOT ChatGPT. This is Private AI.</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, maxWidth: 700, margin: "0 auto" }}>
              Our AI runs on Azure OpenAI — a private instance inside our own Azure tenant.
              Your data never leaves our environment, Microsoft does not train on it, and the AI has zero internet access.
              It can only perform actions we explicitly build and authorize.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 12, marginBottom: 16 }}>
            {/* What it IS */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.green}30`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, letterSpacing: "0.08em", marginBottom: 10 }}>WHAT OUR AI IS</div>
              {[
                "Private Azure OpenAI instance in our Azure tenant",
                "Isolated API — not connected to the public internet",
                "Data stays within our Azure environment at all times",
                "Microsoft contractually cannot train on our data",
                "Every interaction is logged to immutable audit trail",
                "Role-gated — each user's permissions limit what AI can access",
                "Function-locked — AI can ONLY call pre-built, approved actions",
                "Costs are predictable and budgeted per-user",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 10.5, color: COLORS.textSecondary, padding: "3px 0", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4 }}>
                  <span style={{ color: COLORS.green, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>{item}
                </div>
              ))}
            </div>
            {/* What it is NOT */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.red}30`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: "0.08em", marginBottom: 10 }}>WHAT OUR AI IS NOT</div>
              {[
                "NOT ChatGPT, Copilot, or any public AI service",
                "NOT connected to the internet — cannot browse or search the web",
                "NOT able to send data outside our Azure tenant",
                "NOT able to access tools we haven't explicitly connected",
                "NOT able to perform actions beyond its assigned function set",
                "NOT able to access passwords without real-time MFA verification",
                "NOT training on our data — ever (Microsoft Zero Data Retention)",
                "NOT able to bypass role-based access controls",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 10.5, color: COLORS.textSecondary, padding: "3px 0", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4 }}>
                  <span style={{ color: COLORS.red, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✗</span>{item}
                </div>
              ))}
            </div>
          </div>

          {/* How data flows */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.accent}25`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.08em", marginBottom: 12 }}>HOW DATA FLOWS — COMPLETELY WITHIN OUR ENVIRONMENT</div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              {[
                { step: "1", title: "Technician Asks", desc: "User types a question in the dashboard. Their identity and role are verified via Entra SSO.", color: COLORS.accent },
                { step: "2", title: "Request Sanitized", desc: "Our backend checks permissions, strips sensitive data, and builds a safe prompt. Passwords are NEVER included.", color: COLORS.orange },
                { step: "3", title: "Azure OpenAI (Private)", desc: "Prompt sent to our private Azure OpenAI instance. Data stays in our Azure tenant. No internet access.", color: COLORS.pink },
                { step: "4", title: "Function Execution", desc: "If AI needs data, it calls pre-approved functions only. Each call is permission-checked and audit-logged.", color: COLORS.purple },
                { step: "5", title: "Response Filtered", desc: "Output is scanned for accidental credential/PII leakage before reaching the user's screen.", color: COLORS.green },
                { step: "6", title: "Audit Logged", desc: "Every step recorded: who asked, what was accessed, what was returned, outcome. 7-year retention.", color: COLORS.yellow },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: 10, fontWeight: 800, color: s.color }}>{s.step}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── AGENT RULESETS ── */}
      {activeSection === "rulesets" && (
        <div>
          <div style={{ background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}30`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.purple, marginBottom: 6 }}>Per-Agent Security Rulesets</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              Each AI agent type operates under a strict, code-enforced ruleset. These are not "guidelines" the AI follows —
              they are hard-coded restrictions in the application. An agent physically cannot call functions outside its allowed set,
              just as a calculator cannot browse the internet. The AI can only press the buttons we wire up.
            </div>
          </div>

          {/* Agent ruleset cards */}
          <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 12 }}>
            {[
              {
                name: "Alert Triage Agent", icon: "🚨", color: COLORS.red,
                purpose: "Merges related alerts and tickets, runs automated troubleshooting via n8n",
                canRead: ["Unified alerts from all tools", "Related ConnectWise tickets (to merge duplicates)", "Device status and public IPs (NinjaRMM)", "Threat data (SentinelOne, Blackpoint)", "Email threats (Avanan)", "DNS blocks (DNS Filter)"],
                canWrite: ["Merge related alerts into single incidents", "Ticket drafts (requires user confirmation)", "Trigger n8n troubleshooting workflows (ping, WAN check, subnet scan)", "Trigger outbound alert notifications (Teams webhook + SMS to on-call tech)"],
                cannotAccess: ["Passwords or credentials — ever", "Internet directly (n8n handles network checks)", "Audit logs", "Billing/licensing data"],
                internet: false,
                mfa: false,
                specialRules: ["Can trigger n8n to ping a public IP from NinjaRMM to check WAN status", "Can check if other devices on same subnet are also down", "Can correlate disk alerts + threat alerts on same device as possible compromise", "Triggers Notification Engine for outbound alerts (Teams/SMS/email)", "Escalation: if on-call tech doesn't respond within X min → auto-escalate to secondary → manager", "All automated checks and notifications logged to audit trail"],
              },
              {
                name: "Ticket Agent", icon: "🎫", color: COLORS.accent,
                purpose: "Create, search, filter, assign, and update ConnectWise tickets via natural language",
                canRead: ["All ConnectWise tickets (filtered by date, client, subject, type, board)", "ConnectWise companies & contacts", "Device info (NinjaRMM)", "Threat status (SentinelOne)", "MFA status (Duo)", "Email status (Avanan)"],
                canWrite: ["Create new tickets (after user confirms draft)", "Assign tickets to users", "Update ticket status (open, in progress, closed)", "Add notes and time entries to tickets"],
                cannotAccess: ["Passwords or credentials — ever", "Internet or external services", "Raw IT Glue documents", "Audit logs", "Financial/billing data"],
                internet: false,
                mfa: false,
                specialRules: ["\"Show me all Contoso tickets from last 7 days\" — filters and displays results", "\"Show Avanan tickets from this week\" — filters by source tool", "Pick a ticket from results → assign to me + update status", "All ticket modifications logged with who, what, when"],
              },
              {
                name: "Knowledge Base Agent", icon: "📚", color: COLORS.green,
                purpose: "Search AND create/update docs — write capability is per-user (Admin enables 'KB Write' flag)",
                canRead: ["IT Glue documents and configs (NOT passwords)", "OneNote pages via Graph API", "SharePoint documents via Graph API", "Pre-indexed RAG embeddings (pgvector)"],
                canWrite: ["Create new IT Glue docs/articles (KB Write perm)", "Update existing IT Glue docs (KB Write perm)", "Draft OneNote/SharePoint pages (KB Write perm)", "All writes require user confirmation before saving"],
                cannotAccess: ["Passwords — excluded from RAG index entirely", "Internet or external services", "Device/endpoint data", "Security alert data", "Ticket modification"],
                internet: false,
                mfa: false,
                specialRules: ["Write is per-user, NOT per-role — Admin enables 'KB Write' flag per user", "Users without KB Write can only search/read — write functions hidden", "All writes require explicit user confirmation before saving", "Every doc create/update audit-logged: kb.document.created, kb.document.updated"],
              },
              {
                name: "Password & TOTP Agent", icon: "🔐", color: COLORS.yellow,
                purpose: "Retrieve IT Glue credentials + TOTP/MFA codes — 2-hour session, fully audited",
                canRead: ["IT Glue password entries (after MFA verification)", "IT Glue TOTP/MFA seeds — generates current 6-digit code"],
                canWrite: ["Audit log entry (automatic)", "Nothing else"],
                cannotAccess: ["Internet or external services", "Any tool data beyond credential lookup", "Bulk export of credentials", "Other users' credential access history", "Keeper vaults (not connected to this agent)"],
                internet: false,
                mfa: true,
                specialRules: ["Entra MFA push via Microsoft Authenticator on first request", "MFA session valid for 2 hours — no re-prompt within that window", "Retrieves passwords AND TOTP codes from IT Glue (e.g., 365 admin MFA)", "TOTP auto-generates current 6-digit code from stored seed with countdown", "Password + TOTP displayed for 60 seconds then auto-cleared", "Rate limit adjustable per user by Admin (default: 10/hr)", "Every retrieval logged with 7-year retention", "Passwords/TOTP NEVER stored in AI conversation history", "Passwords NEVER included in RAG/embedding index"],
              },
            ].map((agent, i) => (
              <div key={i} style={{ background: COLORS.card, border: `1px solid ${agent.color}30`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{agent.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: agent.color }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>{agent.purpose}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: agent.internet ? `${COLORS.red}20` : `${COLORS.green}20`, color: agent.internet ? COLORS.red : COLORS.green }}>
                    {agent.internet ? "INTERNET: ALLOWED (restricted)" : "INTERNET: BLOCKED"}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: agent.mfa ? `${COLORS.yellow}20` : `${COLORS.accent}20`, color: agent.mfa ? COLORS.yellow : COLORS.accent }}>
                    {agent.mfa ? "MFA: REQUIRED" : "MFA: NOT REQUIRED"}
                  </span>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.green, letterSpacing: "0.06em", marginBottom: 4 }}>CAN READ</div>
                  {agent.canRead.map((item, j) => (
                    <div key={j} style={{ fontSize: 9.5, color: COLORS.textSecondary, padding: "1px 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: COLORS.green, fontSize: 10 }}>●</span>{item}
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.06em", marginBottom: 4 }}>CAN WRITE</div>
                  {agent.canWrite.map((item, j) => (
                    <div key={j} style={{ fontSize: 9.5, color: COLORS.textSecondary, padding: "1px 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: COLORS.accent, fontSize: 10 }}>●</span>{item}
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: agent.specialRules ? 8 : 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.red, letterSpacing: "0.06em", marginBottom: 4 }}>CANNOT ACCESS</div>
                  {agent.cannotAccess.map((item, j) => (
                    <div key={j} style={{ fontSize: 9.5, color: COLORS.textSecondary, padding: "1px 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: COLORS.red, fontSize: 10 }}>●</span>{item}
                    </div>
                  ))}
                </div>

                {agent.specialRules && (
                  <div style={{ background: `${COLORS.yellow}08`, border: `1px solid ${COLORS.yellow}20`, borderRadius: 8, padding: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.yellow, letterSpacing: "0.06em", marginBottom: 4 }}>SPECIAL SECURITY RULES</div>
                    {agent.specialRules.map((rule, j) => (
                      <div key={j} style={{ fontSize: 9.5, color: COLORS.textSecondary, padding: "1px 0", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: COLORS.yellow, fontSize: 10 }}>⚠</span>{rule}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DATA SAFEGUARDS ── */}
      {activeSection === "safeguards" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr"), gap: 12, marginBottom: 16 }}>
            {[
              {
                title: "Input Sanitization", icon: "🧹", color: COLORS.orange,
                desc: "Before data reaches AI",
                items: [
                  "Passwords are NEVER sent to AI in prompts",
                  "PII can be masked based on agent type",
                  "IT Glue password fields excluded from all RAG indexing",
                  "Prompt injection detection blocks malicious inputs",
                  "User role verified before any data is included",
                  "Client data scoped — AI only sees data for the relevant client",
                ]
              },
              {
                title: "Output Filtering", icon: "🔍", color: COLORS.purple,
                desc: "Before responses reach the user",
                items: [
                  "Credential pattern detection scans all AI responses",
                  "API keys, passwords, tokens auto-redacted if detected",
                  "Source citations required for knowledge answers",
                  "Confidence scores shown for RAG-based answers",
                  "Hallucination risk flagged when sources are insufficient",
                  "Ticket drafts always require explicit user confirmation",
                ]
              },
              {
                title: "Rate Limiting & Budgets", icon: "⏱️", color: COLORS.cyan,
                desc: "Prevent abuse and cost overruns",
                items: [
                  "Per-user daily token budget (default: 100K tokens/day)",
                  "Monthly team budget across all 20 technicians",
                  "Password retrievals: max 10 per user per hour",
                  "Ticket creation: max 50 per user per day",
                  "Soft alerts at 80%, hard limit at 100% of budget",
                  "Admin-configurable per user — see Cost Management tab",
                ]
              },
            ].map((card, i) => (
              <div key={i} style={{ background: COLORS.card, border: `1px solid ${card.color}25`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{card.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: card.color }}>{card.title}</span>
                </div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>{card.desc}</div>
                {card.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: card.color, flexShrink: 0, marginTop: 5 }} />{item}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Password flow detail */}
          <div style={{ background: COLORS.card, border: `2px solid ${COLORS.red}30`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, letterSpacing: "0.04em", marginBottom: 12 }}>CREDENTIAL + TOTP RETRIEVAL — FULL SECURITY CHAIN</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
              This is the most sensitive operation in the platform. Retrieves passwords AND TOTP/MFA codes from IT Glue. Every step has a security gate.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { step: "1", title: "Request", desc: "Tech asks for a credential. System verifies identity via Entra SSO session + role (Tech+).", color: COLORS.accent },
                { step: "2", title: "Rate Check", desc: "System checks per-user rate limit (adjustable by Admin, default: 10/hr). If exceeded → denied.", color: COLORS.orange },
                { step: "3", title: "MFA Check", desc: "Has user completed MFA in last 2 hours? If yes → skip to step 5. If no → MFA push sent.", color: COLORS.yellow },
                { step: "4", title: "MFA Verify", desc: "User approves Microsoft Authenticator push (number matching). Session valid for 2 hours.", color: COLORS.purple },
                { step: "5", title: "Retrieve", desc: "Password + TOTP code (if stored) fetched from IT Glue. TOTP auto-generates current 6-digit code.", color: COLORS.green },
                { step: "6", title: "Auto-Clear", desc: "After 60 seconds, credential + TOTP removed from screen. New request within 2hrs skips MFA.", color: COLORS.red },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px", fontSize: 10, fontWeight: 800, color: s.color }}>{s.step}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 8.5, color: COLORS.textMuted, lineHeight: 1.3 }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "8px 12px", background: `${COLORS.yellow}08`, border: `1px solid ${COLORS.yellow}20`, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.yellow, fontWeight: 700 }}>EVERY STEP GENERATES AN AUDIT LOG ENTRY</div>
              <div style={{ fontSize: 9.5, color: COLORS.textMuted }}>credential.requested → credential.mfa.sent → credential.mfa.result → credential.revealed → credential.totp.generated → credential.expired — all with user identity, timestamp, IP address, and 7-year retention</div>
            </div>
          </div>

          {/* Comparison table */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: "0.04em", marginBottom: 12 }}>HOW THIS COMPARES TO PUBLIC AI</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}` }}></th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: COLORS.red, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>ChatGPT / Public AI</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: COLORS.green, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>Our Platform (Azure OpenAI)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Data location", "OpenAI servers (US)", "Our Azure tenant (our control)"],
                  ["Internet access", "Full internet access", "No internet access"],
                  ["Training on our data", "May be used for training", "Never — contractually guaranteed"],
                  ["Who can access", "Anyone with a login", "Entra SSO + MFA + role-gated"],
                  ["Audit trail", "None", "Every action logged, 7-year retention"],
                  ["Password access", "Could be pasted in chat", "MFA-gated, 60s auto-clear, rate limited"],
                  ["Actions it can take", "Anything the user types", "Only pre-built, approved functions"],
                  ["Cost control", "Per-seat licensing", "Token budgets per user with alerts"],
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textPrimary, fontWeight: 600 }}>{row[0]}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.red, textAlign: "center" }}>{row[1]}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.green, textAlign: "center" }}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COST MANAGEMENT ── */}
      {activeSection === "costmgmt" && (
        <div>
          {/* Cost overview banner */}
          <div style={{ background: `${COLORS.green}10`, border: `2px solid ${COLORS.green}40`, borderRadius: 12, padding: 18, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.green, marginBottom: 6 }}>AI Cost: ~$50–100/mo with Guardrails (vs. $240–450 without)</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, maxWidth: 700, margin: "0 auto" }}>
              Tiered model routing, prompt caching, and per-user budgets reduce AI costs by 70–80%.
              Admin settings allow granular control over which model handles each function.
            </div>
          </div>

          {/* Tiered Model Routing */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.pink}30`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.pink, letterSpacing: "0.08em", marginBottom: 12 }}>TIERED MODEL ROUTING — SMART MODEL SELECTION PER FUNCTION</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              Not every AI task needs GPT-4o. Simple lookups use GPT-4o-mini (~20x cheaper), while complex reasoning tasks use GPT-4o.
              Admins can override the default model for any function in Settings.
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>AI Function</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Default Model</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Why</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["create_ticket", "GPT-4o", "Complex — extracts context, enriches from multiple tools, drafts detailed ticket"],
                  ["search_tickets", "GPT-4o-mini", "Simple — translates natural language to filter params"],
                  ["update_ticket", "GPT-4o-mini", "Simple — maps user intent to field updates"],
                  ["search_alerts", "GPT-4o-mini", "Simple — filter translation, no complex reasoning"],
                  ["run_troubleshoot", "GPT-4o", "Complex — analyzes multi-tool data, recommends actions"],
                  ["lookup_device", "GPT-4o-mini", "Simple — direct lookup, minimal reasoning"],
                  ["lookup_user", "GPT-4o-mini", "Simple — direct lookup, minimal reasoning"],
                  ["search_knowledge", "GPT-4o", "Complex — RAG retrieval with source evaluation and synthesis"],
                  ["create_document", "GPT-4o", "Complex — drafting quality documentation from natural language"],
                  ["update_document", "GPT-4o", "Complex — editing existing docs accurately, preserving context"],
                  ["get_password", "GPT-4o-mini", "Simple — credential + TOTP lookup after MFA gate"],
                  ["get_client_health", "GPT-4o-mini", "Simple — pre-calculated scores, just formatting"],
                  ["query_audit_log", "GPT-4o-mini", "Simple — filter translation for audit queries"],
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textPrimary, fontFamily: "monospace", fontWeight: 600 }}>{row[0]}</td>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "center", fontWeight: 700, color: row[1] === "GPT-4o" ? COLORS.pink : COLORS.green }}>{row[1]}</td>
                    <td style={{ padding: "5px 8px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`, borderRadius: 8 }}>
              <div style={{ fontSize: 9.5, color: COLORS.orange, fontWeight: 700 }}>ADMIN OVERRIDE: Settings → AI Models — change the model for any function at any time based on quality vs. cost tradeoffs</div>
            </div>
          </div>

          {/* Token Budgets + Rate Limits + Caching */}
          <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr"), gap: 12, marginBottom: 12 }}>
            {/* Token Budgets */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cyan}25`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>💰</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.cyan }}>Token Budgets</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>Configurable spending limits — all optional</div>
              {[
                "Per-user daily token budget (default: 100K tokens/day)",
                "Monthly team budget across all 20 technicians",
                "Soft limit alert at 80% — user warned, not blocked",
                "Hard limit at 100% — requests paused until reset",
                "Admin can override limits per user (power users, etc.)",
                "Budget resets daily at midnight (configurable)",
                "Unused daily budget does NOT roll over",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.cyan, flexShrink: 0, marginTop: 5 }} />{item}
                </div>
              ))}
            </div>

            {/* Per-User Rate Limits */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.orange}25`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>⏱️</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.orange }}>Rate Limits</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>Prevent abuse — all limits admin-configurable</div>
              {[
                "Max requests per hour per user (default: 60)",
                "Max concurrent AI sessions per user (default: 3)",
                "Password retrievals: max 10/user/hour (hard limit)",
                "Ticket creation: max 50/user/day",
                "Cooldown after hitting limit (default: 5 min)",
                "Exponential backoff on repeated limit hits",
                "All rate limit events logged to audit trail",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.orange, flexShrink: 0, marginTop: 5 }} />{item}
                </div>
              ))}
            </div>

            {/* Prompt Caching */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.purple}25`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🗄️</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.purple }}>Prompt Caching</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>Redis-based — estimated 20–30% cost savings</div>
              {[
                "Cache identical lookups (device, user, health score)",
                "5-minute TTL for read-only queries",
                "0 TTL for mutations (tickets, updates) — never cached",
                "Cache key: function + params + user role hash",
                "Redis-based for fast retrieval across sessions",
                "Cache hit ratio tracked in usage dashboard",
                "Estimated savings: 20–30% on total AI spend",
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.purple, flexShrink: 0, marginTop: 5 }} />{item}
                </div>
              ))}
            </div>
          </div>

          {/* Usage Reporting */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.accent}30`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.08em", marginBottom: 12 }}>USAGE REPORTING & MONITORING — ADMIN DASHBOARD</div>
            <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr"), gap: 10 }}>
              {[
                { title: "Real-Time Dashboard", color: COLORS.accent, icon: "📊", items: [
                  "Current token usage vs. budget (gauge chart)",
                  "Per-user breakdown with daily/weekly/monthly views",
                  "Model distribution: GPT-4o vs. GPT-4o-mini usage",
                  "Cache hit ratio and savings estimate",
                  "Most-used AI functions ranked by token consumption",
                ]},
                { title: "Threshold Alerts", color: COLORS.orange, icon: "🔔", items: [
                  "Alert at 80% of monthly team budget",
                  "Alert at 100% — requests paused, admin notified",
                  "Per-user alerts when individual budget exceeded",
                  "Unusual usage spike detection (2x normal)",
                  "Alerts sent via Teams webhook + email",
                ]},
                { title: "Monthly Reports", color: COLORS.green, icon: "📋", items: [
                  "Total tokens consumed by model type",
                  "Cost breakdown: per user, per function, per model",
                  "Trend comparison: month-over-month usage",
                  "Top 5 heaviest users and their function mix",
                  "Recommendations: functions to downgrade/upgrade model",
                ]},
              ].map((card, i) => (
                <div key={i} style={{ background: `${card.color}08`, border: `1px solid ${card.color}20`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{card.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: card.color }}>{card.title}</span>
                  </div>
                  {card.items.map((item, j) => (
                    <div key={j} style={{ fontSize: 9.5, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: card.color, flexShrink: 0, marginTop: 5 }} />{item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Cost Comparison */}
          <div style={{ background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}25`, borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr 1fr"), gap: 10, marginBottom: 10 }}>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.red }}>$240–450</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>Without guardrails (all GPT-4o)</div>
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.orange }}>$120–200</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>Tiered models only</div>
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.green }}>$50–100</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>Tiered + caching + budgets</div>
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.accent }}>$0 net</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>With $333/mo Azure credits</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>20 technicians | ~50 AI requests/tech/day avg | tiered routing + Redis caching + token budgets</div>
          </div>
        </div>
      )}

      {/* ── LIVE DEMOS ── */}
      {activeSection === "demos" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {demos.map((d, i) => (
              <button key={i} onClick={() => setActiveDemo(i)} style={{
                background: activeDemo === i ? `${d.color}20` : COLORS.card,
                border: `1px solid ${activeDemo === i ? d.color : COLORS.border}`,
                borderRadius: 8, padding: "7px 12px", cursor: "pointer",
                color: activeDemo === i ? COLORS.textPrimary : COLORS.textSecondary,
                fontSize: 11, fontWeight: 600, transition: "all 0.2s",
              }}>{d.title}</button>
            ))}
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${demo.color}30`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, background: `${demo.color}08` }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>AI Operations Assistant</span>
              <span style={{ fontSize: 9, color: COLORS.green, background: `${COLORS.green}15`, padding: "2px 6px", borderRadius: 4 }}>Private Azure OpenAI</span>
              <span style={{ fontSize: 9, color: COLORS.red, background: `${COLORS.red}15`, padding: "2px 6px", borderRadius: 4 }}>No Internet Access</span>
              <span style={{ fontSize: 9, color: COLORS.yellow, background: `${COLORS.yellow}15`, padding: "2px 6px", borderRadius: 4 }}>Audit-Logged</span>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {demo.messages.map((msg, i) => {
                const s = roleStyles[msg.role];
                return (
                  <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "9px 12px", marginLeft: msg.role === "tech" ? 0 : 16, marginRight: msg.role === "tech" ? 16 : 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: s.labelColor, letterSpacing: "0.06em", marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FUNCTION CATALOG ── */}
      {activeSection === "functions" && (
        <div>
          <div style={{ background: `${COLORS.pink}08`, border: `1px solid ${COLORS.pink}25`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.pink, marginBottom: 6 }}>How AI Functions Work — The "Button" Model</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              Our AI agents do not have free-form access to systems. Instead, each agent is given a specific set of "buttons" (functions)
              it can press. If a function isn't in the agent's allowed list, it physically cannot call it — this is enforced in code,
              not by AI "rules" that could be bypassed. The AI is like a calculator: it can only press the buttons we wire up.
              Every button press is permission-checked against the user's role and logged to the audit trail.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr"), gap: 8 }}>
            {[
              { fn: "create_ticket", desc: "Draft ticket → user reviews → user confirms → creates in ConnectWise. AI cannot create without confirmation.", role: "Tech+", agents: "Triage, Ticket", color: COLORS.accent },
              { fn: "search_tickets", desc: "\"Show me all Contoso tickets from last 7 days\" or \"all Avanan tickets this week\" — filter by client, date, subject, tool.", role: "Tech+", agents: "Ticket", color: COLORS.accent },
              { fn: "update_ticket", desc: "Assign a ticket to yourself, change status, add notes. Pick from search results and tell AI what to update.", role: "Tech+", agents: "Ticket", color: COLORS.accent },
              { fn: "search_alerts", desc: "Query unified alert queue. Read-only. Results filtered by user's role permissions.", role: "Tech+", agents: "Triage", color: COLORS.red },
              { fn: "run_troubleshoot", desc: "Triggers n8n workflow to ping IP, check WAN, scan subnet. AI reads results but n8n does the work.", role: "Tech+", agents: "Triage", color: COLORS.red },
              { fn: "lookup_device", desc: "Cross-tool device lookup (NinjaRMM + SentinelOne). Returns status, no remote actions.", role: "Tech+", agents: "Triage, Ticket", color: COLORS.green },
              { fn: "lookup_user", desc: "User/contact lookup across ConnectWise, Entra ID. Returns info, cannot modify accounts.", role: "Tech+", agents: "Ticket", color: COLORS.green },
              { fn: "search_knowledge", desc: "Semantic search across IT Glue docs + OneNote + SharePoint. Passwords excluded from index.", role: "Tech+", agents: "Knowledge", color: COLORS.purple },
              { fn: "create_document", desc: "Create new IT Glue doc, OneNote page, or SharePoint article via AI. Requires per-user 'KB Write' flag + confirmation.", role: "Tech+ (KB Write)", agents: "Knowledge", color: COLORS.purple },
              { fn: "update_document", desc: "Update existing doc — append notes, revise sections. Requires per-user 'KB Write' flag + confirmation.", role: "Tech+ (KB Write)", agents: "Knowledge", color: COLORS.purple },
              { fn: "get_password", desc: "IT Glue credential + TOTP/MFA code retrieval. Entra MFA required (2hr session). 60s auto-clear. Rate limit adjustable per user.", role: "Tech+ (MFA)", agents: "Password only", color: COLORS.red },
              { fn: "get_client_health", desc: "Composite health score with 6 metrics. Read-only aggregate data, no sensitive details.", role: "Tech+", agents: "Triage, Ticket", color: COLORS.cyan },
              { fn: "query_audit_log", desc: "Search compliance audit events. Admin-only — techs and managers cannot access.", role: "Admin only", agents: "None (admin tool)", color: COLORS.yellow },
            ].map((f, i) => (
              <div key={i} style={{ background: `${f.color}08`, border: `1px solid ${f.color}20`, borderRadius: 8, padding: "10px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textPrimary, fontFamily: "monospace", marginBottom: 3 }}>{f.fn}</div>
                <div style={{ fontSize: 9.5, color: COLORS.textSecondary, lineHeight: 1.4, marginBottom: 6 }}>{f.desc}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 600, color: f.color, background: `${f.color}15`, padding: "2px 5px", borderRadius: 3 }}>{f.role}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: COLORS.textMuted, background: `${COLORS.textMuted}15`, padding: "2px 5px", borderRadius: 3 }}>{f.agents}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── INFRASTRUCTURE & COST VIEW (AZURE PAAS) ──
const InfraView = () => {
  const azureResources = [
    { component: "Azure Container Apps (4 containers)", spec: "Next.js + n8n + workers + Grafana", monthly: "$40–75", note: "Auto-scaling, managed networking" },
    { component: "Azure Database for PostgreSQL", spec: "Flexible Server, 2 vCores, 4GB + pgvector", monthly: "$50–80", note: "Managed backups, HA available" },
    { component: "Azure Cache for Redis", spec: "Basic C0 — event queue + sessions", monthly: "$15–25", note: "Managed, encrypted, persistent" },
    { component: "Azure OpenAI (Tiered)", spec: "GPT-4o (complex) + GPT-4o-mini (lookups)", monthly: "$50–100", note: "Tiered routing + caching + budgets — was $150–300 without guardrails" },
    { component: "Azure OpenAI (Embeddings)", spec: "text-embedding-3-small, re-index every 6h", monthly: "$10–20", note: "RAG pipeline for IT Glue + OneNote" },
    { component: "Azure Key Vault", spec: "All secrets, API keys, connection strings", monthly: "$1–5", note: "No secrets in code — ever" },
    { component: "Azure Container Registry", spec: "Basic tier — Docker image storage", monthly: "$5", note: "Private registry for CI/CD" },
    { component: "Azure Monitor + Log Analytics", spec: "Container logs, metrics, alerts", monthly: "$10–20", note: "Application insights + diagnostics" },
    { component: "Entra ID P1", spec: "SSO, Conditional Access, MFA", monthly: "Included", note: "Already licensed via M365" },
  ];

  return (
    <div>
      <SectionHeader title="Azure PaaS Infrastructure — Docker Portable" subtitle="Fully managed Azure services now — same Docker containers run self-hosted if needed later" />

      {/* Azure Resources */}
      <div style={{ background: `${COLORS.accent}08`, border: `1px solid ${COLORS.accent}25`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.08em" }}>☁️ AZURE CLOUD (ALL SERVICES) — ~$175–310/mo ESTIMATED</span>
        </div>
        {azureResources.map((item, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "240px 220px 80px 1fr"), gap: 8, alignItems: "center",
            padding: "6px 0", borderBottom: i < azureResources.length - 1 ? `1px solid ${COLORS.border}` : "none",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textPrimary }}>{item.component}</span>
            <span style={{ fontSize: 10, color: COLORS.textSecondary }}>{item.spec}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent }}>{item.monthly}</span>
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>{item.note}</span>
          </div>
        ))}
      </div>

      {/* Docker Portability */}
      <div style={{ background: `${COLORS.green}08`, border: `1px solid ${COLORS.green}25`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.green, letterSpacing: "0.08em", marginBottom: 10 }}>🐳 DOCKER PORTABILITY — SAME CONTAINERS, ANY HOST</div>
        <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 12 }}>
          <div style={{ background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}20`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, marginBottom: 6 }}>Azure Path (Current)</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              Bicep templates → Azure Container Apps{"\n"}
              4 containers: Next.js + n8n + workers + Grafana{"\n"}
              Azure PostgreSQL + Redis + Key Vault{"\n"}
              Auto-scaling, managed backups, HA{"\n"}
              GitHub Actions → ACR → Container Apps
            </div>
          </div>
          <div style={{ background: `${COLORS.green}10`, border: `1px solid ${COLORS.green}20`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, marginBottom: 6 }}>Self-Hosted Path (Portable)</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              docker-compose.yml → Any Linux server{"\n"}
              4 containers: Next.js + n8n + workers + Grafana{"\n"}
              PostgreSQL 16 + pgvector + Redis 7{"\n"}
              Same Dockerfile, same images{"\n"}
              Only connection strings change
            </div>
          </div>
        </div>
      </div>

      {/* CI/CD Pipeline */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.orange}30`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.orange, letterSpacing: "0.08em", marginBottom: 10 }}>📦 GITHUB CI/CD → AZURE CONTAINER APPS</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { step: "1. Push to main", desc: "Developer pushes code to GitHub repo" },
            { step: "2. GitHub Actions", desc: "Lint, type-check, test, build Docker image" },
            { step: "3. Azure Container Registry", desc: "Push image to ACR (private registry)" },
            { step: "4. Container Apps Deploy", desc: "Auto-deploy new revision to Container Apps" },
            { step: "5. Health Check", desc: "Verify all containers healthy + DB migrations run" },
            { step: "6. Rollback if Needed", desc: "Auto-rollback to previous revision on failure" },
          ].map((s, i) => (
            <div key={i} style={{ flex: "1 1 calc(33% - 8px)", minWidth: window.innerWidth < 640 ? 140 : 200, background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.orange }}>{s.step}</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Cost */}
      <div style={{ background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}25`, borderRadius: 10, padding: 14, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>~$175 – $310<span style={{ fontSize: 12, color: COLORS.textMuted }}>/month</span></div>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginTop: 4 }}>Estimated Total Azure Cost (4 containers incl. Grafana + AI with guardrails)</div>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>AI costs reduced 70–80% via tiered models + caching + budgets — offset by $4,000/year (~$333/mo) partner credits</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.green, marginTop: 4 }}>Net cost with credits: $0/month — credits fully cover estimated usage</div>
      </div>
    </div>
  );
};

// ── DATABASE SCHEMA VIEW ──
const DatabaseView = () => {
  const tables = [
    {
      name: "clients", color: COLORS.accent, icon: "🏢",
      columns: ["id (UUID, PK)", "name", "connectwise_id", "ninja_org_id", "s1_site_id", "itglue_org_id", "cipp_tenant_id", "pax8_customer_id", "duo_account_id", "created_at"],
      desc: "Central client registry — maps to all tool-specific tenant/org IDs for cross-vendor reconciliation"
    },
    {
      name: "users", color: COLORS.yellow, icon: "👤",
      columns: ["id (UUID, PK)", "entra_oid", "email", "display_name", "role (Tech/Manager/Admin/Client)", "client_id (FK, nullable)", "last_login"],
      desc: "Platform users authenticated via Entra ID SSO"
    },
    {
      name: "unified_alerts", color: COLORS.red, icon: "🚨",
      columns: ["id (UUID, PK)", "source (enum: 20 tools)", "source_alert_id", "client_id (FK)", "device_id (FK)", "severity (1-5)", "status", "title", "raw_data (JSONB)", "cw_ticket_id", "created_at"],
      desc: "Normalized alerts from all tools — single triage queue"
    },
    {
      name: "tickets", color: COLORS.accent, icon: "🎫",
      columns: ["id (UUID, PK)", "connectwise_id", "client_id (FK)", "summary", "status", "priority", "board", "assigned_to", "created_at", "updated_at"],
      desc: "ConnectWise ticket mirror for cross-referencing"
    },
    {
      name: "devices", color: COLORS.green, icon: "🖥️",
      columns: ["id (UUID, PK)", "client_id (FK)", "hostname", "ninja_id", "s1_agent_id", "os", "last_seen", "status"],
      desc: "Unified device registry across NinjaRMM + SentinelOne"
    },
    {
      name: "audit_events", color: COLORS.orange, icon: "📝",
      columns: ["id (BIGSERIAL, PK)", "timestamp", "actor_id (FK)", "actor_role", "action", "resource_type", "resource_id", "client_id", "detail (JSONB)", "ip_address", "outcome"],
      desc: "Immutable append-only audit log — 7-year retention"
    },
    {
      name: "ai_conversations", color: COLORS.pink, icon: "💬",
      columns: ["id (UUID, PK)", "user_id (FK)", "agent_type", "messages (JSONB)", "functions_called (JSONB)", "created_at"],
      desc: "AI chat history with function call tracking"
    },
    {
      name: "ai_embeddings", color: COLORS.purple, icon: "🧠",
      columns: ["id (UUID, PK)", "source (IT Glue/OneNote/SharePoint)", "source_id", "content (TEXT)", "embedding (vector(1536))", "metadata (JSONB)", "indexed_at"],
      desc: "pgvector embeddings for RAG knowledge base"
    },
    {
      name: "backup_status", color: COLORS.cyan, icon: "💾",
      columns: ["id (UUID, PK)", "source (Cove/Dropsuite)", "client_id (FK)", "device_name", "last_backup", "status", "size_gb"],
      desc: "Backup health from Cove + Dropsuite"
    },
    {
      name: "network_devices", color: COLORS.green, icon: "📡",
      columns: ["id (UUID, PK)", "client_id (FK)", "source (Unifi/WatchGuard)", "device_type", "hostname", "ip", "status", "last_seen"],
      desc: "Network infrastructure from Unifi + WatchGuard"
    },
    {
      name: "on_call_schedules", color: COLORS.pink, icon: "📅",
      columns: ["id (UUID, PK)", "user_id (FK)", "start_time", "end_time", "recurrence (weekly/biweekly/custom)", "phone_number", "teams_channel", "substitute_user_id (FK, nullable)", "escalation_order (INT)", "escalation_timeout_min (INT)", "active"],
      desc: "On-call rotation with substitutions + escalation — primary → secondary → manager after timeout"
    },
    {
      name: "notification_rules", color: COLORS.orange, icon: "🔔",
      columns: ["id (UUID, PK)", "name", "trigger_type (alert/ticket/voicemail/schedule)", "severity_filter", "tool_filter", "client_filter", "channels (JSONB: teams/sms/email)", "schedule_type (daily/oncall/always)", "escalation_chain (JSONB)", "cooldown_min", "active"],
      desc: "Granular notification rules — customizable per severity, tool, client, schedule, and channel"
    },
    {
      name: "notification_log", color: COLORS.orange, icon: "📨",
      columns: ["id (UUID, PK)", "rule_id (FK)", "alert_id (FK, nullable)", "channel (teams/sms/email)", "recipient_user_id (FK)", "sent_at", "acknowledged_at", "escalated", "escalation_level"],
      desc: "Tracks every outbound notification — acknowledged/escalated status for escalation engine"
    },
    {
      name: "voicemail_events", color: COLORS.pink, icon: "📞",
      columns: ["id (UUID, PK)", "threecx_call_id", "caller_number", "caller_name", "matched_client_id (FK)", "matched_contact", "transcription (TEXT)", "cw_ticket_id", "notified_tech_id (FK)", "created_at"],
      desc: "Emergency voicemails — OpenAI transcription, caller identified via PSA lookup, auto-ticketed"
    },
    {
      name: "client_product_map", color: COLORS.yellow, icon: "🔗",
      columns: ["id (UUID, PK)", "client_id (FK)", "vendor (PAX8/CW/Ninja/etc)", "vendor_product_id", "product_name", "licensed_qty", "actual_qty", "unit_type (device/user/mailbox)", "monthly_cost", "last_synced"],
      desc: "Contract reconciliation — maps vendor products to clients with licensed vs. actual counts (future: replaces Gradient MSP)"
    },
    {
      name: "product_catalog", color: COLORS.yellow, icon: "📦",
      columns: ["id (UUID, PK)", "vendor", "vendor_product_id", "normalized_name", "category", "unit_type", "unit_price", "billing_cycle"],
      desc: "Unified product catalog across vendors — normalized names for cross-vendor matching"
    },
    {
      name: "ai_usage_log", color: COLORS.pink, icon: "📈",
      columns: ["id (BIGSERIAL, PK)", "user_id (FK)", "function_name", "model_used (gpt-4o/gpt-4o-mini)", "input_tokens", "output_tokens", "total_tokens", "estimated_cost", "cache_hit (BOOL)", "latency_ms", "created_at"],
      desc: "Per-request AI usage tracking — feeds usage dashboard, budget enforcement, and monthly reports"
    },
    {
      name: "ai_budget_config", color: COLORS.cyan, icon: "💰",
      columns: ["id (UUID, PK)", "scope (global/user)", "user_id (FK, nullable)", "daily_token_limit", "monthly_token_limit", "requests_per_hour", "concurrent_sessions", "soft_limit_pct (default 80)", "enabled (BOOL)", "updated_by", "updated_at"],
      desc: "Token budgets and rate limits — per-user overrides optional, admin-configurable"
    },
    {
      name: "ai_model_config", color: COLORS.orange, icon: "🤖",
      columns: ["id (UUID, PK)", "function_name (UNIQUE)", "default_model", "override_model (nullable)", "override_reason", "updated_by", "updated_at"],
      desc: "Admin-configurable model routing — override which model handles each AI function"
    },
    {
      name: "user_preferences", color: COLORS.accent, icon: "🎨",
      columns: ["id (UUID, PK)", "user_id (FK, UNIQUE per key)", "key (VARCHAR)", "value (JSONB)", "updated_at"],
      desc: "Per-user UI customization — widget layout, pinned clients, default page, table density, sidebar state"
    },
    {
      name: "user_feature_flags", color: COLORS.yellow, icon: "🏷️",
      columns: ["id (UUID, PK)", "user_id (FK)", "flag_name (kb_write/rate_override/etc)", "value (JSONB)", "enabled (BOOL)", "updated_by", "updated_at"],
      desc: "Per-user permission overrides — KB Write access, custom rate limits, feature toggles"
    },
  ];

  return (
    <div>
      <SectionHeader title="Unified Database Schema" subtitle="PostgreSQL 16 + pgvector — Prisma ORM with type-safe queries — all tables multi-tenant via client_id" />
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 10 }}>
        {tables.map((table, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${table.color}25`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{table.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: table.color, fontFamily: "monospace" }}>{table.name}</span>
            </div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 1.4 }}>{table.desc}</div>
            <div style={{ background: `${table.color}06`, borderRadius: 6, padding: 8 }}>
              {table.columns.map((col, j) => (
                <div key={j} style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace", padding: "1px 0", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: table.color, flexShrink: 0 }} />
                  {col}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── REPO STRUCTURE VIEW ──
const RepoView = () => {
  const sections = [
    {
      title: "Infrastructure & CI/CD", color: COLORS.orange, icon: "🔧",
      tree: [
        { path: ".github/workflows/", desc: "CI/CD pipelines", indent: 0 },
        { path: "  ci.yml", desc: "Lint + test + type-check on PR", indent: 1 },
        { path: "  deploy-staging.yml", desc: "Deploy on merge to develop", indent: 1 },
        { path: "  deploy-production.yml", desc: "Deploy on merge to main", indent: 1 },
        { path: "infra/bicep/", desc: "Azure IaC (Bicep templates)", indent: 0 },
        { path: "  main.bicep", desc: "Top-level orchestrator", indent: 1 },
        { path: "  modules/", desc: "container-apps, postgresql, redis, keyvault, openai, acr, monitoring", indent: 1 },
        { path: "infra/docker/", desc: "Self-hosted deployment", indent: 0 },
        { path: "  docker-compose.yml", desc: "Production self-hosted (4 containers + Grafana)", indent: 1 },
        { path: "  docker-compose.dev.yml", desc: "Local development", indent: 1 },
        { path: "  grafana/", desc: "Grafana provisioning: datasources, dashboards, config", indent: 1 },
        { path: "Dockerfile", desc: "Multi-stage Next.js build", indent: 0 },
      ]
    },
    {
      title: "Application (Next.js App Router)", color: COLORS.accent, icon: "⚛️",
      tree: [
        { path: "src/app/(auth)/login/", desc: "Entra SSO login page", indent: 0 },
        { path: "src/app/(dashboard)/", desc: "Authenticated dashboard routes", indent: 0 },
        { path: "  page.tsx", desc: "Main dashboard / alert triage", indent: 1 },
        { path: "  alerts/", desc: "Unified alert queue", indent: 1 },
        { path: "  tickets/", desc: "ConnectWise ticket view", indent: 1 },
        { path: "  clients/[id]/", desc: "Client detail + health scorecard", indent: 1 },
        { path: "  security/", desc: "EDR/MDR/email security overview", indent: 1 },
        { path: "  backups/", desc: "Cove + Dropsuite status", indent: 1 },
        { path: "  network/", desc: "Unifi + WatchGuard overview", indent: 1 },
        { path: "  compliance/", desc: "Audit logs + reports", indent: 1 },
        { path: "  notifications/", desc: "Notification rules, on-call rotations, escalation config", indent: 1 },
        { path: "  analytics/", desc: "Built-in dashboards (Tremor/Recharts) + Grafana embed", indent: 1 },
        { path: "  reconciliation/", desc: "Contract reconciliation — licensed vs. actual per client/vendor", indent: 1 },
        { path: "  settings/ai-models/", desc: "Admin: configure model per AI function (GPT-4o vs mini)", indent: 1 },
        { path: "  settings/ai-usage/", desc: "Admin: AI usage dashboard, budgets, rate limits, reports", indent: 1 },
        { path: "  settings/users/[id]/", desc: "Admin: per-user feature flags, KB Write, rate overrides", indent: 1 },
        { path: "src/app/api/", desc: "API routes", indent: 0 },
        { path: "  webhooks/", desc: "ninja/, blackpoint/, threecx/ (incl. voicemail events)", indent: 1 },
        { path: "  ai/chat/", desc: "AI streaming endpoint", indent: 1 },
      ]
    },
    {
      title: "Backend Services", color: COLORS.purple, icon: "🏗️",
      tree: [
        { path: "src/server/auth/config.ts", desc: "Auth.js + Entra OIDC + RBAC", indent: 0 },
        { path: "src/server/db/schema.prisma", desc: "Prisma schema + pgvector", indent: 0 },
        { path: "src/server/connectors/", desc: "20 tool API connectors", indent: 0 },
        { path: "  base/connector.ts", desc: "Abstract base: auth, retry, rate-limit", indent: 1 },
        { path: "  ninja/ connectwise/ sentinelone/", desc: "Tool-specific API clients + types", indent: 1 },
        { path: "  blackpoint/ avanan/ dnsfilter/", desc: "Security tool connectors", indent: 1 },
        { path: "  itglue/ keeper/ cove/ dropsuite/", desc: "Data + backup connectors", indent: 1 },
        { path: "  unifi/ watchguard/ duo/ ...", desc: "All remaining connectors", indent: 1 },
        { path: "src/server/services/", desc: "Core business logic", indent: 0 },
        { path: "  alert-normalizer.ts", desc: "Layer 3: unified alert schema", indent: 1 },
        { path: "  severity-engine.ts", desc: "Layer 3: cross-tool scoring", indent: 1 },
        { path: "  audit.ts", desc: "Layer 0: immutable audit logging", indent: 1 },
        { path: "  health-score.ts", desc: "Layer 4: client health calculation", indent: 1 },
        { path: "  notification-engine.ts", desc: "Outbound alerts: Teams webhooks + 3CX SMS + email", indent: 1 },
        { path: "  escalation-engine.ts", desc: "Timeout monitoring → auto-escalate if no acknowledgment", indent: 1 },
        { path: "  voicemail-pipeline.ts", desc: "3CX VM → OpenAI Whisper → PSA lookup → auto-ticket", indent: 1 },
        { path: "  on-call.ts", desc: "On-call schedule resolution, rotation, substitutions", indent: 1 },
        { path: "  reconciliation.ts", desc: "Contract reconciliation: licensed vs. actual counts across vendors", indent: 1 },
        { path: "  product-matcher.ts", desc: "Cross-vendor product name normalization and matching", indent: 1 },
      ]
    },
    {
      title: "AI & RAG Pipeline", color: COLORS.pink, icon: "🤖",
      tree: [
        { path: "src/server/ai/agent.ts", desc: "AI orchestrator + function calling", indent: 0 },
        { path: "src/server/ai/functions/", desc: "13 AI function definitions", indent: 0 },
        { path: "  create-ticket.ts", desc: "Draft + confirm → ConnectWise", indent: 1 },
        { path: "  search-knowledge.ts", desc: "RAG semantic search", indent: 1 },
        { path: "  get-password.ts", desc: "MFA-gated credential + TOTP retrieval", indent: 1 },
        { path: "  create-document.ts", desc: "KB Write: create IT Glue/OneNote/SP docs", indent: 1 },
        { path: "  update-document.ts", desc: "KB Write: update existing docs", indent: 1 },
        { path: "  ... (6 more functions)", desc: "alerts, devices, users, health, audit", indent: 1 },
        { path: "src/server/ai/rag/", desc: "RAG pipeline", indent: 0 },
        { path: "  indexer.ts", desc: "IT Glue + OneNote + SharePoint → pgvector", indent: 1 },
        { path: "  retriever.ts", desc: "Semantic search + reranking", indent: 1 },
        { path: "src/server/ai/prompts/", desc: "System prompts with role context", indent: 0 },
        { path: "src/server/ai/cost/", desc: "AI cost management", indent: 0 },
        { path: "  budget-enforcer.ts", desc: "Token budget checks + rate limiting per user", indent: 1 },
        { path: "  model-router.ts", desc: "Tiered model selection per function (admin-configurable)", indent: 1 },
        { path: "  usage-tracker.ts", desc: "Log every AI request: tokens, model, cost, cache hit", indent: 1 },
        { path: "  cache.ts", desc: "Redis prompt caching — 5min TTL for lookups", indent: 1 },
        { path: "  reporting.ts", desc: "Usage aggregation for dashboards + monthly reports", indent: 1 },
      ]
    },
    {
      title: "Workflows & Config", color: COLORS.green, icon: "⚡",
      tree: [
        { path: "n8n/workflows/", desc: "Exported n8n workflow JSON files", indent: 0 },
        { path: "  ninja-alert-sync.json", desc: "NinjaRMM polling workflow", indent: 1 },
        { path: "  sentinelone-threat-sync.json", desc: "SentinelOne polling workflow", indent: 1 },
        { path: "  blackpoint-webhook-handler.json", desc: "Blackpoint webhook processor", indent: 1 },
        { path: "  threecx-voicemail-handler.json", desc: "VM received → transcribe → lookup → ticket → notify", indent: 1 },
        { path: "  alert-teams-webhook.json", desc: "Outbound alert → Teams channel notification", indent: 1 },
        { path: "  alert-sms-oncall.json", desc: "Emergency alert → SMS to on-call tech via 3CX", indent: 1 },
        { path: "  ... (more per tool)", desc: "One workflow per integration", indent: 1 },
        { path: "package.json", desc: "Next.js + tRPC + Prisma + Auth.js + shadcn/ui", indent: 0 },
        { path: "tailwind.config.ts", desc: "Tailwind CSS with dark theme", indent: 0 },
        { path: "prisma/seed.ts", desc: "Initial data seeding", indent: 0 },
      ]
    },
  ];

  return (
    <div>
      <SectionHeader title="GitHub Repository Structure" subtitle="reditech-command-center — monorepo with Next.js app, 20 connectors, n8n workflows, and Azure IaC" />
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr", "1fr 1fr"), gap: 10 }}>
        {sections.map((section, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${section.color}25`, borderRadius: 10, padding: 14, gridColumn: i === 1 ? "span 1" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>{section.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: section.color, letterSpacing: "0.04em" }}>{section.title}</span>
            </div>
            {section.tree.map((item, j) => (
              <div key={j} style={{ display: "flex", gap: 8, padding: "2px 0", marginLeft: item.indent * 16 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.textPrimary, fontFamily: "monospace", minWidth: "auto", whiteSpace: "nowrap" }}>{item.path}</span>
                <span style={{ fontSize: 10, color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── RBAC & SECURITY VIEW ──
const SecurityView = () => {
  const roles = [
    { role: "Tech", color: COLORS.accent, desc: "Frontline technicians — view, triage, create tickets", perms: { dashboard: "View", alerts: "View/Ack", tickets: "View/Create", ai: "Full", kbWrite: "Per-user", passwords: "MFA-gated", audit: "Own actions", settings: "Own prefs", clients: "All" } },
    { role: "Manager", color: COLORS.purple, desc: "Team leads — full operations + team audit visibility", perms: { dashboard: "Full", alerts: "Full", tickets: "Full", ai: "Full", kbWrite: "Per-user", passwords: "MFA-gated", audit: "Team view", settings: "Own prefs", clients: "All" } },
    { role: "Admin", color: COLORS.red, desc: "Platform admins — full access + granular settings control", perms: { dashboard: "Full", alerts: "Full", tickets: "Full", ai: "Full", kbWrite: "Yes", passwords: "MFA-gated", audit: "Full", settings: "Full", clients: "All" } },
    { role: "Client", color: COLORS.green, desc: "Client portal users — read-only access to own data", perms: { dashboard: "Own data", alerts: "Own", tickets: "Own", ai: "Limited", kbWrite: "—", passwords: "—", audit: "—", settings: "—", clients: "Own only" } },
  ];
  const permKeys = ["dashboard", "alerts", "tickets", "ai", "kbWrite", "passwords", "audit", "settings", "clients"];

  const securityLayers = [
    { title: "Authentication", color: COLORS.yellow, icon: "🔐", items: [
      "Entra ID SSO with OIDC + PKCE flow",
      "Conditional Access: MFA required for all users",
      "Device compliance policies (optional enforcement)",
      "Session timeout: 8 hours active, 24 hours absolute",
    ]},
    { title: "Authorization", color: COLORS.purple, icon: "🛡️", items: [
      "4 RBAC roles mapped to Entra security groups",
      "Per-function permission gating on all tRPC routes",
      "AI functions role-gated (e.g., audit queries = Admin only)",
      "Client data isolation enforced at query level",
    ]},
    { title: "Secrets Management", color: COLORS.orange, icon: "🗝️", items: [
      "All API keys in Azure Key Vault — never in code",
      "Managed identities for Azure service-to-service auth",
      "Connection strings injected as env vars at deploy time",
      "Key rotation support without code changes",
    ]},
    { title: "Data Protection", color: COLORS.green, icon: "🔒", items: [
      "TLS 1.3 for all connections (Azure-managed certs)",
      "PostgreSQL encryption at rest (Azure-managed)",
      "Passwords + TOTP seeds excluded from RAG vector index",
      "Retrieved passwords/TOTP auto-clear after 60 seconds",
      "Password rate limit: adjustable per user by Admin",
    ]},
    { title: "Audit & Compliance", color: COLORS.accent, icon: "📝", items: [
      "Immutable append-only audit log (no UPDATE/DELETE)",
      "Every action logged: auth, AI, tickets, data access, KB writes",
      "7-year retention: hot (PostgreSQL) + cold (archive)",
      "SOC 2 / HIPAA framework alignment",
    ]},
    { title: "AI Guardrails", color: COLORS.pink, icon: "🤖", items: [
      "All AI function calls role-checked before execution",
      "KB Write gated per-user (not per-role) — Admin flag",
      "Tiered model routing — GPT-4o for complex, mini for simple",
      "Per-user daily token budgets with soft/hard limits",
      "Admin-configurable model assignments per function",
      "Usage reporting with threshold alerts at 80% + 100%",
    ]},
    { title: "Granular Admin Controls", color: COLORS.yellow, icon: "⚙️", items: [
      "Per-user feature flags (KB Write, rate limits, budgets)",
      "Adjustable rate limits per user per feature",
      "AI model config per function (Settings → AI Models)",
      "End-user dashboard customization within admin bounds",
      "Dark mode only — modern, consistent UI across platform",
    ]},
  ];

  return (
    <div>
      <SectionHeader title="RBAC Roles & Security Architecture" subtitle="Entra ID security groups → platform roles — enforced at every layer" />

      {/* RBAC Matrix */}
      <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}`, overflowX: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.yellow, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>PERMISSION MATRIX</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Role</th>
              {permKeys.map(k => (
                <th key={k} style={{ textAlign: "center", padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600, textTransform: "capitalize" }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: "8px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.role}</span>
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>{r.desc}</div>
                </td>
                {permKeys.map(k => (
                  <td key={k} style={{ textAlign: "center", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, color: r.perms[k] === "—" ? COLORS.textMuted : r.perms[k] === "Full" ? COLORS.green : COLORS.textSecondary, fontWeight: r.perms[k] === "Full" ? 700 : 400 }}>
                    {r.perms[k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security Layers */}
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr 1fr"), gap: 10 }}>
        {securityLayers.map((layer, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${layer.color}25`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{layer.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: layer.color }}>{layer.title}</span>
            </div>
            {layer.items.map((item, j) => (
              <div key={j} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.4 }}>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: layer.color, flexShrink: 0, marginTop: 5 }} />{item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── TECH STACK VIEW ──
const TechStackView = () => {
  const stack = [
    { category: "Frontend", color: COLORS.accent, items: [
      { name: "Next.js 14+", desc: "App Router — full-stack React framework with SSR + API routes" },
      { name: "React 18", desc: "Component library with hooks, Suspense, streaming" },
      { name: "TypeScript", desc: "End-to-end type safety across frontend + backend" },
      { name: "Tailwind CSS", desc: "Utility-first styling with dark theme" },
      { name: "shadcn/ui", desc: "High-quality UI components (Radix + Tailwind)" },
      { name: "Tremor + Recharts", desc: "Built-in dashboards — KPI charts, trend lines, bar/area/pie charts (replaces BrightGauge)" },
    ]},
    { category: "Backend API", color: COLORS.purple, items: [
      { name: "tRPC v11", desc: "End-to-end type-safe API — no REST boilerplate" },
      { name: "Auth.js (NextAuth v5)", desc: "Entra ID OIDC provider with RBAC role mapping" },
      { name: "Prisma ORM", desc: "Type-safe database queries with auto-generated types" },
      { name: "ioredis", desc: "Redis client for event queue, sessions, rate limiting" },
    ]},
    { category: "Database & Storage", color: COLORS.cyan, items: [
      { name: "PostgreSQL 16", desc: "Azure Flexible Server — relational + JSONB for flexibility" },
      { name: "pgvector", desc: "Vector similarity search for RAG embeddings (1536-dim)" },
      { name: "Prisma Migrate", desc: "Forward-only numbered migrations with audit table support" },
    ]},
    { category: "AI & ML", color: COLORS.pink, items: [
      { name: "Azure OpenAI (GPT-4o)", desc: "Chat completions + function calling for all AI agents" },
      { name: "text-embedding-3-small", desc: "1536-dim embeddings for RAG knowledge index" },
      { name: "@azure/openai SDK", desc: "Official Azure SDK with managed identity auth" },
    ]},
    { category: "Infrastructure", color: COLORS.orange, items: [
      { name: "Azure Container Apps", desc: "Managed Docker containers — auto-scaling, ingress, TLS" },
      { name: "Azure Key Vault", desc: "Centralized secrets management — no keys in code" },
      { name: "Bicep", desc: "Azure-native IaC — simpler than Terraform for Azure-only" },
      { name: "Docker", desc: "Containerized everything — portable to any host" },
    ]},
    { category: "Orchestration & CI/CD", color: COLORS.green, items: [
      { name: "n8n", desc: "Visual workflow builder for API polling + webhook routing" },
      { name: "GitHub Actions", desc: "CI/CD: lint → test → build → push → deploy → health check" },
      { name: "Azure Container Registry", desc: "Private Docker image storage for deployments" },
    ]},
    { category: "Analytics & Reporting", color: COLORS.orange, items: [
      { name: "Grafana (4th container)", desc: "Advanced analytics — iframe embedded, ad-hoc queries, custom dashboards for power users" },
      { name: "Tremor", desc: "React dashboard components — bar, area, donut, KPI cards, spark charts" },
      { name: "Recharts", desc: "Composable chart library — trend lines, time series, stacked bar charts" },
    ]},
  ];

  return (
    <div>
      <SectionHeader title="Technology Stack" subtitle="Modern, type-safe, containerized — every piece chosen for developer velocity + production reliability" />
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr 1fr", "1fr 1fr"), gap: 10 }}>
        {stack.map((cat, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${cat.color}25`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{cat.category}</div>
            {cat.items.map((item, j) => (
              <div key={j} style={{ marginBottom: j < cat.items.length - 1 ? 8 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── ROADMAP (6 PHASES) ──
const PhaseView = () => {
  const phases = [
    { phase: "Phase 1", title: "Foundation + Entra SSO", weeks: "Weeks 1–3", color: COLORS.accent, tasks: [
      "GitHub repo with branch protection (main → production, develop → staging)",
      "Bicep templates for all Azure resources (Container Apps, PostgreSQL, Redis, Key Vault, ACR)",
      "Dockerfile + docker-compose.dev.yml for local development",
      "GitHub Actions CI/CD pipeline → Azure Container Apps auto-deploy",
      "Next.js app with App Router, Tailwind, shadcn/ui — dark mode only (no light theme)",
      "Auth.js + Entra ID OIDC + PKCE with 4 RBAC groups",
      "Prisma schema: users, clients, audit_events tables",
      "Immutable audit logging service (Layer 0 — from day 1)",
      "Dashboard shell with sidebar navigation + settings page",
    ]},
    { phase: "Phase 2", title: "Core Integrations", weeks: "Weeks 4–6", color: COLORS.red, tasks: [
      "Base connector class: auth, retry, rate limiting, error handling",
      "NinjaRMM connector — device status, alerts, patch compliance",
      "ConnectWise PSA connector — tickets, time entries, companies/contacts",
      "SentinelOne connector — threats, agent health, incidents",
      "Blackpoint connector — MDR alerts via webhook + API polling",
      "Unified alert schema + normalizer (Layer 3)",
      "Severity scoring engine (cross-tool signal analysis)",
      "Client correlation service (ConnectWise → tool tenant IDs)",
      "n8n container with polling workflows + Redis event queue",
      "Alert triage dashboard page (Layer 4)",
    ]},
    { phase: "Phase 3", title: "AI Foundation + Cost Management", weeks: "Weeks 7–9", color: COLORS.pink, tasks: [
      "Azure OpenAI provisioned (GPT-4o + GPT-4o-mini + text-embedding-3-small)",
      "AI agent orchestrator with function calling",
      "AI functions: create_ticket, search_tickets, search_alerts, lookup_device, lookup_user",
      "AI functions: create_document, update_document (KB Write — per-user gated)",
      "Tiered model routing — GPT-4o for complex tasks, GPT-4o-mini for simple lookups",
      "Admin model config UI — Settings → AI Models, override per function",
      "Per-user feature flags system (KB Write, rate limit overrides, feature toggles)",
      "Token budget enforcer — per-user daily + monthly team limits (Redis-tracked)",
      "Per-user rate limiting — requests/hour, concurrent sessions, cooldown",
      "Redis prompt caching — 5-min TTL for lookups, 0 for mutations",
      "AI usage tracking — log every request: tokens, model, cost, cache hit",
      "AI usage dashboard — real-time gauge, per-user breakdown, function stats",
      "Threshold alerts at 80% and 100% of budget (Teams + email)",
      "RAG pipeline: IT Glue + OneNote + SharePoint → pgvector embeddings",
      "AI function: search_knowledge (semantic RAG search)",
      "6-hour re-indexing cron job for embeddings",
      "AI chat sidebar component with streaming responses",
      "Ticket creation preview/confirmation UI flow",
      "All AI actions audit-logged with role context",
    ]},
    { phase: "Phase 4", title: "Security & Identity", weeks: "Weeks 10–12", color: COLORS.purple, tasks: [
      "MFA step-up gate for password + TOTP retrieval (MS Authenticator push)",
      "AI function: get_password — credentials + TOTP codes from IT Glue (60s auto-clear, adjustable rate limit per user)",
      "Duo connector — auth logs, enrollment, bypass events",
      "AutoElevate connector — elevation requests, approvals",
      "Quickpass connector — verification events, password resets",
      "Avanan connector — email threats, phishing blocks",
      "DNS Filter connector — DNS blocks, policy violations",
      "Huntress SAT connector — phishing sim, training completion",
      "CIPP connector — 365 tenant health, secure scores, licenses",
      "Keeper connector — read-only client vault (MFA-gated)",
      "Security overview dashboard page",
    ]},
    { phase: "Phase 5", title: "Backup, Network, Phone & Alerting", weeks: "Weeks 13–15", color: COLORS.cyan, tasks: [
      "Cove Backup connector — backup status, job history, failure alerts",
      "Dropsuite connector — 365 backup status per client",
      "Unifi connector — switch/AP status, client counts (local controllers)",
      "WatchGuard connector — firewall status, VPN tunnels, threat logs",
      "3CX connector — call logs, queue stats, voicemails, presence, inbound/outbound SMS",
      "3CX voicemail → OpenAI API (Whisper) transcription pipeline",
      "Emergency VM → auto-ticket: caller number lookup in ConnectWise PSA + transcription analysis",
      "Notification & Alerting Engine — granular, customizable rules per severity/tool/client/schedule",
      "On-call rotation builder with substitutions + escalation paths (primary → secondary → manager)",
      "Escalation engine: if no response within X min → auto-escalate to next in chain",
      "Notification channels: Teams webhooks, SMS via 3CX, email — daily + on-call schedules",
      "PAX8 connector — license counts, subscriptions, billing",
      "Backup + Network + Notification dashboard pages",
    ]},
    { phase: "Phase 6", title: "Dashboards, Reporting & Compliance", weeks: "Weeks 16–19", color: COLORS.green, tasks: [
      "Built-in dashboards with Tremor + Recharts (replaces BrightGauge)",
      "KPI widgets: ticket volume, response time, SLA %, backup success rate, alert trends",
      "Per-client dashboard views with health trend charts",
      "Grafana container — connected to PostgreSQL, pre-built dashboard templates",
      "Grafana iframe embed for advanced ad-hoc analytics",
      "Client health score engine (6 weighted metrics: patch, backup, EDR, MFA, training, tickets)",
      "Client health scorecard components + per-client detail pages",
      "QBR report generator (automated PDF with trends + recommendations)",
      "Compliance audit report exporter (CSV/PDF, date range, filters)",
      "Alert triage AI agent: auto-merge duplicates, suggest correlations",
      "Hot/cold audit log tiering (PostgreSQL → compressed archive)",
      "Client-facing read-only portal",
      "Full docker-compose.yml for self-hosted deployment path",
      "End-user dashboard customization — drag/drop widgets, pin clients, personal filters",
      "User preferences system (user_preferences table + localStorage sync)",
      "Responsive UI polish, keyboard shortcuts, notifications",
    ]},
    { phase: "Phase 7", title: "Contract Reconciliation (Gradient MSP Replacement)", weeks: "Weeks 20–23", color: COLORS.yellow, tasks: [
      "Unified product catalog — normalize product names across PAX8, ConnectWise, NinjaRMM, etc.",
      "Client-product mapping engine — licensed quantity vs. actual count per tool per client",
      "Device count aggregation: NinjaRMM agents, SentinelOne agents, Cove endpoints per client",
      "License count aggregation: PAX8 subscriptions, CIPP M365 licenses, Duo enrollments per client",
      "Discrepancy detection — flag over-provisioned or under-licensed clients automatically",
      "Contract reconciliation dashboard — side-by-side view of billed vs. actual per vendor/product",
      "Profit margin calculation — vendor cost vs. client billing per product line",
      "Bulk matching UI — map new products/clients across vendors when auto-match fails",
      "Monthly reconciliation report (PDF/CSV export) per client or across portfolio",
      "AI function: reconcile_client — natural language contract queries",
    ]},
  ];

  return (
    <div>
      <SectionHeader title="Implementation Roadmap — 7 Phases, 23 Weeks" subtitle="Each phase is testable independently — build, deploy, verify before moving to next" />
      <div style={{ display: "grid", gridTemplateColumns: rGrid("1fr", "1fr", "1fr 1fr"), gap: 10 }}>
        {phases.map((p, i) => (
          <div key={i} style={{ background: COLORS.card, border: `1px solid ${p.color}30`, borderRadius: 12, padding: 14, borderTop: `3px solid ${p.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: p.color }}>{p.phase}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{p.title}</div>
              </div>
              <span style={{ fontSize: 9, color: COLORS.textMuted, background: `${p.color}12`, padding: "2px 7px", borderRadius: 4 }}>{p.weeks}</span>
            </div>
            {p.tasks.map((task, j) => (
              <div key={j} style={{ fontSize: 10, color: COLORS.textSecondary, padding: "3px 0", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: p.color, flexShrink: 0, marginTop: 4 }} />{task}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── MAIN APP ──
const tabs = [
  { id: "architecture", label: "Architecture" },
  { id: "techstack", label: "Tech Stack" },
  { id: "database", label: "Database Schema" },
  { id: "repo", label: "Repo Structure" },
  { id: "security", label: "RBAC & Security" },
  { id: "compliance", label: "Compliance Audit" },
  { id: "ai", label: "AI Assistant" },
  { id: "infra", label: "Infrastructure & Cost" },
  { id: "roadmap", label: "Roadmap" },
];

function MSPArchitecture() {
  const [activeTab, setActiveTab] = useState("architecture");
  const [selectedTool, setSelectedTool] = useState(null);
  const [activeTier, setActiveTier] = useState("auth");
  const r = useResponsive();

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", color: COLORS.textPrimary }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: r.isMobile ? "12px 12px 0" : "18px 24px 0", background: `linear-gradient(180deg, ${COLORS.accent}08 0%, transparent 100%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>⚡</div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: r.isMobile ? 14 : 17, fontWeight: 800, letterSpacing: "-0.02em" }}>REDiTECH Unified Command Center</h1>
            <p style={{ margin: 0, fontSize: r.isMobile ? 9 : 10, color: COLORS.textMuted, lineHeight: 1.4 }}>v4.0 — 20 Integrations | 4 AI Agents (13 Functions) | Entra SSO | Azure PaaS | Docker Portable | Dark Mode</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 10, overflowX: "auto", WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? COLORS.accent : "transparent"}`,
              color: activeTab === tab.id ? COLORS.textPrimary : COLORS.textMuted,
              fontSize: r.isMobile ? 10 : 11, fontWeight: 600, padding: r.isMobile ? "8px 10px" : "8px 14px", cursor: "pointer",
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: r.isMobile ? "12px" : "18px 24px", maxWidth: 960, margin: "0 auto" }}>
        {activeTab === "architecture" && <ArchitectureView selectedTool={selectedTool} setSelectedTool={setSelectedTool} activeTier={activeTier} setActiveTier={setActiveTier} />}
        {activeTab === "techstack" && <TechStackView />}
        {activeTab === "database" && <DatabaseView />}
        {activeTab === "repo" && <RepoView />}
        {activeTab === "security" && <SecurityView />}
        {activeTab === "compliance" && <ComplianceView />}
        {activeTab === "ai" && <AIAssistantView />}
        {activeTab === "infra" && <InfraView />}
        {activeTab === "roadmap" && <PhaseView />}
      </div>
    </div>
  );
}
