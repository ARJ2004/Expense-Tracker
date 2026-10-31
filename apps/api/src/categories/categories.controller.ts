import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { CategoriesService } from './categories.service';
import { CategoryDto, CategoryListDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ operationId: 'listCategories', summary: 'System categories plus the caller’s own' })
  @ApiOkResponse({ type: CategoryListDto })
  async list(@CurrentUser() user: AuthUser): Promise<CategoryListDto> {
    return { items: await this.categories.list(user.id) };
  }

  @Post()
  @ApiOperation({ operationId: 'createCategory', summary: 'Add a custom category' })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'CATEGORY_EXISTS' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateCategory', summary: 'Rename or restyle a custom category' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiForbiddenResponse({ type: ErrorResponse, description: 'CATEGORY_SYSTEM' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'CATEGORY_EXISTS' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryDto> {
    return this.categories.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteCategory', summary: 'Delete a custom category; its transactions move to Other' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ type: ErrorResponse, description: 'CATEGORY_SYSTEM' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(user.id, id);
  }
}
