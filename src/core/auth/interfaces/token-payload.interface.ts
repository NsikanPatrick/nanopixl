// src/modules/auth/interfaces/token-payload.interface.ts

/**
 * JWT Token Payload Interface
 */
export interface TokenPayload {
    sub: string; // User ID
    email: string;
    username: string;
    roles?: string[];
    permissions?: string[];
    subscriptionTier?: string;
    iss?: string;
    aud?: string;
    iat?: number;
    exp?: number;
    nbf?: number;
    jti?: string;
    [key: string]: any;
}

/**
 * Token Response Interface
 */
export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    user?: {
        id: string;
        email: string;
        username: string;
        roles: string[];
        permissions: string[];
    };
}

/**
 * Token Generation Options
 */
export interface TokenGenerationOptions {
    expiresIn?: string | number;
    audience?: string;
    issuer?: string;
    subject?: string;
    [key: string]: any;
}