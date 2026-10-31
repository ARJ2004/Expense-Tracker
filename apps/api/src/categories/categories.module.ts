import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategorizerService } from './categorizer.service';

@Module({ controllers: [CategoriesController], providers: [CategoriesService, CategorizerService], exports: [CategoriesService, CategorizerService] })
export class CategoriesModule {}
