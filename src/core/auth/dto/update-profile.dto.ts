import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @IsString()
    @IsOptional()
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    @MaxLength(100, { message: 'Name must not exceed 100 characters' })
    name?: string;

    // Add more fields if needed
    // @IsOptional()
    // @IsString()
    // bio?: string;
}