import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Moving a collection to PARTIAL / PAID needs evidence: a method, and for any
 * non-cash payment a proof file (screenshot / bank slip) uploaded first via
 * POST /uploads/payment-proofs.
 */
export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'UTR / transaction id / cheque number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD; defaults to today' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Amount paid so far; defaults to the full total for PAID' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional({ description: 'URL returned by POST /uploads/payment-proofs' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  paymentProofUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentRemarks?: string;
}
