/**
 * ConnectWise Manage API response types.
 * Based on ConnectWise REST API v3.0 documentation.
 */

export interface CWSystemInfo {
  version: string;
  isCloud: boolean;
  serverTimeZone: string;
}

export interface CWTicket {
  id: number;
  summary: string;
  recordType?: string;
  board?: { id: number; name: string };
  status?: { id: number; name: string };
  priority?: { id: number; name: string; sort?: number };
  company?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  type?: { id: number; name: string };
  team?: { id: number; name: string };
  owner?: { id: number; identifier: string; name: string };
  siteName?: string;
  addressLine1?: string;
  city?: string;
  stateIdentifier?: string;
  zip?: string;
  contactEmailAddress?: string;
  contactPhoneNumber?: string;
  severity?: string;
  impact?: string;
  initialDescription?: string;
  resources?: string;
  requiredDate?: string;
  budgetHours?: number;
  actualHours?: number;
  dateEntered?: string;
  dateResolved?: string;
  closedDate?: string;
  closedBy?: string;
  _info?: { lastUpdated: string; updatedBy: string };
}

export interface CWTicketNote {
  id: number;
  ticketId: number;
  text: string;
  detailDescriptionFlag: boolean;
  internalAnalysisFlag: boolean;
  resolutionFlag: boolean;
  member?: { id: number; identifier: string; name: string };
  dateCreated?: string;
  _info?: Record<string, unknown>;
}

export interface CWCompany {
  id: number;
  identifier: string;
  name: string;
  status?: { id: number; name: string };
  type?: { id: number; name: string };
  phoneNumber?: string;
  faxNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: { id: number; name: string };
  territory?: { id: number; name: string };
  defaultContact?: { id: number; name: string };
  dateAcquired?: string;
  _info?: Record<string, unknown>;
}

export interface CWContact {
  id: number;
  firstName: string;
  lastName: string;
  company?: { id: number; identifier: string; name: string };
  title?: string;
  defaultPhoneType?: string;
  defaultPhoneNbr?: string;
  defaultBillFlag?: boolean;
  communicationItems?: Array<{
    id: number;
    type: { id: number; name: string };
    value: string;
    defaultFlag: boolean;
  }>;
  _info?: Record<string, unknown>;
}

export interface CWConfiguration {
  id: number;
  name: string;
  type?: { id: number; name: string };
  status?: { id: number; name: string };
  company?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  site?: { id: number; name: string };
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: { id: number; name: string };
  osType?: string;
  osInfo?: string;
  ipAddress?: string;
  macAddress?: string;
  lastLoginName?: string;
  deviceIdentifier?: string;
  _info?: { lastUpdated: string };
}

export interface CWTimeEntry {
  id: number;
  company?: { id: number; identifier: string; name: string };
  member?: { id: number; identifier: string; name: string };
  chargeToId?: number;
  chargeToType?: string;
  actualHours: number;
  notes?: string;
  workType?: { id: number; name: string };
  timeStart?: string;
  timeEnd?: string;
  dateEntered?: string;
  _info?: Record<string, unknown>;
}

export interface CWBoard {
  id: number;
  name: string;
  location?: { id: number; name: string };
  department?: { id: number; name: string };
  inactiveFlag?: boolean;
  _info?: Record<string, unknown>;
}

export interface CWBoardStatus {
  id: number;
  name: string;
  boardId: number;
  sortOrder: number;
  displayOnBoard: boolean;
  inactive: boolean;
  closedStatus: boolean;
  _info?: Record<string, unknown>;
}

export interface CWMember {
  id: number;
  identifier: string;
  firstName: string;
  lastName: string;
  emailAddress?: string;
  title?: string;
  officePhone?: string;
  inactiveFlag: boolean;
  _info?: Record<string, unknown>;
}

export interface CWScheduleEntry {
  id: number;
  objectId?: number;
  member?: { id: number; identifier: string; name: string };
  type?: { id: number; identifier: string };
  dateStart: string;
  dateEnd: string;
  hours?: number;
  status?: { id: number; name: string };
  _info?: Record<string, unknown>;
}
