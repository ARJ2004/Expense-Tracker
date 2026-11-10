import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BudgetsModule } from '../budgets';
import { CategoriesModule } from '../categories';
import { IngestModule } from '../ingest';
import { RewardsModule } from '../rewards';
import { DevicesService } from './devices.service';
import { NotificationJobs } from './notification-jobs';
import { DevicesController, NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';
import { FcmPushSender, InboxOnlyPushSender } from './push/fcm-push-sender';
import { PUSH_SENDER, type PushSender } from './push/push-sender';
import { BigSpendRule } from './rules/big-spend.rule';
import { BudgetThresholdRule } from './rules/budget-threshold.rule';
import { DailySummaryNotice, MorningAllowanceNotice, StreakAtRiskNotice, WeeklyRecapNotice } from './rules/notices';
import { OverAllowanceRule } from './rules/over-allowance.rule';
import { SCHEDULED_NOTICES } from './rules/scheduled-notice';
import { TRANSACTION_ALERT_RULES } from './rules/transaction-alert-rule';
import { TransactionAlertsService } from './transaction-alerts.service';

const ALERT_RULES = [BudgetThresholdRule, OverAllowanceRule, BigSpendRule];
const NOTICES = [MorningAllowanceNotice, DailySummaryNotice, StreakAtRiskNotice, WeeklyRecapNotice];

/**
 * F11: owns devices, notifications and notification_settings. Reacts to ledger, goal and rewards
 * events and runs the scheduled notices; other modules never call it.
 */
@Module({
  imports: [IngestModule, BudgetsModule, RewardsModule, CategoriesModule],
  controllers: [NotificationsController, DevicesController],
  providers: [
    NotificationsService,
    DevicesService,
    TransactionAlertsService,
    NotificationsListener,
    NotificationJobs,
    ...ALERT_RULES,
    ...NOTICES,
    // Order matters: the first rule with something to say wins.
    { provide: TRANSACTION_ALERT_RULES, useFactory: (...rules: unknown[]) => rules, inject: ALERT_RULES },
    { provide: SCHEDULED_NOTICES, useFactory: (...notices: unknown[]) => notices, inject: NOTICES },
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushSender => {
        const key = config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
        if (!key) {
          new Logger('NotificationsModule').log('Push is off (no FIREBASE_SERVICE_ACCOUNT_BASE64); notifications go to the inbox only');
          return new InboxOnlyPushSender();
        }
        return FcmPushSender.fromBase64(key);
      },
    },
  ],
})
export class NotificationsModule {}
