import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateTransporterDto, QueryTransporterDto, SetTransporterActiveDto, UpdateTransporterDto } from './dto/transporter.dto';
import { TransportersService } from './transporters.service';

@ApiTags('transporters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('transporters')
export class TransportersController {
  constructor(private readonly service: TransportersService) {}

  @Post()
  @RequirePermission('transporters.manage')
  @ApiOperation({ summary: 'Register a transporter (issues TRN-NNNN); insurance optional' })
  create(@Body() dto: CreateTransporterDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @RequirePermission('transporters.view')
  @ApiOperation({ summary: "List / search transporters. active=true for the transport-source picker" })
  findAll(@Query() query: QueryTransporterDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('transporters.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('transporters.manage')
  update(@Param('id') id: string, @Body() dto: UpdateTransporterDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermission('transporters.manage')
  @ApiOperation({ summary: 'Activate / deactivate. Inactive transporters cannot be picked for new trips' })
  setActive(@Param('id') id: string, @Body() dto: SetTransporterActiveDto) {
    return this.service.setActive(id, dto.isActive);
  }
}
