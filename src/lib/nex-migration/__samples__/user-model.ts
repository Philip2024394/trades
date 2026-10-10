// Sample TypeScript model consumed by nex-migration tests and by the
// /api/nex-migration/plan endpoint smoke checks. Not real production data.

export interface User {
  id: number;
  email: string;
  display_name: string;
  is_verified: boolean;
  created_at: Date;
  bio?: string;
  avatar_url: string | null;
}
