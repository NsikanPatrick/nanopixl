// src/core/dto/reset-password.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    @MaxLength(6)
    code!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(255)
    newPassword!: string;
}