import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

/** Owns groups and their members, expenses and payments; deleted with the user by cascade. */
@Module({ controllers: [GroupsController], providers: [GroupsService], exports: [GroupsService] })
export class GroupsModule {}
