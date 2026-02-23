/**
 * Tool credential schemas — data-driven config for integration dialogs.
 *
 * Adding a future tool:
 * 1. Add entry to TOOL_SCHEMAS with field definitions
 * 2. Add toolId to BUILT_TOOLS
 * That's it — zero UI code changes.
 */

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpText?: string;
  defaultValue?: string;
}

export interface ToolSchema {
  toolId: string;
  displayName: string;
  description: string;
  fields: FieldDef[];
  instructions?: string;
}

/** Tools with built connectors — show Configure button */
export const BUILT_TOOLS = new Set([
  "connectwise",
  "ninjaone",
  "sentinelone",
  "itglue",
  "unifi",
  "n8n",
  "blackpoint",
  "cipp",
]);

/** 3CX has its own multi-instance dialog */
export const THREECX_TOOL_ID = "threecx";

/** SSO has its own dedicated card + dialog */
export const SSO_TOOL_ID = "entra-id";

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  connectwise: {
    toolId: "connectwise",
    displayName: "ConnectWise PSA",
    description: "ConnectWise Manage REST API credentials for ticketing and PSA operations.",
    fields: [
      {
        key: "companyId",
        label: "Company ID",
        type: "text",
        placeholder: "yourcompany",
        required: true,
        helpText: "Your ConnectWise company identifier (used in API auth)",
      },
      {
        key: "publicKey",
        label: "Public Key",
        type: "password",
        placeholder: "Enter public key",
        required: true,
      },
      {
        key: "privateKey",
        label: "Private Key",
        type: "password",
        placeholder: "Enter private key",
        required: true,
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: false,
        helpText: "Optional. API member client ID for request identification.",
      },
    ],
    instructions:
      "Create an API member in ConnectWise Manage under System > Members > API Members. " +
      "The public/private key pair is generated there. The Company ID is your ConnectWise login company identifier.",
  },

  ninjaone: {
    toolId: "ninjaone",
    displayName: "NinjaOne RMM",
    description: "OAuth2 client credentials for NinjaOne RMM API v2.",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Enter OAuth2 client ID",
        required: true,
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Enter OAuth2 client secret",
        required: true,
      },
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "url",
        placeholder: "https://app.ninjarmm.com",
        required: false,
        defaultValue: "https://app.ninjarmm.com",
        helpText: "Only change if using a regional instance (e.g., eu.ninjarmm.com)",
      },
    ],
    instructions:
      "Go to Administration > Apps > API in your NinjaOne dashboard. " +
      "Create a new API application with Client Credentials grant type. Copy the Client ID and Client Secret.",
  },

  sentinelone: {
    toolId: "sentinelone",
    displayName: "SentinelOne",
    description: "API token and tenant URL for SentinelOne EDR.",
    fields: [
      {
        key: "baseUrl",
        label: "Console URL",
        type: "url",
        placeholder: "https://your-tenant.sentinelone.net/web/api/v2.1",
        required: true,
        helpText: "Your full SentinelOne API base URL including /web/api/v2.1",
      },
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        placeholder: "Enter SentinelOne API token",
        required: true,
      },
    ],
    instructions:
      "In your SentinelOne console, go to Settings > Users > Service Users. " +
      "Create a service user and generate an API token. The Console URL is your tenant-specific URL.",
  },

  itglue: {
    toolId: "itglue",
    displayName: "IT Glue",
    description: "API key for IT Glue documentation platform.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Enter IT Glue API key",
        required: true,
      },
    ],
    instructions:
      "In IT Glue, go to Account > Settings > API Keys. " +
      "Generate a new API key with the required permissions. Copy the key immediately — it cannot be viewed again.",
  },

  unifi: {
    toolId: "unifi",
    displayName: "UniFi Network",
    description:
      "UniFi Site Manager API key for network device monitoring across all managed sites.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Enter UniFi API key",
        required: true,
        helpText: "One API key provides access to all sites your account manages.",
      },
    ],
    instructions:
      "Log into unifi.ui.com, click API in the left navigation, then generate an API key. " +
      "A single key provides read-only access to all sites your Ubiquiti account is admin/owner on.",
  },

  blackpoint: {
    toolId: "blackpoint",
    displayName: "Blackpoint CompassOne",
    description:
      "Blackpoint CompassOne MDR/SOC platform. Provides detections, assets, vulnerability management, " +
      "cloud MDR (M365/Google/Cisco), and notification channel management.",
    fields: [
      {
        key: "apiToken",
        label: "API Token (JWT)",
        type: "password",
        placeholder: "Enter CompassOne API token",
        required: true,
        helpText: "Bearer token for API authentication. Generate in CompassOne portal under Settings → API.",
      },
    ],
    instructions:
      "Log into the CompassOne portal, navigate to Settings → API, and generate an API token. " +
      "The token provides access to all tenants (customers) under your MSP account. " +
      "Endpoints are scoped per-tenant using the x-tenant-id header.",
  },

  cipp: {
    toolId: "cipp",
    displayName: "CIPP",
    description:
      "CyberDrain Improved Partner Portal — multi-tenant Microsoft 365 management via GDAP. " +
      "User management, license administration, security monitoring, Intune, and Teams/SharePoint.",
    fields: [
      {
        key: "baseUrl",
        label: "CIPP API URL",
        type: "url",
        placeholder: "https://your-cipp-instance.azurewebsites.net",
        required: true,
        helpText: "The base URL of your self-hosted CIPP deployment (Azure Function App URL).",
      },
      {
        key: "applicationId",
        label: "Application (Client) ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
        helpText: "Entra ID App Registration Application (Client) ID for CIPP API access.",
      },
      {
        key: "applicationSecret",
        label: "Application Secret",
        type: "password",
        placeholder: "Enter client secret value",
        required: true,
        helpText: "Client secret from the Entra App Registration. Use the secret value, not the secret ID.",
      },
      {
        key: "tenantId",
        label: "Tenant ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
        helpText: "Your MSP tenant ID (the tenant where CIPP's app registration lives, NOT a customer tenant).",
      },
    ],
    instructions:
      "CIPP requires an Entra ID App Registration with the CIPP API permissions. " +
      "Create an API client in CIPP under Settings → CIPP → API Clients. " +
      "The Application ID, Secret, and Tenant ID come from your MSP tenant's app registration. " +
      "The API URL is your CIPP Function App deployment URL.",
  },

  n8n: {
    toolId: "n8n",
    displayName: "n8n Automation",
    description: "n8n workflow automation platform. Configure the instance URL for sidebar access and API key for workflow integration.",
    fields: [
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "url",
        placeholder: "https://n8n.yourdomain.com",
        required: true,
        helpText: "The public-facing URL for your n8n instance. Used for sidebar link and API calls.",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Enter n8n API key",
        required: false,
        helpText: "Required for workflow triggers, status monitoring, and execution history. Generate in n8n under Settings → API.",
      },
    ],
    instructions:
      "Enter the public URL where your n8n instance is accessible and an API key for backend integration. " +
      "The URL appears as a sidebar link for users with the 'Access n8n' permission. " +
      "The API key enables the dashboard to trigger workflows and monitor execution status.",
  },

};
