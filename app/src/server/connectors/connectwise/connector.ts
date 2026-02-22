/**
 * ConnectWise PSA Connector — implements IPsaConnector.
 *
 * Full ticket lifecycle, company/contact management, time entries,
 * board/status lookups, and member listing via ConnectWise Manage REST API.
 */

import type { ConnectorConfig, PaginatedResponse } from "../_base/types";
import type { IPsaConnector, TicketFilter, CreateTicketInput, UpdateTicketInput, TicketNote, TimeEntryInput, BoardStatus } from "../_interfaces/psa";
import type { NormalizedTicket, NormalizedOrganization, NormalizedContact } from "../_interfaces/common";
import { ConnectWiseClient } from "./client";
import type { CWTicket, CWTicketNote, CWCompany, CWContact, CWBoard, CWBoardStatus, CWMember, CWTimeEntry } from "./types";
import { mapTicket, mapTicketNote, mapCompany, mapContact, mapBoardStatus } from "./mappers";

export class ConnectWisePsaConnector implements IPsaConnector {
  private client: ConnectWiseClient;

  constructor(config: ConnectorConfig) {
    this.client = new ConnectWiseClient(config);
  }

  // ─── Tickets ───────────────────────────────────────────────

  async getTickets(
    filter?: TicketFilter,
    page = 1,
    pageSize = 25
  ): Promise<PaginatedResponse<NormalizedTicket>> {
    const conditions = this.client.buildConditions({
      "company/id": filter?.companyId
        ? { value: filter.companyId }
        : undefined,
      "status/name": filter?.status
        ? { value: filter.status }
        : undefined,
      "priority/name": filter?.priority
        ? { value: filter.priority }
        : undefined,
      "board/id": filter?.boardId
        ? { value: filter.boardId }
        : undefined,
      "owner/identifier": filter?.assignedTo
        ? { value: filter.assignedTo }
        : undefined,
      summary: filter?.searchTerm
        ? { value: filter.searchTerm, op: "like" }
        : undefined,
    });

    const params: Record<string, string | number | boolean | undefined> = {
      page,
      pageSize: Math.min(pageSize, 1000),
      orderBy: "id desc",
      conditions,
    };

    if (filter?.createdAfter) {
      const afterCondition = `dateEntered>=[${filter.createdAfter.toISOString()}]`;
      params.conditions = params.conditions
        ? `${params.conditions} AND ${afterCondition}`
        : afterCondition;
    }

    if (filter?.createdBefore) {
      const beforeCondition = `dateEntered<=[${filter.createdBefore.toISOString()}]`;
      params.conditions = params.conditions
        ? `${params.conditions} AND ${beforeCondition}`
        : beforeCondition;
    }

    const tickets = await this.client["request"]<CWTicket[]>({
      path: "/service/tickets",
      params,
    });

    return {
      data: tickets.map(mapTicket),
      hasMore: tickets.length === pageSize,
      nextCursor: tickets.length === pageSize ? page + 1 : undefined,
      totalCount: undefined, // CW doesn't return total in list response
    };
  }

  async getTicketById(id: string): Promise<NormalizedTicket> {
    const ticket = await this.client["request"]<CWTicket>({
      path: `/service/tickets/${id}`,
    });
    return mapTicket(ticket);
  }

  async createTicket(input: CreateTicketInput): Promise<NormalizedTicket> {
    const body: Record<string, unknown> = {
      summary: input.summary,
      company: { id: parseInt(input.companyId, 10) },
    };

    if (input.description) body.initialDescription = input.description;
    if (input.contactId) body.contact = { id: parseInt(input.contactId, 10) };
    if (input.boardId) body.board = { id: parseInt(input.boardId, 10) };
    if (input.type) body.type = { name: input.type };
    if (input.assignTo) body.owner = { identifier: input.assignTo };

    if (input.priority) {
      const priorityMap: Record<string, string> = {
        critical: "Priority 1 - Critical",
        high: "Priority 2 - High",
        medium: "Priority 3 - Normal",
        low: "Priority 4 - Low",
        none: "Priority 4 - Low",
      };
      body.priority = { name: priorityMap[input.priority] ?? input.priority };
    }

    const ticket = await this.client["request"]<CWTicket>({
      method: "POST",
      path: "/service/tickets",
      body,
    });

    return mapTicket(ticket);
  }

  async updateTicket(
    id: string,
    input: UpdateTicketInput
  ): Promise<NormalizedTicket> {
    // Build PATCH operations
    const operations: Array<{ op: string; path: string; value: unknown }> = [];

    if (input.status) {
      operations.push({
        op: "replace",
        path: "status",
        value: { name: input.status },
      });
    }
    if (input.priority) {
      operations.push({
        op: "replace",
        path: "priority",
        value: { name: input.priority },
      });
    }
    if (input.assignTo) {
      operations.push({
        op: "replace",
        path: "owner",
        value: { identifier: input.assignTo },
      });
    }

    // If there's a note, add it separately
    if (input.note) {
      await this.addTicketNote(id, input.note, true);
    }

    if (operations.length > 0) {
      const ticket = await this.client["request"]<CWTicket>({
        method: "PATCH",
        path: `/service/tickets/${id}`,
        body: operations,
      });
      return mapTicket(ticket);
    }

    // If only a note was added, fetch and return the ticket
    return this.getTicketById(id);
  }

