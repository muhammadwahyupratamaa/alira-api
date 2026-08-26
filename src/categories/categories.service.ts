import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: CategoryQueryDto,
  ): Promise<CategoryResponseDto[]> {
    const typeFilter = query.type ? { type: query.type } : {};
    const categories = await this.prisma.category.findMany({
      where: {
        ...typeFilter,
        OR: [
          { userId: null, isDefault: true, isActive: true },
          {
            userId,
            ...(query.includeInactive ? {} : { isActive: true }),
          },
        ],
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    return categories.map((category) => this.toResponse(category));
  }

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      const category = await this.prisma.category.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          icon: dto.icon,
          color: dto.color,
          isDefault: false,
        },
      });
      return this.toResponse(category);
    } catch (error: unknown) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.requireVisibleCategory(userId, id, true);
    if (dto.type !== undefined) {
      const incompatibleTransactions = await this.prisma.transaction.count({
        where: { categoryId: id, userId, type: { not: dto.type } },
      });
      if (incompatibleTransactions > 0) {
        throw new ConflictException(
          'Category type cannot change while referenced by transactions',
        );
      }
    }
    const data: Prisma.CategoryUpdateManyMutationInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;

    try {
      const updated = await this.prisma.category.updateMany({
        where: { id, userId, isDefault: false },
        data,
      });
      if (updated.count !== 1)
        throw new NotFoundException('Category not found');
    } catch (error: unknown) {
      this.throwIfDuplicate(error);
      throw error;
    }

    const category = await this.prisma.category.findFirst({
      where: { id, userId, isDefault: false },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.toResponse(category);
  }

  async deactivate(userId: string, id: string): Promise<void> {
    const category = await this.requireVisibleCategory(userId, id, true);
    if (!category.isActive) return;

    const updated = await this.prisma.category.updateMany({
      where: { id, userId, isDefault: false },
      data: { isActive: false },
    });
    if (updated.count !== 1) throw new NotFoundException('Category not found');
  }

  private async requireVisibleCategory(
    userId: string,
    id: string,
    rejectDefault: boolean,
  ): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId: null, isDefault: true }, { userId }],
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (rejectDefault && category.isDefault) {
      throw new ForbiddenException('Default categories cannot be modified');
    }
    return category;
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      isDefault: category.isDefault,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private throwIfDuplicate(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        'A category with this name and type already exists',
      );
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
