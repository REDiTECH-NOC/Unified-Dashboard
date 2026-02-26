/**
 * SSO helper file provider for 3CX PBX deployments.
 *
 * Reads the SSO template files from disk so the relay agent
 * receives the latest version with each task — no need to
 * redeploy the agent when updating SSO helpers.
 */
import fs from "fs";
import path from "path";

const TEMPLATE_DIR = path.join(process.cwd(), "sso-templates");

export const SSO_TARGET_PATH = "/var/lib/3cxpbx/Data/Http/wwwroot/webclient/";

export const SSO_FILE_NAMES = ["sso-helper.html", "sso-helper.js"] as const;

export function getSsoFiles(): Array<{ name: string; content: string }> {
  return SSO_FILE_NAMES.map((name) => ({
    name,
    content: fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf-8"),
  }));
}
