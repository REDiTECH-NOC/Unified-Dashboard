/**
 * ConnectWise → Normalized type mappers.
 * Transforms CW API responses into the unified schema.
 */

import type {
  NormalizedTicket,
  NormalizedOrganization,
  NormalizedContact,
} from "../_interfaces/common";
import type { TicketNote, BoardStatus } from "../_interfaces/psa";
import type {
  CWTicket,
  CWTicketNote,
  CWCompany,
  CWContact,
  CWBoardStatus,
} from "./types";

const TOOL_ID = "connectwise";

function mapPriority(
  priority?: { name: string; sort?: number }
): NormalizedTicket["priority"] {
  if (!priority) return "none";
  const name = priority.name.toLowerCase();
  if (name.includes("critical") || name.includes("emergency")) return "critical";
  if (name.includes("high") || name.includes("urgent")) return "high";
  if (name.includes("medium") || name.includes("normal")) return "medium";
  if (name.includes("low")) return "low";
  return "none";
}

export function mapTicket(ticket: CWTicket): NormalizedTicket {
  return {
    sourceToolId: TOOL_ID,
    sourceId: String(ticket.id),
    summary: ticket.summary,
    description: ticket.initialDescription,
    status: ticket.status?.name ?? "Unknown",
    priority: mapPriority(ticket.priority),
    type: ticket.type?.name,
    board: ticket.board?.name,
    companySourceId: ticket.company?.id ? String(ticket.company.id) : undefined,
    companyName: ticket.company?.name,
    contactName: ticket.contact?.name,
    contactEmail: ticket.contactEmailAddress,
    assignedTo: ticket.owner?.name ?? ticket.resources,
    createdAt: ticket.dateEntered ? new Date(ticket.dateEntered) : new Date(),
    updatedAt: ticket._info?.lastUpdated
      ? new Date(ticket._info.lastUpdated)
      : undefined,
    closedAt: ticket.closedDate ? new Date(ticket.closedDate) : undefined,
    _raw: ticket,
  };
}

export function mapTicketNote(note: CWTicketNote): TicketNote {
  return {
    id: String(note.id),
    text: note.text,
    createdBy: note.member?.name,
    createdAt: note.dateCreated ? new Date(note.dateCreated) : new Date(),
    internal: note.internalAnalysisFlag,
  };
}

export function mapCompany(company: CWCompany): NormalizedOrganization {
  return {
    sourceToolId: TOOL_ID,
    sourceId: String(company.id),
    name: company.name,
    phone: company.phoneNumber,
    website: company.website,
    address: {
      street: [company.addressLine1, company.addressLine2]
        .filter(Boolean)
        .join(", "),
      city: company.city,
      state: company.state,
      zip: company.zip,
      country: company.country?.name,
    },
    status: company.status?.name,
    _raw: company,
  };
}

export function mapContact(contact: CWContact): NormalizedContact {
  const emailItem = contact.communicationItems?.find(
    (item) =>
      item.type.name.toLowerCase() === "email" && item.defaultFlag
  ) ?? contact.communicationItems?.find(
    (item) => item.type.name.toLowerCase() === "email"
  );

  const phoneItem = contact.communicationItems?.find(
    (item) =>
      item.type.name.toLowerCase().includes("phone") && item.defaultFlag
  );

  return {
    sourceToolId: TOOL_ID,
    sourceId: String(contact.id),
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: emailItem?.value,
    phone: phoneItem?.value ?? contact.defaultPhoneNbr,
    title: contact.title,
    organizationSourceId: contact.company?.id
      ? String(contact.company.id)
      : undefined,
    organizationName: contact.company?.name,
    _raw: contact,
  };
}

export function mapBoardStatus(status: CWBoardStatus): BoardStatus {
  return {
    id: String(status.id),
    name: status.name,
    boardId: String(status.boardId),
    sortOrder: status.sortOrder,
  };
}
