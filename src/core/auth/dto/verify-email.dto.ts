import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class VerifyEmailDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    @MaxLength(6)
    code!: string;
}