// Core entity types - generic and extensible

/**
 * Base entity interface - all data entities extend this
 */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  slug: string; // URL-friendly identifier
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  /** Sources for the facts on this entity. Published entities need at least one. */
  sources?: SourceCitation[];
  lastVerified?: string;
}

export type EntityType = 'region' | 'person' | 'infrastructure' | 'organization' | 'project';

/**
 * Region entity - countries, states, cities, districts, etc.
 */
export interface Region extends Entity {
  type: 'region';
  level: RegionLevel;
  parentId?: string; // Reference to parent region
  code?: string; // ISO 3166-2:IN subdivision code (without the "IN-" prefix)
  /** State/district code used in Census 2011 tables. */
  census2011Code?: string;
  /** Approximate centre for placing the region on the map; not a surveyed point. */
  coordinates?: [number, number]; // [lat, lng]
  population?: number;
  /** Which census or estimate `population` comes from, e.g. "Census 2011". */
  populationAsOf?: string;
  area?: number; // in sq km
  capital?: string;
  children?: string[]; // Child region IDs
}

export type RegionLevel = 'country' | 'state' | 'union_territory' | 'district' | 'city' | 'town' | 'constituency';

/**
 * Person entity - MPs, MLAs, ministers, billionaires, etc.
 */
export interface Person extends Entity {
  type: 'person';
  role: PersonRole;
  roles?: PersonRole[]; // Person can have multiple roles
  party?: string;
  constituency?: string;
  regionId?: string; // Primary region association
  regionIds?: string[]; // All associated regions
  imageUrl?: string;
  birthDate?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  socialMedia?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  tenure?: {
    start: string;
    end?: string;
  };
}

export type PersonRole =
  | 'mp'
  | 'mla'
  | 'minister'
  | 'cm'
  | 'pm'
  | 'governor'
  | 'mayor'
  | 'councillor'
  | 'billionaire'
  | 'entrepreneur'
  | 'other';

/**
 * Infrastructure entity - roads, rail, ports, airports, etc.
 */
export interface Infrastructure extends Entity {
  type: 'infrastructure';
  category: InfraCategory;
  subCategory?: string;
  regionId?: string;
  regionIds?: string[]; // Can span multiple regions
  status?: 'planned' | 'under_construction' | 'operational' | 'decommissioned';
  cost?: {
    value: number;
    currency: string;
  };
  length?: number; // in km for roads/rail
  capacity?: number;
  operator?: string;
  startDate?: string;
  completionDate?: string;
}

export type InfraCategory =
  | 'roads'
  | 'highways'
  | 'toll_roads'
  | 'rail'
  | 'metro'
  | 'ports'
  | 'airports'
  | 'bridges'
  | 'tunnels'
  | 'power'
  | 'water'
  | 'telecom'
  | 'other';

/**
 * Metric - a single data point with optional trend
 */
export interface Metric {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  currency?: string;
  year?: number | string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number; // percentage change
  source?: string;
  sourceUrl?: string;
}

/**
 * Country configuration - defines what's available for a country
 */
export interface CountryConfig {
  code: string; // 'in' for India
  name: string;
  currency: string;
  currencySymbol: string;
  coordinates: [number, number];
  regionLevels: RegionLevel[];
  entityTypes: EntityType[];
  personRoles: PersonRole[];
  infraCategories: InfraCategory[];
  features?: {
    hasMap?: boolean;
    hasSearch?: boolean;
    hasSpending?: boolean;
  };
}

/**
 * Overview data for a country/region
 */
export interface Overview {
  entityId: string;
  entityType: EntityType;
  name: string;
  metrics: Metric[];
  highlights?: {
    title: string;
    description: string;
    link?: string;
  }[];
  quickLinks?: {
    label: string;
    href: string;
    icon?: string;
  }[];
}

/**
 * Search result item
 */
export interface SearchResult {
  id: string;
  type: EntityType;
  name: string;
  slug: string;
  description?: string;
  path: string; // URL path to this entity
  score?: number; // Search relevance score
  highlights?: string[]; // Matched text snippets
}

/**
 * Spending/Budget data
 */
