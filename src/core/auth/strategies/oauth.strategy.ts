import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../../../core/auth/services/oauth.service';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private configService: ConfigService,
        private oauthService: OAuthService,
    ) {
        // Properly access config with appConfig prefix
        const googleConfig = configService.get('appConfig.google');

        // Add validation to ensure config exists
        if (!googleConfig?.clientId || !googleConfig?.clientSecret || !googleConfig?.callbackURL) {
            throw new Error(
                'Google OAuth configuration is missing. Please check your environment variables.\n' +
                `clientId: ${!!googleConfig?.clientId}\n` +
                `clientSecret: ${!!googleConfig?.clientSecret}\n` +
                `callbackURL: ${!!googleConfig?.callbackURL}`
            );
        }

        super({
            clientID: googleConfig.clientId,
            clientSecret: googleConfig.clientSecret,
            callbackURL: googleConfig.callbackURL,
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ): Promise<any> {
        try {
            const user = await this.oauthService.validateOAuthLogin(profile, 'google');

            // Pass user if found, otherwise pass false
            if (user) {
                done(null, user);
            } else {
                done(new Error('User not found or could not be created'), false);
            }
        } catch (error) {
            // Pass false instead of null for the user parameter
            done(error, false);
        }
    }
}

// ============================================
// Facebook OAuth Strategy
// ============================================

// @Injectable()
// export class FacebookOAuthStrategy extends PassportStrategy(Strategy, 'facebook') {
//     constructor(
//         private configService: ConfigService,
//         private oauthService: OAuthService,
//     ) {
//         const clientId = process.env.FACEBOOK_CLIENT_ID;
//         const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
//         const callbackURL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:2000/auth/facebook/callback';

//         if (!clientId || !clientSecret) {
//             throw new Error('Facebook OAuth credentials are missing in environment variables.');
//         }

//         super({
//             clientID: clientId,
//             clientSecret: clientSecret,
//             callbackURL: callbackURL,
//             scope: ['email', 'public_profile'],
//             profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
//         });
//     }

//     async validate(
//         accessToken: string,
//         refreshToken: string,
//         profile: Profile,
//         done: VerifyCallback,
//     ): Promise<any> {
//         try {
//             const user = await this.oauthService.validateOAuthLogin(profile, 'facebook');

//             if (user) {
//                 done(null, user);
//             } else {
//                 done(new Error('User could not be created or found'), false);
//             }
//         } catch (error) {
//             done(error, false);
//         }
//     }
// }

// ============================================
// GitHub OAuth Strategy (Optional)
// ============================================

// @Injectable()
// export class GithubOAuthStrategy extends PassportStrategy(Strategy, 'github') {
//     constructor(
//         private configService: ConfigService,
//         private oauthService: OAuthService,
//     ) {
//         const clientId = process.env.GITHUB_CLIENT_ID;
//         const clientSecret = process.env.GITHUB_CLIENT_SECRET;
//         const callbackURL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:2000/auth/github/callback';

//         if (!clientId || !clientSecret) {
//             throw new Error('GitHub OAuth credentials are missing in environment variables.');
//         }

//         super({
//             clientID: clientId,
//             clientSecret: clientSecret,
//             callbackURL: callbackURL,
//             scope: ['user:email'],
//         });
//     }

//     async validate(
//         accessToken: string,
//         refreshToken: string,
//         profile: Profile,
//         done: VerifyCallback,
//     ): Promise<any> {
//         try {
//             const user = await this.oauthService.validateOAuthLogin(profile, 'github');
//             done(null, user || false);
//         } catch (error) {
//             done(error, false);
//         }
//     }
// }