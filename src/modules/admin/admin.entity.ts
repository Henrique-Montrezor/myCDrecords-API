// Admin response types

export interface UserAdminResponse {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  email_verified: boolean;
  created_at: Date;
  is_banned?: boolean;
  banned_reason?: string;
}

export interface ReviewAdminResponse {
  id: number;
  user_id: number;
  username: string;
  album_id: string;
  album_title: string;
  album_image?: string;
  album_artist?: string;
  rating: number;
  text?: string;
  created_at: Date;
}

export interface CommentAdminResponse {
  id: number;
  user_id: number;
  username: string;
  review_id?: number;
  album_id?: string;
  text: string;
  created_at: Date;
}

export interface ReportAdminResponse {
  id: number;
  reporter_id: number;
  reporter_username: string;
  reported_type: "review" | "comment" | "user";
  reported_id: number;
  reason: string;
  description?: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  created_at: Date;
  updated_at: Date;
}

export interface BanUserPayload {
  reason: string;
}

export interface BanResponse {
  message: string;
  user_id: number;
  banned: boolean;
}
