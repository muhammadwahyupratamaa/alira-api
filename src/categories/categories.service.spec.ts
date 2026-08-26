import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Category, CategoryType } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const userId = 'e0b76050-dc7c-4dba-adf3-7d1eb17f6b4f';
  const customCategory: Category = {
    id: '038795bb-eb20-4c53-899e-fbaef87f5231',
    userId,
    name: 'Freelance',
    type: CategoryType.INCOME,
    icon: 'briefcase',
    color: '#22C55E',
    isDefault: false,
    isActive: true,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
  };
  const defaultCategory: Category = {
    ...customCategory,
    id: '10000000-0000-4000-8000-000000000001',
    userId: null,
    name: 'Salary',
    icon: null,
    color: null,
    isDefault: true,
  };
  const categoryClient = {
    findMany: jest.fn().mockResolvedValue([defaultCategory, customCategory]),
    create: jest.fn().mockResolvedValue(customCategory),
    findFirst: jest.fn().mockResolvedValue(customCategory),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { category: categoryClient } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    categoryClient.findMany.mockResolvedValue([
      defaultCategory,
      customCategory,
    ]);
    categoryClient.create.mockResolvedValue(customCategory);
    categoryClient.findFirst.mockResolvedValue(customCategory);
    categoryClient.updateMany.mockResolvedValue({ count: 1 });
  });

  it('lists only defaults and the authenticated user categories', async () => {
    const service = new CategoriesService(prisma);
    await service.findAll(userId, {
      type: CategoryType.INCOME,
      includeInactive: true,
    });

    expect(categoryClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: CategoryType.INCOME,
          OR: [{ userId: null, isDefault: true, isActive: true }, { userId }],
        },
      }),
    );
  });

  it('creates a custom category owned by the authenticated user', async () => {
    const service = new CategoriesService(prisma);
    const result = await service.create(userId, {
      name: 'Freelance',
      type: CategoryType.INCOME,
      icon: 'briefcase',
      color: '#22C55E',
    });

    expect(categoryClient.create).toHaveBeenCalledWith({
      data: {
        userId,
        name: 'Freelance',
        type: CategoryType.INCOME,
        icon: 'briefcase',
        color: '#22C55E',
        isDefault: false,
      },
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('returns a clear conflict for duplicate custom names', async () => {
    categoryClient.create.mockRejectedValue({ code: 'P2002' });
    const service = new CategoriesService(prisma);

    await expect(
      service.create(userId, {
        name: 'freelance',
        type: CategoryType.INCOME,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents modifications to a default category', async () => {
    categoryClient.findFirst.mockResolvedValue(defaultCategory);
    const service = new CategoriesService(prisma);

    await expect(
      service.update(userId, defaultCategory.id, { name: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deactivate(userId, defaultCategory.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(categoryClient.updateMany).not.toHaveBeenCalled();
  });

  it('treats another user category as not found', async () => {
    categoryClient.findFirst.mockResolvedValue(null);
    const service = new CategoriesService(prisma);

    await expect(
      service.deactivate(userId, customCategory.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-disables an owned custom category', async () => {
    const service = new CategoriesService(prisma);
    await service.deactivate(userId, customCategory.id);

    expect(categoryClient.updateMany).toHaveBeenCalledWith({
      where: { id: customCategory.id, userId, isDefault: false },
      data: { isActive: false },
    });
  });
});
