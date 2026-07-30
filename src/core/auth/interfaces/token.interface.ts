import { TokenPayload } from "./token-payload.interface";
/**
 * Token Response Interface
 * Used when returning tokens to the client
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
 * Token Request Interface
 * Used when requesting token refresh
 */
export interface RefreshTokenRequest {
    refreshToken: string;
}

/**
 * Token Validation Result
 * Used when validating tokens
 */
export interface TokenValidationResult {
    valid: boolean;
    payload?: TokenPayload;
    error?: string;
}

/**
 * Token Decode Options
 * Used when decoding tokens
 */
export interface TokenDecodeOptions {
    complete?: boolean;
    json?: boolean;
}

/**
 * Token Generation Options
 * Used when generating tokens
 */
export interface TokenGenerationOptions {
    expiresIn?: string | number;
    audience?: string;
    issuer?: string;
    subject?: string;
    [key: string]: any;
}