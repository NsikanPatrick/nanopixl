import { IsString, IsOptional, MaxLength, MinLength, IsUrl } from 'class-validator';

export class UpdateProfileDto {
    @IsString()
    @IsOptional()
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    @MaxLength(100, { message: 'Name must not exceed 100 characters' })
    username?: string;

    @IsString()
    @IsOptional()
    @MinLength(2, { message: 'First name must be at least 2 characters long' })
    @MaxLength(50, { message: 'First name must not exceed 50 characters' })
    firstName?: string;

    @IsString()
    @IsOptional()
    @MinLength(2, { message: 'Last name must be at least 2 characters long' })
    @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
    lastName?: string;

    @IsString()
    @IsOptional()
    @IsUrl({}, { message: 'Profile picture must be a valid URL' })
    profilePicture?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
    bio?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255, { message: 'Avatar URL must not exceed 255 characters' })
    avatarUrl?: string;
}