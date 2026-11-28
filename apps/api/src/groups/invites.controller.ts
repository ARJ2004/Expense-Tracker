import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExcludeController,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { formatInviteCode, normalizeInviteCode } from '@et/domain';
import { CurrentUser, ErrorResponse, Public, type AuthUser } from '../common';
import { tunables } from '../config/tunables';
import { renderJoinPage } from './domain/join-page';
import { AcceptInviteDto, GroupDetailDto, InvitePreviewDto, PublicInvitePreviewDto } from './dto/group.dto';
import { InvitesService } from './invites.service';

const ANDROID_PACKAGE = 'in.altus.app';

/** Opening a join link inside the app: what it is, and joining. */
@ApiTags('groups')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Throttle({ default: tunables.rateLimits.invites })
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':code')
  @ApiOperation({ operationId: 'previewInvite', summary: 'The group a join link is for, and the names to pick from' })
  @ApiOkResponse({ type: InvitePreviewDto })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'INVITE_NOT_FOUND: unknown, turned off, or the group is gone' })
  preview(@CurrentUser() user: AuthUser, @Param('code') code: string): Promise<InvitePreviewDto> {
    return this.invites.preview(user.id, code);
  }

  @Post(':code/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'acceptInvite', summary: 'Join the group: claim a name, or join as a new one. Already in it: returns it.' })
  @ApiOkResponse({ type: GroupDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'INVITE_NOT_FOUND' })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_ALREADY_LINKED, GROUP_MEMBER_LIMIT or GROUP_LIMIT' })
  accept(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body() dto: AcceptInviteDto): Promise<GroupDetailDto> {
    return this.invites.accept(user.id, code, dto);
  }
}

/** For the web page: the group's name and icon and who invited. No sign-in. */
@ApiTags('groups')
@Throttle({ default: tunables.rateLimits.invites })
@Controller('public/invites')
export class PublicInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Get(':code')
  @ApiOperation({ operationId: 'previewInvitePublic', summary: 'Public: group name, icon and inviter for a join link' })
  @ApiOkResponse({ type: PublicInvitePreviewDto })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'INVITE_NOT_FOUND' })
  preview(@Param('code') code: string): Promise<PublicInvitePreviewDto> {
    return this.invites.publicPreview(code);
  }
}

/**
 * GET /j/:code (outside /v1): the page a join link opens in a browser. Behind Nginx's /altus/
 * proxy it is http://15.252.181.82/altus/j/<code>. Always 200 with a page, so a bad code reads as
 * "this link doesn't work" rather than an error screen.
 */
@ApiExcludeController()
@Throttle({ default: tunables.rateLimits.invites })
@Controller('j')
export class JoinPageController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Get(':code')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:")
  async page(@Param('code') raw: string): Promise<string> {
    const code = normalizeInviteCode(raw) ?? raw.slice(0, 16).replace(/[^0-9A-Za-z]/g, '');
    const preview = await this.invites.publicPreview(code).catch(() => null);
    return renderJoinPage({ code, displayCode: preview ? formatInviteCode(code) : code, preview, packageName: ANDROID_PACKAGE });
  }
}
