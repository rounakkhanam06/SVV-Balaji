import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductionType } from '@prisma/client';
import { IsHowItsMadeUrl } from '../../common/how-its-made';

export class RecipeIngredientDto {
  @ApiProperty({ description: 'Must match the cropName on raw material batches' })
  @IsString()
  cropName: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ default: 'KG' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Share of the blend, 0-100. Required for MULTI_GRAIN.' })
  @IsOptional()
  @IsNumber()
  percentage?: number;
}

/** A formula field Super Admin adds beyond the fixed FRD 19.3 ones, e.g. "Sieve size". */
export class RecipeCustomFieldDto {
  @ApiProperty({ example: 'Sieve size' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @ApiProperty({ example: '60 mesh' })
  @IsString()
  @MaxLength(2000)
  value: string;
}

export class CreateRecipeDto {
  @ApiProperty()
  @IsString()
  recipeCode: string;

  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProductionType })
  @IsEnum(ProductionType)
  productionType: ProductionType;

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  // FRD 19.3 production formula
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mixingRatio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processingSequence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grindingInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roastingInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oilExtractionProcess?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packagingInstructions?: string;

  @ApiPropertyOptional({ type: [RecipeCustomFieldDto], description: 'Extra formula fields, in display order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RecipeCustomFieldDto)
  customFields?: RecipeCustomFieldDto[];

  @ApiPropertyOptional({ description: '"How this is made" link - YouTube, Instagram or any web page' })
  @IsOptional()
  @IsHowItsMadeUrl()
  howItsMadeUrl?: string;

  @ApiPropertyOptional({ description: 'Weight lost in processing, % of input (0 to under 100). Input = yield / (1 - loss/100).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99.99)
  expectedLossPercent?: number;

  @ApiPropertyOptional({ description: 'Expected output for one full batch' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  batchYieldQuantity?: number;

  @ApiPropertyOptional({ default: 'KG' })
  @IsOptional()
  @IsString()
  unit?: string;
}

/** The link is not part of the formula, so it is the one thing editable on any version. */
export class SetHowItsMadeUrlDto {
  @ApiPropertyOptional({ nullable: true, description: 'null or empty clears it' })
  @IsOptional()
  @IsHowItsMadeUrl()
  howItsMadeUrl?: string | null;
}
