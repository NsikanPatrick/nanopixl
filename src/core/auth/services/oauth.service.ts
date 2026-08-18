import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class OAuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    /**
     * Validate OAuth login and return user
     */
    async validateOAuthLogin(profile: any, provider: string): Promise<User> {
        const { id, emails, displayName, photos } = profile;
        const email = emails?.[0]?.value;

        if (!email) {
            throw new UnauthorizedException('No email provided by OAuth provider');
        }

        // Try to find user by provider ID first, then by email
        let user = await this.userRepository.findOne({
            where: [
                { providerId: id, provider },
                { email }
            ],
        });

        // If user exists but doesn't have provider ID set, update it
        if (user && !user.providerId) {
            user.providerId = id;
            user.provider = provider;
            user.isEmailVerified = true;
            await this.userRepository.save(user);
            return user;
        }

        // If user doesn't exist, create new user
        if (!user) {
            user = this.userRepository.create({
                email,
                username: this.generateUsername(email, displayName),
                firstName: displayName?.split(' ')[0] || '',
                lastName: displayName?.split(' ').slice(1).join(' ') || '',
                provider,
                providerId: id,
                avatarUrl: photos?.[0]?.value,
                isEmailVerified: true,
                isActive: true,
                subscriptionTier: 'free',
            });

            await this.userRepository.save(user);
            return user;
        }

        // User found - ensure email is verified
        if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            await this.userRepository.save(user);
        }

        return user;
    }

    /**
     * Generate a unique username
     */
    private generateUsername(email: string, displayName?: string): string {
        if (displayName) {
            // Remove special characters and spaces
            const baseUsername = displayName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');

            if (baseUsername.length >= 3) {
                return baseUsername;
            }
        }

        // Use email prefix as fallback
        return email.split('@')[0].toLowerCase();
    }

    /**
     * Find or create user from OAuth profile
     */
    async findOrCreateUser(profile: any, provider: string): Promise<User> {
        try {
            return await this.validateOAuthLogin(profile, provider);
        } catch (error) {
            throw new UnauthorizedException(`Failed to authenticate with ${provider}: ${error.message}`);
        }
    }

    /**
     * Link OAuth account to existing user
     */
    async linkOAuthAccount(userId: string, profile: any, provider: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const { id, emails, displayName, photos } = profile;
        const email = emails?.[0]?.value;

        // Check if OAuth account is already linked to another user
        const existingUser = await this.userRepository.findOne({
            where: { providerId: id, provider }
        });

        if (existingUser && existingUser.id !== userId) {
            throw new UnauthorizedException('OAuth account is already linked to another user');
        }

        // Link the OAuth account
        user.providerId = id;
        user.provider = provider;
        user.isEmailVerified = true;

        // Update avatar if not set
        if (!user.avatarUrl && photos?.[0]?.value) {
            user.avatarUrl = photos[0].value;
        }

        await this.userRepository.save(user);
        return user;
    }

    /**
     * Unlink OAuth account from user
     */
    async unlinkOAuthAccount(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        user.providerId = undefined;
        user.provider = 'email'; // Reset to email provider

        await this.userRepository.save(user);
        return user;
    }

    /**
     * Get user by OAuth provider and ID
     */
    async getUserByProvider(provider: string, providerId: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { provider, providerId }
        });
    }

    /**
     * Check if user has OAuth account linked
     */
    async hasOAuthAccount(userId: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: { id: userId }
        });

        return user?.provider !== 'email' && user?.providerId !== null;
    }

    /**
     * Get OAuth provider for user
     */
    async getUserProvider(userId: string): Promise<string | null> {
        const user = await this.userRepository.findOne({
            where: { id: userId }
        });

        return user?.provider || null;
    }
}