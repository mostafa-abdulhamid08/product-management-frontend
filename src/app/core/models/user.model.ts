export interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  status_label: string;
  role: string;
  role_display_name: string;
  permissions: string[];
  created_at: string;
}
