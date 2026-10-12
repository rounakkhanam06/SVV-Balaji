import { BadRequestException } from '@nestjs/common';
import { Prisma, SupplierStatus, TransportSource } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Who brings the goods in - one rule for supplier deliveries and farmer
 * collections, so both forms and both APIs behave the same way.
 *
 *   SUPPLIER     a supplier's own vehicle (transportSupplierId)
 *   TRANSPORTER  a transporter registered with us (transporterId)
 *   FARMER       the farmer's own vehicle - collections only
 *
 * The vehicle and driver of the trip live on the trip record itself.
 */
export class TransportSourceFieldsDto {
  @ApiPropertyOptional({ enum: TransportSource })
  @IsOptional()
  @IsEnum(TransportSource)
  transportSource?: TransportSource;

  @ApiPropertyOptional({ description: 'Supplier providing the vehicle (transportSource = SUPPLIER)' })
  @IsOptional()
  @IsString()
  transportSupplierId?: string;

  @ApiPropertyOptional({ description: 'Registered transporter (transportSource = TRANSPORTER)' })
  @IsOptional()
  @IsString()
  transporterId?: string;
}

/** The trip details collections now record too (supplier transports always had them). */
export class TripFieldsDto extends TransportSourceFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  driverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverPhone?: string;
}

export interface ResolvedTransportSource {
  transportSource: TransportSource | null;
  transportSupplierId: string | null;
  transporterId: string | null;
}

type Client = Prisma.TransactionClient | { supplier: Prisma.SupplierDelegate; transporter: Prisma.TransporterDelegate };

/**
 * Validates the source fields and returns exactly what to store. Undefined
 * means "nothing about the source was sent" - leave it as it is.
 *
 *   - `defaultSupplierId`: supplier deliveries default to the delivering supplier.
 *   - `current`: on an edit, the stored values, so sending only an id keeps the source.
 *   - An id that does not belong to the chosen source is refused rather than
 *     silently dropped, so a form bug cannot store something nobody picked.
 */
export async function resolveTransportSource(
  db: Client,
  input: TransportSourceFieldsDto,
  opts: { allowFarmer: boolean; defaultSupplierId?: string; current?: ResolvedTransportSource },
): Promise<ResolvedTransportSource | undefined> {
  const sent = input.transportSource !== undefined || input.transportSupplierId !== undefined || input.transporterId !== undefined;
  if (!sent && opts.current) return undefined;
  if (!sent && !opts.defaultSupplierId) return undefined;

  const source = input.transportSource ?? opts.current?.transportSource ?? (opts.defaultSupplierId ? TransportSource.SUPPLIER : null);
  if (!source) {
    throw new BadRequestException('Choose how the goods are transported');
  }

  if (source === TransportSource.FARMER) {
    if (!opts.allowFarmer) throw new BadRequestException("'Farmer's own vehicle' is only for farmer collections");
    if (input.transportSupplierId || input.transporterId) {
      throw new BadRequestException("A farmer's own vehicle has no supplier or transporter to pick");
    }
    return { transportSource: source, transportSupplierId: null, transporterId: null };
  }

  if (source === TransportSource.SUPPLIER) {
    if (input.transporterId) throw new BadRequestException('A transporter was chosen, but the source is Supplier');
    const supplierId =
      input.transportSupplierId ??
      (opts.current?.transportSource === TransportSource.SUPPLIER ? opts.current.transportSupplierId : null) ??
      opts.defaultSupplierId ??
      null;
    if (!supplierId) throw new BadRequestException('Choose the supplier providing the vehicle');
    const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { fullName: true, status: true } });
    if (!supplier) throw new BadRequestException('Transport supplier not found');
    if (supplier.status === SupplierStatus.BLACKLISTED || supplier.status === SupplierStatus.SUSPENDED) {
      throw new BadRequestException(`${supplier.fullName} is ${supplier.status.toLowerCase()} and cannot be used for transport`);
    }
    return { transportSource: source, transportSupplierId: supplierId, transporterId: null };
  }

  // TRANSPORTER
  if (input.transportSupplierId) throw new BadRequestException('A supplier was chosen, but the source is Registered Transporter');
  const transporterId =
    input.transporterId ?? (opts.current?.transportSource === TransportSource.TRANSPORTER ? opts.current.transporterId : null);
  if (!transporterId) throw new BadRequestException('Choose the registered transporter');
  const transporter = await db.transporter.findUnique({ where: { id: transporterId }, select: { name: true, isActive: true } });
  if (!transporter) throw new BadRequestException('Transporter not found');
  if (!transporter.isActive) throw new BadRequestException(`${transporter.name} is inactive - reactivate them or choose another transporter`);
  return { transportSource: source, transportSupplierId: null, transporterId };
}

/** Prisma include for showing the source by name. */
export const TRANSPORT_SOURCE_INCLUDE = {
  transportSupplier: { select: { id: true, fullName: true, companyName: true, supplierCode: true } },
  transporter: { select: { id: true, name: true, transporterCode: true, phone: true } },
} as const;
