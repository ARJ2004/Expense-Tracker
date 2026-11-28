import { Module } from '@nestjs/common';
import { GroupStore } from './group-store';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { InvitesController, JoinPageController, PublicInvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

/**
 * F12/F13: owns groups, group_members, group_expenses, group_expense_shares, group_payments,
 * group_invites and group_events. Shared by every linked member; account deletion goes through
 * GroupsService.purgeUser so a shared group never disappears with one account.
 */
@Module({
  controllers: [GroupsController, InvitesController, PublicInvitesController, JoinPageController],
  providers: [GroupStore, GroupsService, InvitesService],
  exports: [GroupsService],
})
export class GroupsModule {}
