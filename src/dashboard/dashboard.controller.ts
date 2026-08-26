import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { DashboardService } from './dashboard.service';
import {
  CategoryBreakdownQueryDto,
  DashboardPeriodQueryDto,
  RecentTransactionsQueryDto,
} from './dto/dashboard-query.dto';
import {
  CategoryBreakdownResponseDto,
  DashboardSummaryDto,
  RecentTransactionDto,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token is invalid' })
@ApiBadRequestResponse({ description: 'Invalid dashboard query' })
@ApiNotFoundResponse({ description: 'Account not found' })
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary')
  @ApiOperation({ summary: 'Get balance and monthly summary' })
  @ApiOkResponse({ type: DashboardSummaryDto })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardPeriodQueryDto,
  ): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(user.id, query);
  }
  @Get('category-breakdown')
  @ApiOperation({ summary: 'Get monthly totals grouped by category' })
  @ApiOkResponse({ type: CategoryBreakdownResponseDto })
  categoryBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CategoryBreakdownQueryDto,
  ): Promise<CategoryBreakdownResponseDto> {
    return this.dashboard.categoryBreakdown(user.id, query);
  }
  @Get('recent-transactions')
  @ApiOperation({ summary: 'Get recent active transactions' })
  @ApiOkResponse({ type: RecentTransactionDto, isArray: true })
  recentTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentTransactionsQueryDto,
  ): Promise<RecentTransactionDto[]> {
    return this.dashboard.recentTransactions(user.id, query);
  }
}
