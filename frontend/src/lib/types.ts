export type Role = "admin" | "user";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  name: string;
  mii_id: string;
  division: string;
  site: string;
  created_at: string;
}

export type MappingScope = "cell" | "daily_column";

export type MappingField =
  | "date"
  | "time_in"
  | "time_out"
  | "status"
  | "activity"
  | "project_name"
  | "project_id"
  | "app_impacted"
  | "meta_name"
  | "meta_mii_id"
  | "meta_division"
  | "meta_site"
  | "meta_month"
  | "meta_year";

export interface CellMapping {
  id?: number;
  template_id?: number;
  field: MappingField;
  scope: MappingScope;
  cell_ref?: string;
  column?: string;
  start_row?: number;
  fillable: boolean;
}

export interface Template {
  id: number;
  name: string;
  description: string;
  sheet_name: string;
  is_default: boolean;
  cell_mappings: CellMapping[];
  created_at: string;
}

export interface DailyActivity {
  id?: number;
  date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  status: string;
  activity: string;
  project_name: string;
  project_id: string;
  app_impacted: string;
}

export interface Passkey {
  id: number;
  user_id: number;
  friendly_name: string;
  created_at: string;
}

export interface ProfileChangeRequest {
  id: number;
  user_id: number;
  status: "pending" | "approved" | "rejected";
  name: string;
  mii_id: string;
  division: string;
  site: string;
  created_at: string;
  user?: User;
}