export interface SpendingData {
  entityId: string;
  fiscalYear: string;
  totalBudget: Metric;
  allocations: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  revenue?: Metric;
  expenditure?: Metric;
  deficit?: Metric;
}

/**
 * Generic filter options
 */
export interface Filters {
  type?: EntityType;
  role?: PersonRole;
  category?: InfraCategory;
  regionId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================
// Information Request Types (RTI/FOI/FOIA)
// ============================================

/**
 * A filed information request (RTI in India, FOI in UK, FOIA in USA)
 */
export interface InfoRequest {
  id: string;
  title: string;
  description: string;
  department: string;
  departmentEmail?: string;
  status: InfoRequestStatus;
  filedBy: 'platform' | 'community' | string;
  filedDate: string;
  responseDate?: string;
  cost?: {
    value: number;
    currency: string;
  };
  response?: string;
  responseUrl?: string;
  category?: string;
  tags?: string[];
  regionIds?: string[]; // Associated regions (e.g., ["maharashtra", "mumbai"])
  personIds?: string[]; // Associated persons (e.g., ["devendra-fadnavis"])
}

export type InfoRequestStatus =
  | 'draft'
  | 'filed'
  | 'pending'
  | 'responded'
  | 'appealed'
  | 'rejected'
  | 'closed';

/**
 * Planned information request targets
 */
export interface InfoRequestTarget {
  id: string;
  title: string;
  description: string;
  department: string;
  estimatedCost?: {
    value: number;
    currency: string;
  };
  priority: 'high' | 'medium' | 'low';
  category?: string;
}

/**
 * Cost tracking statistics for information requests
 */
export interface InfoRequestStats {
  totalSpent: {
    value: number;
    currency: string;
  };
  totalNeeded: {
    value: number;
    currency: string;
  };
  totalContributed: {
    value: number;
    currency: string;
  };
  totalFiled: number;
  totalResponded: number;
  totalPending: number;
}

/**
 * Country-specific configuration for information requests
 */
export interface InfoRequestConfig {
  enabled: boolean;
  displayName: string;        // "RTI" for India, "FOI" for UK
  fullName: string;           // "Right to Information" for India
  ccEmail: string;            // e.g., "indatarequests@forthis.world"
  templates: InfoRequestTemplate[];
  departments: InfoRequestDepartment[];
}

export interface InfoRequestTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category?: string;
}

export interface InfoRequestDepartment {
  id: string;
  name: string;
  /** How a request reaches this authority. Only add an email the authority itself publishes for RTI. */
  filingMethod: 'online_portal' | 'post' | 'email';
  filingUrl?: string;
  email?: string;
  category?: string;
  note?: string;
}

// ============================================
// Toll Road Types
// ============================================

/**
 * A source a fact rests on. `url` is always the original publisher's link;
 * `archiveUrl` is our own copy (R2), for when the original moves or disappears.
 */
export interface SourceCitation {
  id: string;
  title: string;
  publisher: string;
  /** The original source. Always shown first. */
  url?: string;
  date?: string;
  note?: string;
  type:
    | 'gazette'
    | 'concession_agreement'
    | 'court_order'
    | 'audit_report'
    | 'legislative_record'
    | 'statistics'
    | 'rti_response'
    | 'annual_report'
    | 'company_filing'
    | 'government_portal'
    | 'news';
  /** Our archived copy of the document (R2). */
  archiveUrl?: string;
  /** SHA-256 of the archived file, so anyone can check it matches. */
  sha256?: string;
  /** When we fetched / last checked the source (YYYY-MM-DD). */
  retrievedAt?: string;
  /** Where in the document the fact is, e.g. "para 59" or "p. 12". */
  locator?: string;
}

/**
 * How firmly a number is established. Only the first four count as
 * established facts; `claim` and `reported` are shown with attribution and
 * are never used in derived calculations.
 */
export type FactBasis =
  | 'court_finding'   // stated as a finding by a court
  | 'audit_finding'   // CAG or another statutory auditor
  | 'official_record' // government record, gazette, census, legislature
  | 'company_filing'  // the company's own audited/legal disclosure
  | 'reported'        // reported by the press, not yet confirmed by a primary source
  | 'claim';          // asserted by a named party (politician, company, litigant)

