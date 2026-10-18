export type UserSide = "client" | "employee" | "admin";

export type EmployeeRole =
  | "Coordinator"
  | "Discipline Lead"
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

export type ProjectStatus = "planned" | "ongoing" | "completed";

export type RequestType = "general" | "access_request" | "incident_report";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type FaqEntry = {
  id: number;
  question: string;
  answer: string;
  display_order: number;
  is_published: boolean;
  updated_at?: string;
};

export type Department = {
  id: string | number;
  name: string;
};

export type Project = {
  id: string | number;
  project_code?: string | null;
  name: string;
  location?: string | null;
  status: ProjectStatus;
  pm_user_id?: string | null;
  approver_ids?: string[];
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_side: UserSide;
  status: string | null;
  department_id?: string | null;
  discipline_id?: string | null;
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
  approval_status?: ApprovalStatus;
  approval_comment?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  requester_id?: string | null;
  assigned_to?: string | null;
  department_id?: string | number | null;
  project_id?: string | number | null;
  discipline_id?: string | number | null;
  category_id?: string | number | null;
  resolution_notes?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  requester?: ProfileSummary | null;
  assignee?: ProfileSummary | null;
  department?: { name: string } | null;
  project?: { name: string } | null;
};

export type ProfileSummary = Pick<Profile, "id" | "full_name" | "email">;

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

export type Discipline = {
  id: string | number;
  name: string;
  lead_user_id?: string | null;
};

export type Category = {
  id: string | number;
  name: string;
  discipline_id?: string | number | null;
};
