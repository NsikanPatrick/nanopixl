import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
    @IsString()
    @MinLength(8)
    currentPassword!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(255)
    newPassword!: string;
}