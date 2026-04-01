export type CommandId =
  | 'login'
  | 'update'
  | 'logout'
  | 'whoami'
  | 'buddy'
  | 'gundem'
  | 'bugun'
  | 'yarin'
  | 'hafta'
  | 'odev'
  | 'sinav'
  | 'dersler'
  | 'duyurular'
  | 'yemekhane'
  | 'teacher-dashboard'
  | 'watch'
  | 'help';

export type CliSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
};

export type CliUser = {
  id: string;
  email?: string | null;
};

export type CliDeviceSession = {
  deviceId: string;
  deviceToken: string;
  expiresAt: string;
  issuedAt: string;
};

export type CliLoginRequest = {
  requestId: string;
  userCode: string;
  pollToken: string;
  entryUrl?: string;
  verificationUrl: string;
  expiresAt: string;
  intervalMs: number;
};

export type CliLoginStatus =
  | 'pending'
  | 'approved'
  | 'redeemed'
  | 'expired'
  | 'cancelled';

export type CliLoginRedeemPayload = {
  status: CliLoginStatus;
  expiresAt: string;
  approvedAt?: string | null;
  session?: CliSession;
  user?: CliUser;
  error?: string;
};

export type CliLoginRequestSummary = {
  requestId: string;
  userCode: string;
  status: CliLoginStatus;
  expiresAt: string;
  approvedAt?: string | null;
  redeemedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
};

export type StoredSession = {
  session: CliSession;
  user: CliUser;
  device?: CliDeviceSession | null;
  updatedAt: string;
};

export type StoredPreferences = {
  onboardingSeen: boolean;
  lastView?: CommandId | null;
};

export type MemoryState = {
  lastDreamAt: string | null;
  sessionsSinceDream: number;
};

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  studentNumber: string | null;
  avatarUrl?: string | null;
  role: string;
};

export type BuddyMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type BuddyReplyPayload = {
  response: string;
  timestamp: string;
};

export type AgendaItem = {
  id: string;
  type: 'class' | 'assignment' | 'exam' | 'period';
  emoji: string;
  title: string;
  detail: string;
  badge: string;
  date: string;
  dayKey: string;
  section?: 'simdi' | 'bugun' | 'yarin' | 'hafta';
  meta?: Record<string, unknown>;
};

export type AgendaSection = {
  id: string;
  title: string;
  emptyText: string;
  items: AgendaItem[];
};

export type AgendaPayload = {
  now: string;
  timezone: string;
  view: string;
  title: string;
  summary: {
    total: number;
    classes: number;
    assignments: number;
    exams: number;
    periods: number;
    label: string;
  };
  sections: AgendaSection[];
  items: AgendaItem[];
};

export type AnnouncementsPayload = {
  now: string;
  count: number;
  cached: boolean;
  stale: boolean;
  lastScraped: string | null;
  items: Array<{
    id: string;
    title: string;
    url: string;
    date: string;
  }>;
};

export type CafeteriaPayload = {
  now: string;
  timezone: string;
  day: 'today' | 'tomorrow';
  available: boolean;
  targetDate: string;
  menu: {
    date: string;
    items: string[];
  } | null;
  source: {
    id: string | null;
    title: string | null;
    fetchedAt: string | null;
    sourceUrl: string | null;
  } | null;
};

export type HomePayload = {
  now: string;
  timezone: string;
  syncedAt: string;
  profile: Profile;
  cards: {
    gundem: AgendaPayload;
    bugun: AgendaPayload;
    odev: AgendaPayload;
    sinav: AgendaPayload;
    duyurular: AnnouncementsPayload;
    yemekhane: CafeteriaPayload;
  };
  freshness: {
    hardRefresh: boolean;
    announcements: {
      cached: boolean;
      stale: boolean;
      lastScraped: string | null;
    };
    cafeteria: {
      fetchedAt: string | null;
      sourceUrl: string | null;
    };
  };
};

export type TeacherDashboardPayload = {
  title: string;
  counts: {
    suspiciousRecords: number;
    securityLogs: number;
  };
  sections: Array<{
    id: string;
    title: string;
    emptyText: string;
    items: Array<{
      id: string;
      title: string;
      detail: string;
      badge: string;
      meta?: Record<string, unknown>;
    }>;
  }>;
};

export type ParsedCommand = {
  id: CommandId;
  json: boolean;
  args: Record<string, string | boolean>;
  rawTokens: string[];
};

export type CommandDefinition = {
  id: CommandId;
  path: string[];
  aliases?: string[];
  description: string;
  example?: string;
  requiresAuth?: boolean;
};

export type CommandResult =
  | { kind: 'profile'; data: Profile }
  | { kind: 'buddy'; data: BuddyReplyPayload }
  | { kind: 'agenda'; data: AgendaPayload }
  | { kind: 'announcements'; data: AnnouncementsPayload }
  | { kind: 'cafeteria'; data: CafeteriaPayload }
  | { kind: 'teacher-dashboard'; data: TeacherDashboardPayload }
  | { kind: 'watch'; data: string }
  | { kind: 'text'; data: string }
  | { kind: 'json'; data: unknown };
