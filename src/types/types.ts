export enum MemberStatus {
  Registered = "registered",
  Contacted = "contacted",
  FirstTalkGiven = "first_talk_given",
  NeverActive = "never_active",
  Active = "active",
  SociallyActive = "socially_active",
  WasActive = "was_active",
  WasSociallyActive = "was_socially_active",
  Terminated = "terminated",
  Duplicate = "duplicate",
}

// Display labels for the UI
export const MemberStatusLabels: Record<MemberStatus, string> = {
  [MemberStatus.Registered]: "Registered",
  [MemberStatus.Contacted]: "Contacted",
  [MemberStatus.FirstTalkGiven]: "First Talk Given",
  [MemberStatus.NeverActive]: "Never Active",
  [MemberStatus.Active]: "Active",
  [MemberStatus.SociallyActive]: "Socially Active",
  [MemberStatus.WasActive]: "Was Active",
  [MemberStatus.WasSociallyActive]: "Was Socially Active",
  [MemberStatus.Terminated]: "Terminated",
  [MemberStatus.Duplicate]: "Duplicate",
};

// Helper to get label from backend value
export const getStatusLabel = (status: string): string => {
  return MemberStatusLabels[status as MemberStatus] || status;
};

export interface MemberOtherInfo {
  affiliation_with_mmu?: string;
  faculty?: string;
  year_joined?: string;
  from_where?: string;
  hacking_strengths?: string;
  hacking_interests?: string;
  why_join?: string;
  instagram_handle?: string;
  project_to_be_worked_on?: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  projects: Project[];
  status: MemberStatus;
  comment: string;
  register_date: Date;
  contact_number: string;
  discord_tag: string;
  student_id?: string;
  progress_talk_num: number;
  duration_active: string;
  avg_time_between_talks: string;
  meetups_since_last_talk: number;
  other_info?: MemberOtherInfo;
}


export interface Token {
  id: number;
  token_value: string;
  expiry_date: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Meetup {
  id: number;
  date: Date;
  number: number;
  category: MeetupCategory;
  host: Member;
  host_id: number;
}

export interface Update {
  id: number;
  meetup_id: number;
  meetup: Meetup;
  project_id: number;
  project: Project;
  member_id: number;
  member: Member;
  category: UpdateCategory;
  description: string;
  created_at: Date;
  updated_at: Date;
}

export enum UpdateCategory {
  IdeaTalk = "idea_talk",
  ProgressTalk = "progress_talk",
}

export enum MeetupCategory {
  RegularMeetup = "regular_meetup",
  Hackathon = "hackathon",
  OffRecordMeetup = "off_record_meetup",
}

export interface ProjectMember {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  category: ProjectCategory;
  completed: boolean;
  updates: Update[];
  created_at: Date;
  updated_at: Date;
}

export enum ProjectCategory {
  Project = "project",
  MiniProject = "mini_project",
  GroupProject = "group_project",
}
