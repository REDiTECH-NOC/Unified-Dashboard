/**
 * IPsaConnector — interface for Professional Services Automation tools.
 *
 * Current implementation: ConnectWise Manage
 * Future: Autotask, HaloPSA, Syncro, etc.
 *
 * To swap PSA tools: implement this interface in a new connector, register it,
 * and configure credentials. No router or UI changes needed.
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type {
  NormalizedTicket,
  NormalizedOrganization,
  NormalizedContact,
} from "./common";

export interface CompanyFilter {
  searchTerm?: string;
  statuses?: string[];
  types?: string[];
}

export interface TicketFilter {
  companyId?: string;
  status?: string;
  priority?: string;
  boardId?: string;
  assignedTo?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  searchTerm?: string;
}

export interface CreateTicketInput {
  summary: string;
  description?: string;
  companyId: string;
  contactId?: string;
  priority?: "critical" | "high" | "medium" | "low" | "none";
  boardId?: string;
  type?: string;
  assignTo?: string;
}

export interface UpdateTicketInput {
  status?: string;
  priority?: string;
  assignTo?: string;
  boardId?: string;
  /** Add a note/comment to the ticket */
  note?: string;
}

export interface TicketNote {
  id: string;
  text: string;
  createdBy?: string;
  createdAt: Date;
  internal: boolean;
  /** "internalAnalysis" | "discussion" | "resolution" */
  noteType?: string;
}

export interface AddNoteInput {
  ticketId: string;
  text: string;
  internal?: boolean;
  /** Send note as email to ticket contact */
  emailContact?: boolean;
  /** Send note as email to CC contacts on ticket */
  emailCc?: boolean;
  /** Log time alongside this note (hours) */
  timeHours?: number;
}

export interface TimeEntryInput {
  ticketId: string;
  hoursWorked: number;
  notes?: string;
  workType?: string;
  memberId?: string;
  timeStart?: string;
  timeEnd?: string;
  billableOption?: "Billable" | "DoNotBill" | "NoCharge" | "NoDefault";
}

export interface BoardStatus {
  id: string;
  name: string;
  boardId: string;
  sortOrder?: number;
}

export interface IPsaConnector {
  // --- Tickets ---
  getTickets(
    filter?: TicketFilter,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedTicket>>;

  getTicketById(id: string): Promise<NormalizedTicket>;

  createTicket(input: CreateTicketInput): Promise<NormalizedTicket>;

  updateTicket(id: string, input: UpdateTicketInput): Promise<NormalizedTicket>;

  getTicketNotes(ticketId: string): Promise<TicketNote[]>;

  addTicketNote(
    ticketId: string,
    text: string,
    internal?: boolean,
    options?: { emailContact?: boolean; emailResources?: boolean; emailCc?: string; timeHours?: number }
  ): Promise<TicketNote>;

  getWorkTypes?(): Promise<Array<{ id: string; name: string }>>;

  // --- Companies ---
  getCompanies(
    filter?: CompanyFilter,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedOrganization>>;

  getCompanyById(id: string): Promise<NormalizedOrganization>;

  // --- Contacts ---
  getContacts(
    companyId?: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedContact>>;

  getContactById(id: string): Promise<NormalizedContact>;

  // --- Time Entries ---
  addTimeEntry(input: TimeEntryInput): Promise<{ id: string }>;

  // --- Boards & Statuses ---
  getBoards(): Promise<Array<{ id: string; name: string }>>;

  getBoardStatuses(boardId: string): Promise<BoardStatus[]>;

  // --- Members ---
  getMembers(): Promise<
    Array<{ id: string; identifier: string; name: string; email: string }>
  >;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
