import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { istDateKey, istDayRange } from '@et/domain';
import { PrismaService } from '../common';
import { DevicesService } from './devices.service';
import { pushVerdict } from './domain/policy';
import { NOTIFICATION_INFO, NOTIFICATION_TYPES, type NotificationDraft, type NotificationType } from './domain/types';
import type { NotificationListDto, NotificationSettingsDto } from './dto/notification.dto';
import { PUSH_SENDER, type PushSender } from './push/push-sender';

/** What happened to a draft. Only "disabled" and "duplicate" leave no inbox row. */
export type NotifyResult = 'sent' | 'held' | 'no_device' | 'failed' | 'disabled' | 'duplicate';

/**
 * Owns notifications and notification_settings. Every draft from a rule, a notice or a listener
 * comes through notify(): the user's settings, the dedup key, quiet hours and the daily cap are
 * applied here and nowhere else.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  /** A property so tests can move the clock. */
  now = (): Date => new Date();

  async notify(userId: string, draft: NotificationDraft, options: { bypassLimits?: boolean } = {}): Promise<NotifyResult> {
    const settings = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    if (settings?.disabledTypes.includes(draft.type)) return 'disabled';

    const now = this.now();
    const { start } = istDayRange(istDateKey(now));
    const [sentToday, tokens] = await Promise.all([
      this.prisma.notification.count({ where: { userId, status: 'sent', createdAt: { gte: start } } }),
      this.devices.tokens(userId),
    ]);
    const verdict = options.bypassLimits ? 'send' : pushVerdict(draft.type, now, sentToday);
    const status = verdict !== 'send' ? 'held' : !this.sender.enabled || tokens.length === 0 ? 'no_device' : 'sending';

    let id: string;
    try {
      id = (
        await this.prisma.notification.create({
          data: { userId, type: draft.type, dedupKey: draft.dedupKey, title: draft.title, body: draft.body, data: draft.data ?? {}, status, createdAt: now },
        })
      ).id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
      throw e;
    }
    if (status !== 'sending') return status;

    let sent = false;
    for (const token of tokens) {
      const outcome = await this.sender.send({ token, title: draft.title, body: draft.body, data: { ...(draft.data ?? {}), notificationId: id, type: draft.type } });
      if (outcome === 'sent') sent = true;
      if (outcome === 'invalid') await this.devices.drop(token);
    }
    const final = sent ? 'sent' : 'failed';
    await this.prisma.notification.update({ where: { id }, data: { status: final } });
    return final;
  }

  async list(userId: string, limit = 50): Promise<NotificationListDto> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unreadCount: unread,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type as NotificationType,
        title: r.title,
        body: r.body,
        data: (r.data ?? {}) as Record<string, string>,
        createdAt: r.createdAt.toISOString(),
        read: r.readAt !== null,
      })),
    };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  async settings(userId: string): Promise<NotificationSettingsDto> {
    const row = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    const off = new Set(row?.disabledTypes ?? []);
    return {
      pushEnabled: this.sender.enabled,
      items: NOTIFICATION_TYPES.map((type) => ({ type, ...NOTIFICATION_INFO[type], enabled: !off.has(type) })),
    };
  }

  async setSettings(userId: string, disabledTypes: NotificationType[]): Promise<NotificationSettingsDto> {
    const unique = [...new Set(disabledTypes)];
    await this.prisma.notificationSettings.upsert({ where: { userId }, create: { userId, disabledTypes: unique }, update: { disabledTypes: unique } });
    return this.settings(userId);
  }
}
