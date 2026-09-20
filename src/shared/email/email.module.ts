// This email module is imported in the app module so other services can have access
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

@Global()
@Module({
    providers: [EmailService], // For auth, you can create other email services & import them here
    exports: [EmailService],
})
export class EmailModule { }