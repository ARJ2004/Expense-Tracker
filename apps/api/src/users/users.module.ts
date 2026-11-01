import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { ImportsModule } from '../imports';
import { IngestModule } from '../ingest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Owns the users table. Imports ingest for its read-side LedgerQueryService (CSV export), and the
 * modules that own a user's data so account deletion asks each to purge its own tables.
 */
@Module({
  imports: [IngestModule, ImportsModule, CategoriesModule, AccountsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
