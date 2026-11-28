import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

/** The website's iPhone waitlist. Owns `waitlist_entries`; uses no other feature module. */
@Module({ controllers: [WaitlistController], providers: [WaitlistService] })
export class WaitlistModule {}
