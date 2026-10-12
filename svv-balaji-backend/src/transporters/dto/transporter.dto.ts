import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTransporterDto {
  @ApiProperty({ description: 'Company or owner-operator name' })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @ApiProperty({ example: '9876543210' })
  @Transform(trim)
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a 10-digit mobile number' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a 10-digit mobile number' })
  alternatePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '23ABCDE1234F1Z5' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { message: 'GSTIN looks like 23ABCDE1234F1Z5' })
  gstin?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN looks like ABCDE1234F' })
  panNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Pincode is 6 digits' })
  pincode?: string;

  // --- Insurance (optional) ---
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) insuranceProvider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) insurancePolicyNumber?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  insuranceValidUntil?: string;

  @ApiPropertyOptional({ description: 'Uploaded policy document' })
  @IsOptional()
  @IsString()
  insuranceDocumentUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class UpdateTransporterDto extends PartialType(CreateTransporterDto) {}

export class SetTransporterActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class QueryTransporterDto {
  @ApiPropertyOptional({ description: 'Name, code, phone or contact person' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: "'true' = active only (pickers), 'false' = inactive only" })
  @IsOptional()
  @IsString()
  active?: string;
}
