import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    @MaxLength(255)
    email!: string;

    @IsString()
    @MinLength(3)
    @MaxLength(50)
    username!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(255)
    password!: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    lastName?: string;
}









