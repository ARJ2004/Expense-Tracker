import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common';

/** Owns devices: the phones a user's pushes go to. Tokens are never logged or returned. */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registers a token for the user. A token seen under another account moves to this one. */
  async register(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.device.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  /** Sign-out: this phone stops getting the user's pushes. Unknown tokens are fine. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { userId, token } });
  }

  async tokens(userId: string): Promise<string[]> {
    return (await this.prisma.device.findMany({ where: { userId }, select: { token: true } })).map((d) => d.token);
  }

  /** FCM said the token is dead (app uninstalled). */
  async drop(token: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { token } });
  }

  async userIds(): Promise<string[]> {
    return (await this.prisma.device.findMany({ distinct: ['userId'], select: { userId: true } })).map((d) => d.userId);
  }
}
