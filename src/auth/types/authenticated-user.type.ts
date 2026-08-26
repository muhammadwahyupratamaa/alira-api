export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}
