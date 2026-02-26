/**
 * Authentication middleware for the on-prem relay agent.
 *
 * The agent sends its API key via the Authorization: Bearer header.
 * We look up candidates by the key prefix (first 8 chars, indexed),
 * then verify the full key with bcrypt.
 */
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export async function authenticateAgent(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (apiKey.length < 32) return null;

  const prefix = apiKey.substring(0, 8);

  // Fast lookup by indexed prefix, then full bcrypt verify
  const candidates = await prisma.onPremAgent.findMany({
    where: { apiKeyPrefix: prefix, isActive: true },
  });

  for (const agent of candidates) {
    if (await bcrypt.compare(apiKey, agent.apiKeyHash)) {
      return agent;
    }
  }

  return null;
}
