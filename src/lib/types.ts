export type UserSide = "client" | "employee" | "admin";

export type ServiceTeam = {
  id: number;
  name: string;
  slug: string;
  is_in_scope: boolean;
  is_active: boolean;
};

export type EmployeeRole =
  | "Coordinator"
  | "Personnel"
  | "Manager";

export type TicketStatus =
  | "open"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "waiting_for_info"
  | "resolved"
  | "closed"
  | "rejected";

export type Priority = "low" | "medium" | "high" | "urgent";

export type RequestType = "general" | "access_request" | "incident_report";

export type FaqEntry = {
  id: number;
  service_team_id?: number | null;
  question: string;
  answer: string;
  display_order: number;
  is_published: boolean;
  updated_at?: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_side: UserSide;
  status: string | null;
  service_team_id?: number | null;
  service_team?: Pick<ServiceTeam, "id" | "name" | "slug"> | null;
};

export type ManagedProfile = Profile & {
  invitation_pending: boolean;
  employee_roles: EmployeeRole[];
};

export type Notification = {
  id: number;
  user_id: string;
  ticket_id: number | null;
  type: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationPreference = {
  notification_type: "ticket_submitted" | "ticket_assigned" | "ticket_updated";
  enabled: boolean;
};

export type UserRole = {
  user_id: string;
  role_id: number;
  role_name?: EmployeeRole;
};

export type Ticket = {
  id: string | number;
  ticket_no?: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus | string;
  priority: Priority | string;
  is_confidential?: boolean;
  request_type?: RequestType;
  requester_id?: string | null;
  assigned_to?: string | null;
  service_team_id?: number | null;
  resolution_notes?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  first_response_at?: string | null;
  updated_at?: string | null;
  requester?: ProfileSummary | null;
  assignee?: ProfileSummary | null;
};

export type TicketSlaPolicy = {
  priority: Priority;
  first_response_hours: number;
  resolution_hours: number;
  updated_at?: string;
};

export type TicketFeedback = {
  id: string | number;
  ticket_id: string | number;
  requester_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type SimilarTicket = Pick<Ticket, "id" | "ticket_no" | "title" | "status"> & {
  relevance: number;
};

export type RelatedTicket = Pick<Ticket, "id" | "ticket_no" | "title" | "status" | "priority">;

export type ProfileSummary = Pick<Profile, "id" | "full_name" | "email"> & {
  user_side?: UserSide;
};

export type Comment = {
  id: string | number;
  ticket_id: string | number;
  author_id: string;
  body: string;
  is_internal?: boolean | null;
  created_at?: string | null;
};

export type TicketEvent = {
  id: string | number;
  ticket_id: string | number;
  actor_id?: string | null;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export type TicketActivity =
  | {
      kind: "comment";
      id: string | number;
      created_at?: string | null;
      actor: ProfileSummary | null;
      body: string;
      is_internal?: boolean | null;
    }
  | {
      kind: "event";
      id: string | number;
      created_at?: string | null;
      actor: ProfileSummary | null;
      event_type: string;
      from_status?: string | null;
      to_status?: string | null;
      note?: string | null;
    };

export type TicketAttachment = {
  id: string | number;
  ticket_id: string | number;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  created_at?: string | null;
  signed_url?: string | null;
};
