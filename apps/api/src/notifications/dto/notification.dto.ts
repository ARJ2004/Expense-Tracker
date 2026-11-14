import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, Length } from 'class-validator';
import { NOTIFICATION_GROUPS, NOTIFICATION_TYPES, type NotificationGroup, type NotificationType } from '../domain/types';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'The FCM registration token' })
  @IsString()
  @Length(20, 4096)
  token: string;

  @ApiProperty({ enum: ['android'], example: 'android' })
  @IsIn(['android'])
  platform: 'android';
}

export class UnregisterDeviceDto {
  @ApiProperty()
  @IsString()
  @Length(1, 4096)
  token: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  type: NotificationType;

  @ApiProperty({ example: 'You can spend ₹640 today' })
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { screen: 'Budgets' }, description: 'Where a tap goes' })
  data: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty()
  read: boolean;
}

export class NotificationListDto {
  @ApiProperty({ example: 2 })
  unreadCount: number;

  @ApiProperty({ type: [NotificationDto], description: 'Newest first, at most 50' })
  items: NotificationDto[];
}

export class NotificationSettingDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  type: NotificationType;

  @ApiProperty({ enum: NOTIFICATION_GROUPS, enumName: 'NotificationGroup' })
  group: NotificationGroup;

  @ApiProperty({ example: 'Morning allowance' })
  label: string;

  @ApiProperty({ example: '9 am: what you can spend today' })
  description: string;

  @ApiProperty()
  enabled: boolean;
}

export class NotificationSettingsDto {
  @ApiProperty({ description: 'False until push (Firebase) is set up on the server; the inbox works either way' })
  pushEnabled: boolean;

  @ApiProperty({ type: [NotificationSettingDto] })
  items: NotificationSettingDto[];
}

export class UpdateNotificationSettingsDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType', isArray: true, description: 'Types switched off; every other type is on' })
  @IsArray()
  @ArrayMaxSize(NOTIFICATION_TYPES.length)
  @IsIn(NOTIFICATION_TYPES, { each: true })
  disabledTypes: NotificationType[];
}
