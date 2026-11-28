import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common';
import type { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds the address once. A repeat is a no-op, so the response never tells anyone whether an
   * address was already on the list.
   */
  async join(dto: JoinWaitlistDto): Promise<void> {
    await this.prisma.waitlistEntry.upsert({
      where: { email: dto.email },
      create: { email: dto.email, platform: 'ios', source: dto.source ?? null },
      update: {},
    });
  }
}
