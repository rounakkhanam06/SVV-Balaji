import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../common/sequence.service';
import { CreateTransporterDto, QueryTransporterDto, UpdateTransporterDto } from './dto/transporter.dto';

const day = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : undefined);

/**
 * Transporters registered with us - one of the transport sources for supplier
 * deliveries and farmer collections. No approval step: registering one makes
 * it available to pick; deactivating hides it from new trips.
 */
@Injectable()
export class TransportersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequence: SequenceService,
  ) {}

  private async assertPhoneFree(phone: string, exceptId?: string) {
    const clash = await this.prisma.transporter.findFirst({ where: { phone, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { transporterCode: true, name: true } });
    if (clash) throw new BadRequestException(`${phone} is already registered to ${clash.name} (${clash.transporterCode})`);
  }

  async create(dto: CreateTransporterDto, createdById: string) {
    await this.assertPhoneFree(dto.phone);
    return this.prisma.$transaction(async (tx) => {
      const transporterCode = await this.sequence.nextInSeries(tx, 'TRN', 4);
      return tx.transporter.create({
        data: { ...dto, insuranceValidUntil: day(dto.insuranceValidUntil), transporterCode, createdById },
      });
    });
  }

  findAll(query: QueryTransporterDto) {
    const q = query.q?.trim();
    const where: Prisma.TransporterWhereInput = {
      ...(query.active === 'true' ? { isActive: true } : query.active === 'false' ? { isActive: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { transporterCode: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { contactPerson: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.transporter.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { transports: true, collections: true } } },
    });
  }

  async findOne(id: string) {
    const transporter = await this.prisma.transporter.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { transports: true, collections: true } },
      },
    });
    if (!transporter) throw new NotFoundException('Transporter not found');
    return transporter;
  }

  async update(id: string, dto: UpdateTransporterDto) {
    await this.findOne(id);
    if (dto.phone) await this.assertPhoneFree(dto.phone, id);
    return this.prisma.transporter.update({
      where: { id },
      data: { ...dto, insuranceValidUntil: dto.insuranceValidUntil === undefined ? undefined : day(dto.insuranceValidUntil) },
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.transporter.update({ where: { id }, data: { isActive } });
  }
}
