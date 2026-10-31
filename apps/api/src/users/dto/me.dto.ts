import { ApiProperty } from '@nestjs/swagger';
import { IncomeFrequency } from '@et/domain';

/** The signed-in user as the app sees them. */
export class MeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'asha@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'Asha' })
  name: string | null;

  @ApiProperty({ type: 'integer', nullable: true, example: 8500000, description: 'Monthly income in paise' })
  monthlyIncomePaise: number | null;

  @ApiProperty({ enum: Object.values(IncomeFrequency), enumName: 'IncomeFrequency', nullable: true })
  incomeFrequency: IncomeFrequency | null;

  @ApiProperty({ description: 'True once onboarding is finished' })
  onboarded: boolean;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone: string;
}
