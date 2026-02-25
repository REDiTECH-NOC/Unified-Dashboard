/**
 * ConnectWise PSA Connector — implements IPsaConnector.
 *
 * Full ticket lifecycle, company/contact management, time entries,
 * board/status lookups, and member listing via ConnectWise Manage REST API.
 */

import type { ConnectorConfig, PaginatedResponse } from "../_base/types";
import type { IPsaConnector, TicketFilter, CompanyFilter, CreateTicketInput, UpdateTicketInput, TicketNote, TimeEntryInput, BoardStatus } from "../_interfaces/psa";
import type { NormalizedTicket, NormalizedOrganization, NormalizedContact } from "../_interfaces/common";
import { ConnectWiseClient } from "./client";
import type { CWTicket, CWTicketNote, CWCompany, CWContact, CWBoard, CWBoardStatus, CWMember, CWTimeEntry, CWSite, CWAgreement, CWConfiguration } from "./types";
import { mapTicket, mapTicketNote, mapCompany, mapContact, mapBoardStatus } from "./mappers";
import { getCwCache, setCwCache, invalidateCwTicketCaches } from "@/lib/cw-cache";

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
    const cacheParams = { filter, page, pageSize };
    const cached = await getCwCache<PaginatedResponse<NormalizedTicket>>("tickets", cacheParams);
    if (cached) return cached;

    const conditions = this.client.buildConditions({
      "company/id": filter?.companyId
        ? { value: parseInt(filter.companyId, 10) }
        : undefined,
      "status/name": filter?.status
        ? { value: filter.status }
        : undefined,
      "priority/name": filter?.priority
        ? { value: filter.priority }
        : undefined,
      "board/id": filter?.boardId
        ? { value: parseInt(filter.boardId, 10) }
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

    const result = {
      data: tickets.map(mapTicket),
      hasMore: tickets.length === pageSize,
      nextCursor: tickets.length === pageSize ? page + 1 : undefined,
      totalCount: undefined, // CW doesn't return total in list response
    };
    await setCwCache("tickets", cacheParams, result);
    return result;
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

    await invalidateCwTicketCaches();
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
    if (input.boardId) {
      operations.push({
        op: "replace",
        path: "board",
        value: { id: parseInt(input.boardId, 10) },
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
      await invalidateCwTicketCaches();
      return mapTicket(ticket);
    }

    // If only a note was added, fetch and return the ticket
    await invalidateCwTicketCaches();
    return this.getTicketById(id);
  }

  async getTicketNotes(ticketId: string): Promise<TicketNote[]> {
    const cached = await getCwCache<TicketNote[]>("ticket-notes", { ticketId });
    if (cached) return cached;

    const notes = await this.client["request"]<CWTicketNote[]>({
      path: `/service/tickets/${ticketId}/notes`,
      params: { orderBy: "id desc", pageSize: 100 },
    });
    const result = notes.map(mapTicketNote);
    await setCwCache("ticket-notes", { ticketId }, result);
    return result;
  }

  async addTicketNote(
    ticketId: string,
    text: string,
    internal = true,
    options?: { emailContact?: boolean; emailResources?: boolean; emailCc?: string; timeHours?: number }
  ): Promise<TicketNote> {
    const body: Record<string, unknown> = {
      text,
      internalAnalysisFlag: internal,
      detailDescriptionFlag: !internal,
    };
    if (options?.emailContact) {
      body.customerUpdatedFlag = true;
    }
    if (options?.emailResources || options?.emailContact) {
      body.processNotifications = true;
    }
    if (options?.emailCc) {
      body.emailCc = options.emailCc;
    }
    const note = await this.client["request"]<CWTicketNote>({
      method: "POST",
      path: `/service/tickets/${ticketId}/notes`,
      body,
    });

    // If time was included with the note, create a time entry too
    if (options?.timeHours && options.timeHours > 0) {
      await this.addTimeEntry({
        ticketId,
        hoursWorked: options.timeHours,
        notes: text.length > 100 ? text.substring(0, 100) + "..." : text,
      });
    }

    await invalidateCwTicketCaches();
    return mapTicketNote(note);
  }

  async getWorkTypes(): Promise<Array<{ id: string; name: string }>> {
    const cached = await getCwCache<Array<{ id: string; name: string }>>("workTypes", undefined);
    if (cached) return cached;

    const types = await this.client["request"]<Array<{ id: number; name: string }>>({
      path: "/time/workTypes",
      params: { pageSize: 100, conditions: "inactiveFlag=false" },
    });

    const mapped = types.map((t) => ({ id: String(t.id), name: t.name }));
    await setCwCache("workTypes", undefined, mapped);
    return mapped;
  }

  // ─── Companies ─────────────────────────────────────────────

  async getCompanies(
    filter?: CompanyFilter,
    page = 1,
    pageSize = 25
  ): Promise<PaginatedResponse<NormalizedOrganization>> {
    const conditionParts: string[] = [];

    if (filter?.searchTerm) {
      conditionParts.push(`name like "%${filter.searchTerm}%"`);
    }

    if (filter?.statuses?.length) {
      const quoted = filter.statuses.map((s) => `"${s}"`).join(",");
      conditionParts.push(`status/name in (${quoted})`);
    }

    // Types is an array field in CW — requires childConditions, not conditions
    // CW childConditions does NOT support in() — use or-joined equals instead
    let childConditions: string | undefined;
    if (filter?.types?.length) {
      childConditions = filter.types
        .map((t) => `types/name="${t}"`)
        .join(" or ");
    }

    const conditions =
      conditionParts.length > 0 ? conditionParts.join(" AND ") : undefined;

    const companies = await this.client["request"]<CWCompany[]>({
      path: "/company/companies",
      params: {
        page,
        pageSize: Math.min(pageSize, 1000),
        orderBy: "name asc",
        conditions,
        childConditions,
      },
    });

    return {
      data: companies.map(mapCompany),
      hasMore: companies.length === pageSize,
      nextCursor: companies.length === pageSize ? page + 1 : undefined,
    };
  }

  // ─── Company Metadata (CW-specific) ─────────────────────

  async getCompanyStatuses(): Promise<Array<{ id: number; name: string }>> {
    return this.client["request"]<Array<{ id: number; name: string }>>({
      path: "/company/companies/statuses",
      params: { pageSize: 100 },
    });
  }

  async getCompanyTypes(): Promise<Array<{ id: number; name: string }>> {
    return this.client["request"]<Array<{ id: number; name: string }>>({
      path: "/company/companies/types",
      params: { pageSize: 100 },
    });
  }

  async getCompanyById(id: string): Promise<NormalizedOrganization> {
    const company = await this.client["request"]<CWCompany>({
      path: `/company/companies/${id}`,
    });
    return mapCompany(company);
  }

  // ─── Company Sub-Entities ──────────────────────────────────

  async getCompanySites(companyId: string): Promise<CWSite[]> {
    return this.client["request"]<CWSite[]>({
      path: `/company/companies/${companyId}/sites`,
      params: { pageSize: 1000 },
    });
  }

  async getCompanyConfigurations(
    companyId: string,
    page = 1,
    pageSize = 100
  ): Promise<{ data: CWConfiguration[]; hasMore: boolean }> {
    const configs = await this.client["request"]<CWConfiguration[]>({
      path: "/company/configurations",
      params: {
        conditions: `company/id=${companyId}`,
        page,
        pageSize,
        orderBy: "name asc",
      },
    });
    return { data: configs, hasMore: configs.length === pageSize };
  }

  async getCompanyAgreements(
    companyId: string,
    page = 1,
    pageSize = 100
  ): Promise<{ data: CWAgreement[]; hasMore: boolean }> {
    const agreements = await this.client["request"]<CWAgreement[]>({
      path: "/finance/agreements",
      params: {
        conditions: `company/id=${companyId}`,
        page,
        pageSize,
        orderBy: "name asc",
      },
    });
    return { data: agreements, hasMore: agreements.length === pageSize };
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
    if (input.timeStart) body.timeStart = input.timeStart;
    if (input.timeEnd) body.timeEnd = input.timeEnd;
    if (input.billableOption) body.billableOption = input.billableOption;

    const entry = await this.client["request"]<CWTimeEntry>({
      method: "POST",
      path: "/time/entries",
      body,
    });

    await invalidateCwTicketCaches();
    return { id: String(entry.id) };
  }

  async getTimeEntries(ticketId: string): Promise<Array<{
    id: string;
    member?: string;
    actualHours: number;
    notes?: string;
    workType?: string;
    timeStart?: string;
    timeEnd?: string;
    dateEntered?: string;
  }>> {
    const entries = await this.client["request"]<CWTimeEntry[]>({
      path: "/time/entries",
      params: {
        conditions: `chargeToId=${parseInt(ticketId, 10)} AND chargeToType="ServiceTicket"`,
        pageSize: 100,
        orderBy: "dateEntered desc",
      },
    });

    return entries.map((e) => ({
      id: String(e.id),
      member: e.member?.name ?? e.member?.identifier,
      actualHours: e.actualHours,
      notes: e.notes,
      workType: e.workType?.name,
      timeStart: e.timeStart,
      timeEnd: e.timeEnd,
      dateEntered: e.dateEntered,
    }));
  }

  async getMemberTimeEntries(memberIdentifier: string, dateStart: Date, dateEnd: Date): Promise<Array<{
    id: string;
    ticketId?: string;
    companyName?: string;
    member?: string;
    actualHours: number;
    notes?: string;
    timeStart?: string;
    timeEnd?: string;
    dateEntered?: string;
  }>> {
    const startIso = dateStart.toISOString().split("T")[0];
    const endIso = dateEnd.toISOString().split("T")[0];
    const entries = await this.client["request"]<CWTimeEntry[]>({
      path: "/time/entries",
      params: {
        conditions: `member/identifier="${memberIdentifier}" AND dateEntered>=[${startIso}] AND dateEntered<=[${endIso}]`,
        pageSize: 200,
        orderBy: "dateEntered asc",
      },
    });

    return entries.map((e) => ({
      id: String(e.id),
      ticketId: e.chargeToId ? String(e.chargeToId) : undefined,
      companyName: e.company?.name,
      member: e.member?.name ?? e.member?.identifier,
      actualHours: e.actualHours,
      notes: e.notes,
      timeStart: e.timeStart,
      timeEnd: e.timeEnd,
      dateEntered: e.dateEntered,
    }));
  }

  // ─── Boards & Statuses ────────────────────────────────────

  async getBoards(): Promise<Array<{ id: string; name: string }>> {
    const cached = await getCwCache<Array<{ id: string; name: string }>>("boards");
    if (cached) return cached;

    const boards = await this.client["request"]<CWBoard[]>({
      path: "/service/boards",
      params: {
        conditions: "inactiveFlag=false",
        pageSize: 100,
        orderBy: "name asc",
      },
    });

    const result = boards.map((b) => ({
      id: String(b.id),
      name: b.name,
    }));
    await setCwCache("boards", undefined, result);
    return result;
  }

  async getBoardStatuses(boardId: string): Promise<BoardStatus[]> {
    const cached = await getCwCache<BoardStatus[]>("board-statuses", { boardId });
    if (cached) return cached;

    const statuses = await this.client["request"]<CWBoardStatus[]>({
      path: `/service/boards/${boardId}/statuses`,
      params: {
        conditions: "inactive=false",
        pageSize: 100,
        orderBy: "sortOrder asc",
      },
    });

    const result = statuses.map(mapBoardStatus);
    await setCwCache("board-statuses", { boardId }, result);
    return result;
  }

  // ─── Members ───────────────────────────────────────────────

  async getMembers(): Promise<
    Array<{ id: string; identifier: string; name: string; email: string }>
  > {
    const cached = await getCwCache<Array<{ id: string; identifier: string; name: string; email: string }>>("members");
    if (cached) return cached;

    const members = await this.client["request"]<CWMember[]>({
      path: "/system/members",
      params: {
        conditions: 'inactiveFlag=false AND licenseClass!="A"',
        pageSize: 1000,
        orderBy: "firstName asc",
      },
    });

    const result = members.map((m) => ({
      id: String(m.id),
      identifier: m.identifier,
      name: `${m.firstName} ${m.lastName}`,
      email: m.emailAddress ?? "",
    }));
    await setCwCache("members", undefined, result);
    return result;
  }

  // ─── Schedule Entries ─────────────────────────────────────

  async getScheduleEntries(params: {
    memberIdentifier?: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<Array<{
    id: string;
    objectId?: string;
    memberName?: string;
    type?: string;
    dateStart: Date;
    dateEnd: Date;
    hours?: number;
    status?: string;
  }>> {
    const conditions: string[] = [];
    if (params.memberIdentifier) {
      conditions.push(`member/identifier="${params.memberIdentifier}"`);
    }
    conditions.push(`dateStart>=[${params.dateStart.toISOString()}]`);
    conditions.push(`dateEnd<=[${params.dateEnd.toISOString()}]`);

    const entries = await this.client["request"]<Array<{
      id: number;
      objectId?: number;
      member?: { id: number; identifier: string; name: string };
      type?: { id: number; identifier: string };
      dateStart: string;
      dateEnd: string;
      hours?: number;
      status?: { id: number; name: string };
    }>>({
      path: "/schedule/entries",
      params: {
        conditions: conditions.join(" AND "),
        pageSize: 200,
        orderBy: "dateStart asc",
      },
    });

    return entries.map((e) => ({
      id: String(e.id),
      objectId: e.objectId ? String(e.objectId) : undefined,
      memberName: e.member?.name,
      type: e.type?.identifier,
      dateStart: new Date(e.dateStart),
      dateEnd: new Date(e.dateEnd),
      hours: e.hours,
      status: e.status?.name,
    }));
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck() {
    return this.client.healthCheck();
  }
}
