import { IsUUID, IsString, MinLength, MaxLength } from 'class-validator';

export class TwoFactorDto {
    @IsUUID()
    userId!: string;

    @IsString()
    @MinLength(6)
    @MaxLength(6)
    code!: string;
}