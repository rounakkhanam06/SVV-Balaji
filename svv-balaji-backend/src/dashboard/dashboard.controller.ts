import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { branchScopeFor } from '../common/branch-scope';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DashboardService } from './dashboard.service';
import { ReportsService } from '../reports/reports.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly reports: ReportsService,
  ) {}

  @Get('summary')
  @RequirePermission('dashboard.view')
  @ApiOperation({
    summary: 'Get dashboard summary metrics',
    description: 'Returns aggregated metrics and recent activity for the dashboard. Scoped by branch if user is not a Super Admin.',
  })
  getSummary(@CurrentUser() user: JwtPayload) {
    /**
     * Scoped by the shared rule, not by a local one.
     *
     * This used to read `user.branchId ?? undefined`, which failed open: a
     * non-super-admin with no branch assigned fell through to `undefined` and
     * was handed organisation-wide figures. That gave the least-configured
     * accounts in the system the widest view, which is precisely backwards.
     * `branchScopeFor` refuses them instead.
     */
    return this.dashboardService.getSummary(branchScopeFor(user));
  }

  @Get('commerce')
  @RequirePermission('dashboard.view')
  @ApiOperation({
    summary: 'Customer & Retail dashboard: today and this month by channel, orders to fulfil, approvals, tickets, returns, receivables, low stock',
    description:
      'Today / this month are IST calendar days. Optional from/to (YYYY-MM-DD, IST) replace "this month" ' +
      'with that period for the revenue-by-channel figures. Branch staff see their own branch.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-11-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-11-24' })
  getCommerce(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.commerceDashboard(user, from, to);
  }
}