/**
 * Monetary value with optional as-of date and caveat note
 */
export interface MoneyValue {
  value: number;
  currency: string;
  asOf?: string;
  note?: string;
  /** Id of the SourceCitation this value comes from. */
  sourceId?: string;
  basis?: FactBasis;
  /** For basis 'claim': who made the claim. */
  claimedBy?: string;
}

/**
 * A statement in our own analysis. Every statement cites the sources it rests on.
 */
export interface AnalysisPoint {
  text: string;
  sourceIds: string[];
}

/**
 * A figure asserted by a named party that we have not been able to confirm
 * from a primary source. Shown with attribution; never used in calculations.
 */
export interface Claim {
  text: string;
  claimedBy: string;
  date?: string;
  amount?: MoneyValue;
  sourceId: string;
}

/**
 * Money collected over a period (tolls, or total income), e.g. from an audit.
 */
export interface CollectionTotal {
  label: string;
  from?: string;
  to?: string;
  amount: MoneyValue;
}

/**
 * PPP/concession structure for a toll road
 */
export interface ConcessionInfo {
  model: 'BOT' | 'DBFOT' | 'HAM' | 'EPC' | 'Annuity' | 'Other';
  modelName?: string; // e.g. "Build-Own-Operate-Transfer"
  signingDate?: string;
  operator: string;
  operatorType?: 'private' | 'psu' | 'joint_venture';
  grantingAuthority: string;
  termYears?: number;
  /** Contractual condition for ending tolls, e.g. "until project cost + agreed return is recovered" */
  tollEndCondition?: string;
  scheduledEndDate?: string;
  extensions?: {
    date?: string;
    description: string;
    sourceId?: string;
  }[];
}

export type FundingSourceType =
  | 'equity'
  | 'debt'
  | 'government_grant'
  | 'vgf'
  | 'annuity'
  | 'land_contribution'
  | 'other';

/**
 * One component of the project funding structure
 */
export interface FundingComponent {
  source: FundingSourceType;
  label: string;
  amount: MoneyValue;
  note?: string;
}

/**
 * Annual revenue/traffic record for a toll road
 */
export interface TollRevenueYear {
  year: number | string;
  revenue?: MoneyValue;
  trafficVehiclesPerDay?: number;
  /** Source of the traffic figure. */
  trafficSourceId?: string;
  note?: string;
}

/**
 * Current toll rate for a vehicle class
 */
export interface TollRate {
  vehicleClass: string;
  section?: string;
  amount: MoneyValue;
  trip?: 'single' | 'return' | 'monthly_pass';
}

/**
 * A physical toll plaza on the road
 */
export interface TollPlaza {
  name: string;
  location?: string;
  coordinates?: [number, number];
  nhaiTisId?: string; // For NHAI roads, links to TIS plaza page
}

/**
 * Event in the road's history (signing, opening, disputes, extensions)
 */
export interface TollTimelineEvent {
  date: string;
  title: string;
  description?: string;
  significance?: 'positive' | 'negative' | 'neutral';
  sourceId?: string;
}

/**
 * The "why is this still tolled" analysis
 */
export interface RecoveryAnalysis {
  status: 'cost_recovered' | 'recovering' | 'disputed' | 'unknown';
  summary: string;
  /** Sources the summary rests on. */
  summarySourceIds?: string[];
  /** Why the road is still tolled - or, once tolls end, why they ended. */
  reasonsStillTolled: AnalysisPoint[];
  /** Unknowns; each becomes an RTI target. */
  openQuestions: string[];
  estimatedCostRecoveredPct?: number;
}

/**
 * A toll road with full concession, funding, and revenue transparency data
 */
