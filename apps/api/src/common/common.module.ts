import { Global, Module } from '@nestjs/common';
import { JobQueue } from './jobs/job-queue.service';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({ providers: [PrismaService, JobQueue], exports: [PrismaService, JobQueue] })
export class CommonModule {}
