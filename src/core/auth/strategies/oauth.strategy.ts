import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';

@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private configService: ConfigService,
        private oauthService: OAuthService,
    ) {
        super({
            clientID: configService.get('GOOGLE_CLIENT_ID'),
            clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
            callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
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
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }
}

// Facebook OAuth Strategy
@Injectable()
export class FacebookOAuthStrategy extends PassportStrategy(Strategy, 'facebook') {
    constructor(
        private configService: ConfigService,
        private oauthService: OAuthService,
    ) {
        super({
            clientID: configService.get('FACEBOOK_CLIENT_ID'),
            clientSecret: configService.get('FACEBOOK_CLIENT_SECRET'),
            callbackURL: configService.get('FACEBOOK_CALLBACK_URL'),
            scope: ['email', 'public_profile'],
            profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ): Promise<any> {
        try {
            const user = await this.oauthService.validateOAuthLogin(profile, 'facebook');
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }
}

// GitHub OAuth Strategy
@Injectable()
export class GithubOAuthStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(
        private configService: ConfigService,
        private oauthService: OAuthService,
    ) {
        super({
            clientID: configService.get('GITHUB_CLIENT_ID'),
            clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
            callbackURL: configService.get('GITHUB_CALLBACK_URL'),
            scope: ['user:email'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ): Promise<any> {
        try {
            const user = await this.oauthService.validateOAuthLogin(profile, 'github');
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }
}