export interface TollRoad {
  id: string;
  slug: string;
  name: string;
  officialName?: string;
  /** Operating company - used for MCA/company filing lookups */
  operatorCompany?: string;
  cin?: string; // Corporate Identity Number (MCA lookup key)
  regionIds: string[];
  lengthKm?: number;
  openedDate?: string;
  status?: 'operational' | 'under_construction' | 'planned' | 'closed';
  /** Whether users pay today, and since when. */
  tolling?: {
    status: 'tolled' | 'toll_free';
    since?: string;
    sourceId?: string;
  };
  concession?: ConcessionInfo;
  projectCost?: MoneyValue;
  funding?: FundingComponent[];
  annualRevenue?: TollRevenueYear[];
  /** Totals collected over a period, e.g. from an audit. */
  collections?: CollectionTotal[];
  currentRates?: TollRate[];
  plazas?: TollPlaza[];
  timeline?: TollTimelineEvent[];
  analysis?: RecoveryAnalysis;
  /** Figures asserted by named parties that no primary source confirms yet. */
  claims?: Claim[];
  sources: SourceCitation[];
  lastVerified?: string;
}

// ============================================
// Legislatures: who holds each seat
// ============================================

/** One seat in a legislature and who holds it, as published by the house's secretariat. */
export interface LegislatureSeat {
  /** "<stateSlug>:<boundary key>" for seats drawn on the map (public/geo/in/pc.geojson), else "<stateSlug>:<name>" */
  id: string;
  state: string;
  name: string;
  /** The seat's number in the delimitation order (assembly seats). */
  number?: number;
  /** Whether the map has a current boundary for this seat. */
  drawn: boolean;
  status: 'sitting' | 'vacant';
  member?: {
    name: string;
    party: string;
    partyShort?: string;
    /** Which Lok Sabhas (by number) this member has sat in. */
    lokSabhaTerms?: number[];
    /** For a by-election winner: when they took the seat (YYYY-MM-DD). */
    since?: string;
    /** As the house lists it, e.g. "Un-attached member". */
    note?: string;
  };
  vacatedBy?: { name: string; reason: string; date?: string };
  /** Assembly seats: the Lok Sabha seat it lies in (a pc.geojson key). */
  lokSabhaSeat?: string;
  sourceId: string;
}

/** A sentence of the record and the sources it rests on. */
export interface CitedText {
  text: string;
  sourceIds: string[];
}

/**
 * A city (or other local body): who governs it, whether it has an elected council, and which
 * services other bodies run (data/<country>/local-bodies). Tied to the map through assembly seats
 * until ward boundaries are drawn.
 */
export interface LocalBody {
  id: string;
  slug: string;
  name: string;
  state: string;
  /** The date the facts were last read. */
  asOf: string;
  /** The governing body, in full and in two words. */
  body: string;
  bodyShort: string;
  council: { status: 'elected' | 'none'; label: string; runBy?: string; /** YYYY-MM-DD */ lastElection?: string };
  /** What the body is responsible for, in one line. */
  does: CitedText;
  facts: (CitedText & { label: string })[];
  /** Services in the city that other bodies run. */
  services: { service: string; body: string; bodyName: string; sourceId: string }[];
  /** Assembly seats (LegislatureSeat ids) with part of the city in them. */
  seats: { ids: string[]; note?: string; sourceId: string };
  openQuestions: string[];
  sources: SourceCitation[];
}

export interface Legislature {
  id: string;
  house: string;
  /** State legislatures: the state's slug. */
  state?: string;
  term: number;
  /** The date the member list was read. */
  asOf: string;
  sources: SourceCitation[];
  seats: LegislatureSeat[];
  lastVerified?: string;
}

// ============================================
// MPLADS: MP Local Area Development Scheme
// ============================================

export interface CountAmount { count: number; amount: number }

/** One Lok Sabha seat's MPLADS position for a term, as the eSAKSHI portal reports it (INR). */
export interface MpladsSeat {
  /** A LegislatureSeat id (Lok Sabha). */
  seat: string;
  /** MPs as the portal names them (a seat can have had more than one this term). */
  mps: string[];
  allocated: number;
  recommended: CountAmount;
  sanctioned: CountAmount;
  completed: CountAmount;
  /** Payments released to vendors for completed and ongoing works. */
  paid: number;
  sourceId: string;
}

export interface MpladsRecord {
  id: string;
  scheme: 'MPLADS';
  house: string;
  term: number;
  asOf: string;
  currency: string;
  sources: SourceCitation[];
  totals: Omit<MpladsSeat, 'seat' | 'mps' | 'sourceId'>;
  seats: MpladsSeat[];
  lastVerified?: string;
}
