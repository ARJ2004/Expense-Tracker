import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { DevicesService } from './devices.service';
import { NotificationListDto, NotificationSettingsDto, RegisterDeviceDto, UnregisterDeviceDto, UpdateNotificationSettingsDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ operationId: 'listNotifications', summary: 'The in-app inbox: the latest 50, newest first, and the unread count' })
  @ApiOkResponse({ type: NotificationListDto })
  list(@CurrentUser() user: AuthUser): Promise<NotificationListDto> {
    return this.notifications.list(user.id);
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'markNotificationsRead', summary: 'Mark every notification read' })
  @ApiNoContentResponse()
  markRead(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Get('settings')
  @ApiOperation({ operationId: 'getNotificationSettings', summary: 'Every notification type and whether it is on' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  settings(@CurrentUser() user: AuthUser): Promise<NotificationSettingsDto> {
    return this.notifications.settings(user.id);
  }

  @Put('settings')
  @ApiOperation({ operationId: 'updateNotificationSettings', summary: 'Switch notification types off (the rest are on)' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  setSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateNotificationSettingsDto): Promise<NotificationSettingsDto> {
    return this.notifications.setSettings(user.id, dto.disabledTypes);
  }

  @Post('test')
  @ApiOperation({ operationId: 'sendTestNotification', summary: "A test push to the caller's phones, ignoring quiet hours and the daily cap" })
  @ApiOkResponse({ schema: { type: 'object', properties: { result: { type: 'string', example: 'sent' } }, required: ['result'] } })
  async test(@CurrentUser() user: AuthUser): Promise<{ result: string }> {
    const result = await this.notifications.notify(
      user.id,
      { type: 'daily_summary', dedupKey: `test:${Date.now()}`, title: 'Notifications are working 🎉', body: "You'll hear from Altus here", data: { screen: 'Notifications' } },
      { bypassLimits: true },
    );
    return { result };
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@ApiBadRequestResponse({ type: ErrorResponse })
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'registerDevice', summary: "Register this phone's push token (after sign-in and when it changes)" })
  @ApiNoContentResponse()
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto): Promise<void> {
    return this.devices.register(user.id, dto.token, dto.platform);
  }

  /** A POST with the token in the body, not DELETE /devices/:token, so tokens never reach request logs. */
  @Post('unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'unregisterDevice', summary: 'Stop pushes to this phone (sign-out)' })
  @ApiNoContentResponse()
  unregister(@CurrentUser() user: AuthUser, @Body() dto: UnregisterDeviceDto): Promise<void> {
    return this.devices.unregister(user.id, dto.token);
  }
}
