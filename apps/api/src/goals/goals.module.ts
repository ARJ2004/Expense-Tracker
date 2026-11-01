import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

/** Owns goals and goal_contributions; deleted with the user by cascade. */
@Module({ controllers: [GoalsController], providers: [GoalsService], exports: [GoalsService] })
export class GoalsModule {}
