import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  BadRequestException,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import { BannerAudience, BannerLayout, BannerPlacement } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

export class CreateBannerDto {
  @ApiPropertyOptional({
    enum: BannerLayout,
    description: 'IMAGE_ONLY = one finished 1600x600 artwork, no text drawn by the site. Default TEXT.',
  })
  @IsOptional()
  @IsEnum(BannerLayout)
  layout?: BannerLayout;

  @ApiProperty({ description: 'Banner name; shown as the headline on TEXT banners, alt text on IMAGE_ONLY.' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Small eyebrow pill shown above the title.' })
  @IsOptional()
  @IsString()
  badgeText?: string;

  @ApiPropertyOptional({ description: 'Required for TEXT banners.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Storefront-facing image URL.' })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Required for TEXT banners.' })
  @IsOptional()
  @IsString()
  ctaTextPrimary?: string;

  @ApiPropertyOptional({ description: 'TEXT: the main button link (required). IMAGE_ONLY: optional link for a tap on the banner.' })
  @IsOptional()
  @IsString()
  ctaLinkPrimary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaTextSecondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaLinkSecondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ enum: BannerAudience })
  @IsOptional()
  @IsEnum(BannerAudience)
  targetAudience?: BannerAudience;

  @ApiPropertyOptional({ enum: BannerPlacement })
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  /** A TEXT banner draws its words on screen, so it cannot be saved without them. */
  private assertComplete(b: { layout?: BannerLayout | null; description?: string | null; ctaTextPrimary?: string | null; ctaLinkPrimary?: string | null }) {
    if ((b.layout ?? BannerLayout.TEXT) !== BannerLayout.TEXT) return;
    const missing = [
      !b.description?.trim() && 'description',
      !b.ctaTextPrimary?.trim() && 'button text',
      !b.ctaLinkPrimary?.trim() && 'button link',
    ].filter(Boolean);
    if (missing.length) {
      throw new BadRequestException(`A text banner needs ${missing.join(', ')}. Or choose "Full image" and upload a finished banner.`);
    }
  }

  create(dto: CreateBannerDto) {
    this.assertComplete(dto);
    return this.prisma.banner.create({
      data: {
        layout: dto.layout ?? BannerLayout.TEXT,
        title: dto.title,
        badgeText: dto.badgeText,
        description: dto.description ?? '',
        imageUrl: dto.imageUrl,
        ctaTextPrimary: dto.ctaTextPrimary ?? '',
        ctaLinkPrimary: dto.ctaLinkPrimary ?? '',
        ctaTextSecondary: dto.ctaTextSecondary,
        ctaLinkSecondary: dto.ctaLinkSecondary,
        backgroundColor: dto.backgroundColor ?? '#064e3b',
        textColor: dto.textColor ?? '#ffffff',
        targetAudience: dto.targetAudience ?? BannerAudience.ALL,
        placement: dto.placement ?? BannerPlacement.HOMEPAGE,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll(includeInactive = false) {
    return this.prisma.banner.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ placement: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    this.assertComplete({ ...banner, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) });

    return this.prisma.banner.update({
      where: { id },
      data: {
        layout: dto.layout,
        title: dto.title,
        badgeText: dto.badgeText,
        description: dto.description,
        imageUrl: dto.imageUrl,
        ctaTextPrimary: dto.ctaTextPrimary,
        ctaLinkPrimary: dto.ctaLinkPrimary,
        ctaTextSecondary: dto.ctaTextSecondary,
        ctaLinkSecondary: dto.ctaLinkSecondary,
        backgroundColor: dto.backgroundColor,
        textColor: dto.textColor,
        targetAudience: dto.targetAudience,
        placement: dto.placement,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      },
    });
  }

  async setActive(id: string, isActive: boolean) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    if (banner.isActive === isActive) return banner;
    return this.prisma.banner.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    await this.prisma.banner.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * What the storefront actually renders: active, in the requested slot, and
   * either targeted at everyone or at the caller's own channel. Unguarded
   * caller (see StorefrontBannersController), so nothing beyond these fields
   * is ever returned.
   */
  listPublic(placement: BannerPlacement, audience?: BannerAudience) {
    return this.prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        targetAudience: audience ? { in: [BannerAudience.ALL, audience] } : undefined,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}

@ApiTags('banners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  @RequirePermission('banners.create')
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Get()
  @RequirePermission('banners.view')
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.bannersService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @RequirePermission('banners.view')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('banners.edit')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermission('banners.edit')
  @ApiOperation({
    summary: 'Publish or unpublish a banner',
    description: 'An unpublished banner disappears from the storefront immediately. Nothing else references a banner, so this is always safe.',
  })
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.bannersService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @RequirePermission('banners.delete')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}

/**
 * Deliberately unguarded, same reasoning as StorefrontCatalogueController:
 * this is read before a shopper has signed in, and only ever returns what
 * staff have published.
 */
@ApiTags('storefront-banners')
@Controller('storefront/banners')
export class StorefrontBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({
    summary: 'Active banners for one storefront slot',
    description:
      'Pass audience=B2B for a signed-in retailer, audience=B2C for a shopper, or omit it to get ' +
      'only the ALL-audience banners.',
  })
  @ApiQuery({ name: 'placement', enum: BannerPlacement, required: false })
  @ApiQuery({ name: 'audience', enum: BannerAudience, required: false })
  list(
    @Query('placement') placement: BannerPlacement = BannerPlacement.HOMEPAGE,
    @Query('audience') audience?: BannerAudience,
  ) {
    return this.bannersService.listPublic(placement, audience);
  }
}

@Module({
  controllers: [BannersController, StorefrontBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
