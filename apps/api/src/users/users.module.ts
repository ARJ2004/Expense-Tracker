import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Owns the users table. Imports ingest only for its read-side LedgerQueryService (CSV export). */
@Module({
  imports: [IngestModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