  async getTicketNotes(ticketId: string): Promise<TicketNote[]> {
    const notes = await this.client["request"]<CWTicketNote[]>({
      path: `/service/tickets/${ticketId}/notes`,
      params: { orderBy: "id desc", pageSize: 100 },
    });
    return notes.map(mapTicketNote);
  }

  async addTicketNote(
    ticketId: string,
    text: string,
    internal = true
  ): Promise<TicketNote> {
    const note = await this.client["request"]<CWTicketNote>({
      method: "POST",
      path: `/service/tickets/${ticketId}/notes`,
      body: {
        text,
        internalAnalysisFlag: internal,
        detailDescriptionFlag: !internal,
      },
    });
    return mapTicketNote(note);
  }

  // ─── Companies ─────────────────────────────────────────────

  async getCompanies(
    searchTerm?: string,
    page = 1,
    pageSize = 25
  ): Promise<PaginatedResponse<NormalizedOrganization>> {
    const conditions = searchTerm
      ? this.client.buildConditions({
          name: { value: searchTerm, op: "like" },
        })
      : undefined;

    const companies = await this.client["request"]<CWCompany[]>({
      path: "/company/companies",
      params: {
        page,
        pageSize: Math.min(pageSize, 1000),
        orderBy: "name asc",
        conditions,
      },
    });

    return {
      data: companies.map(mapCompany),
      hasMore: companies.length === pageSize,
      nextCursor: companies.length === pageSize ? page + 1 : undefined,
    };
  }

  async getCompanyById(id: string): Promise<NormalizedOrganization> {
    const company = await this.client["request"]<CWCompany>({
      path: `/company/companies/${id}`,
    });
    return mapCompany(company);
  }

  // ─── Contacts ──────────────────────────────────────────────

  async getContacts(
    companyId?: string,
    searchTerm?: string,
    page = 1,
    pageSize = 25
  ): Promise<PaginatedResponse<NormalizedContact>> {
    const filters: Record<string, { value: string; op?: string } | undefined> = {};
    if (companyId) filters["company/id"] = { value: companyId };
    if (searchTerm) filters["firstName"] = { value: searchTerm, op: "like" };

    const conditions = this.client.buildConditions(filters);

    const contacts = await this.client["request"]<CWContact[]>({
      path: "/company/contacts",
      params: {
        page,
        pageSize: Math.min(pageSize, 1000),
        orderBy: "firstName asc",
        conditions,
      },
    });

    return {
      data: contacts.map(mapContact),
      hasMore: contacts.length === pageSize,
      nextCursor: contacts.length === pageSize ? page + 1 : undefined,
    };
  }

  async getContactById(id: string): Promise<NormalizedContact> {
    const contact = await this.client["request"]<CWContact>({
      path: `/company/contacts/${id}`,
    });
    return mapContact(contact);
  }

  // ─── Time Entries ──────────────────────────────────────────

  async addTimeEntry(input: TimeEntryInput): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      chargeToId: parseInt(input.ticketId, 10),
      chargeToType: "ServiceTicket",
      actualHours: input.hoursWorked,
    };

    if (input.notes) body.notes = input.notes;
    if (input.workType) body.workType = { name: input.workType };
    if (input.memberId) body.member = { id: parseInt(input.memberId, 10) };

    const entry = await this.client["request"]<CWTimeEntry>({
      method: "POST",
      path: "/time/entries",
      body,
    });

    return { id: String(entry.id) };
  }

  // ─── Boards & Statuses ────────────────────────────────────

  async getBoards(): Promise<Array<{ id: string; name: string }>> {
    const boards = await this.client["request"]<CWBoard[]>({
      path: "/service/boards",
      params: {
        conditions: "inactiveFlag=false",
        pageSize: 100,
        orderBy: "name asc",
      },
    });

    return boards.map((b) => ({
      id: String(b.id),
      name: b.name,
    }));
  }

  async getBoardStatuses(boardId: string): Promise<BoardStatus[]> {
    const statuses = await this.client["request"]<CWBoardStatus[]>({
      path: `/service/boards/${boardId}/statuses`,
      params: {
        conditions: "inactive=false",
        pageSize: 100,
        orderBy: "sortOrder asc",
      },
    });

    return statuses.map(mapBoardStatus);
  }

  // ─── Members ───────────────────────────────────────────────

  async getMembers(): Promise<
    Array<{ id: string; name: string; email: string }>
  > {
    const members = await this.client["request"]<CWMember[]>({
      path: "/system/members",
      params: {
        conditions: "inactiveFlag=false",
        pageSize: 1000,
        orderBy: "firstName asc",
      },
    });

    return members.map((m) => ({
      id: String(m.id),
      name: `${m.firstName} ${m.lastName}`,
      email: m.emailAddress ?? "",
    }));
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck() {
    return this.client.healthCheck();
  }
}
