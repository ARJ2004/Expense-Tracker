export { CategoriesModule } from './categories.module';
export { CategoriesService, toCategoryDto } from './categories.service';
export { CategorizerService, type CorrectionLog } from './categorizer.service';
export type { CategorizeInput, CategoryMatch } from './domain/categorizer-rule';
export { CategoryDto } from './dto/category.dto';
export { CATEGORY_DELETED, type CategoryDeletedEvent } from './categories.events';
