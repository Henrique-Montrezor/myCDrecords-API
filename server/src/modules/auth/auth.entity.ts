// Request/Response types for Auth endpoints

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetPayload {
  token: string;
  password: string;
  confirmPassword?: string;
}

export interface EmailVerificationPayload {
  token: string;
}

export interface EmailUpdatePayload {
  email: string;
}

export interface OAuthRequest {
  code?: string;
  state?: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserAuthResponse {
  id: number;
  email: string;
  username: string;
  isActive: boolean;
  emailVerified: boolean;
}

export interface AuthResponse {
  message: string;
  user?: UserAuthResponse;
  token?: string;
  tokens?: AuthTokenResponse;
}
