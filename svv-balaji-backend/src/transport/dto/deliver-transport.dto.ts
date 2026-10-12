import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliverTransportDto {
  @ApiProperty({ description: 'Warehouse the goods were unloaded at - the raw batch is stocked here' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Weighed quantity actually received. Defaults to the quantity sent.' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  receivedQuantity?: number;

  @ApiPropertyOptional({ description: 'Price per unit, if not already on the transport' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  purchaseRate?: number;
}
