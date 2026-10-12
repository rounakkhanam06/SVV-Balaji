import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus, SupplierStatus, TransportSource, TransportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../common/sequence.service';
import { nextRawBatchNumber } from '../common/raw-batch-number';
import { CreateTransportDto } from './dto/create-transport.dto';
import { UpdateTransportDto } from './dto/update-transport.dto';
import { QueryTransportDto } from './dto/query-transport.dto';
import { DeliverTransportDto } from './dto/deliver-transport.dto';
import { resolveTransportSource, TRANSPORT_SOURCE_INCLUDE, type ResolvedTransportSource } from '../common/transport-source';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A supplier delivery always has a source (it defaults to the delivering supplier). */
const sourceData = (s?: ResolvedTransportSource) =>
  s ? { transportSource: s.transportSource ?? TransportSource.SUPPLIER, transportSupplierId: s.transportSupplierId, transporterId: s.transporterId } : {};

/**
 * Inbound material from suppliers - the supplier counterpart of a farmer
 * collection. A transport is scheduled, dispatched and delivered; delivery is
 * where the raw material batch (RM-...) is born, so from there on supplier
 * material flows through QC, production and traceability exactly like a
 * farmer's.
 */
@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequence: SequenceService,
  ) {}

  /**
   * The supplier must exist and not be blocked, and a linked purchase order
   * must be that supplier's and still open. Returns the PO rate to fall back on.
   */
  private async checkSupplierAndPo(supplierId: string, purchaseOrderId?: string | null): Promise<number | null> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId }, select: { status: true, fullName: true } });
    if (!supplier) throw new BadRequestException('Supplier not found');
    if (supplier.status === SupplierStatus.BLACKLISTED || supplier.status === SupplierStatus.SUSPENDED) {
      throw new BadRequestException(`${supplier.fullName} is ${supplier.status.toLowerCase()} - material cannot be received from them`);
    }
    if (!purchaseOrderId) return null;
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po) throw new BadRequestException('Purchase order not found');
    if (po.supplierId !== supplierId) throw new BadRequestException(`${po.poNumber} belongs to another supplier`);
    if (po.status === PurchaseOrderStatus.CANCELLED || po.status === PurchaseOrderStatus.FULFILLED) {
      throw new BadRequestException(`${po.poNumber} is ${po.status.toLowerCase()} - it cannot take another delivery`);
    }
    return Number(po.purchaseRate);
  }

  async create(dto: CreateTransportDto, createdById: string) {
    const poRate = await this.checkSupplierAndPo(dto.supplierId, dto.purchaseOrderId);
    const purchaseRate = dto.purchaseRate ?? poRate ?? undefined;
    // Defaults to the delivering supplier's own vehicle.
    const source = await resolveTransportSource(this.prisma, dto, { allowFarmer: false, defaultSupplierId: dto.supplierId });
    return this.prisma.supplierTransport.create({
      data: {
        ...dto,
        ...sourceData(source),
        purchaseRate,
        totalAmount: purchaseRate !== undefined ? round2(purchaseRate * dto.quantity) : undefined,
        scheduledDate: new Date(dto.scheduledDate),
        createdById,
      },
      include: {
        supplier: { select: { id: true, fullName: true, supplierCode: true } },
        ...TRANSPORT_SOURCE_INCLUDE,
      },
    });
  }

  findAll(query: QueryTransportDto) {
    const where: Prisma.SupplierTransportWhereInput = {
      supplierId: query.supplierId,
      warehouseId: query.warehouseId,
      transporterId: query.transporterId,
      materialName: query.materialName ? { contains: query.materialName, mode: 'insensitive' } : undefined,
      status: query.status,
    };

    return this.prisma.supplierTransport.findMany({
      where,
      orderBy: { scheduledDate: 'desc' },
      include: {
        supplier: { select: { id: true, fullName: true, supplierCode: true } },
        warehouse: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true, status: true } },
        ...TRANSPORT_SOURCE_INCLUDE,
      },
    });
  }

  async findOne(id: string) {
    const transport = await this.prisma.supplierTransport.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        batch: { select: { id: true, batchNumber: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
        ...TRANSPORT_SOURCE_INCLUDE,
      },
    });
    if (!transport) throw new NotFoundException('Transport not found');
    return transport;
  }

  async update(id: string, dto: UpdateTransportDto) {
    const transport = await this.prisma.supplierTransport.findUnique({ where: { id } });
    if (!transport) throw new NotFoundException('Transport not found');
    if (transport.status !== TransportStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot edit transport in ${transport.status} status`);
    }
    if (dto.supplierId !== undefined || dto.purchaseOrderId !== undefined) {
      await this.checkSupplierAndPo(dto.supplierId ?? transport.supplierId, dto.purchaseOrderId ?? transport.purchaseOrderId);
    }
    const quantity = dto.quantity ?? Number(transport.quantity);
    const rate = dto.purchaseRate ?? (transport.purchaseRate === null ? null : Number(transport.purchaseRate));
    const source = await resolveTransportSource(this.prisma, dto, {
      allowFarmer: false,
      defaultSupplierId: dto.supplierId ?? transport.supplierId,
      current: transport,
    });

    return this.prisma.supplierTransport.update({
      where: { id },
      data: {
        ...dto,
        ...sourceData(source),
        totalAmount: rate !== null ? round2(rate * quantity) : undefined,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
      },
    });
  }

  async dispatch(id: string) {
    const transport = await this.prisma.supplierTransport.findUnique({ where: { id } });
    if (!transport) throw new NotFoundException('Transport not found');
    if (transport.status !== TransportStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot dispatch transport in ${transport.status} status`);
    }

    return this.prisma.supplierTransport.update({
      where: { id },
      data: {
        status: TransportStatus.IN_TRANSIT,
        dispatchedAt: new Date(),
      },
    });
  }

  /**
   * The goods have arrived. In one transaction: the transport is closed with a
   * receipt (SR-...), a raw material batch is created for this supplier, the
   * received quantity is booked into the warehouse (stock row + STOCK_IN
   * movement, exactly as a farmer collection does), and a linked purchase
   * order's fulfilment is updated.
   *
   * The batch is STORED and follows the same quality rules as farmer material:
   * a RAW_MATERIAL inspection that fails (or needs rework) blocks production.
   */
  async deliver(id: string, dto: DeliverTransportDto, performedById: string) {
    const transport = await this.prisma.supplierTransport.findUnique({ where: { id } });
    if (!transport) throw new NotFoundException('Transport not found');
    if (transport.status !== TransportStatus.IN_TRANSIT && transport.status !== TransportStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot deliver transport in ${transport.status} status`);
    }
    const warehouseId = dto.warehouseId || transport.warehouseId;
    if (!warehouseId) throw new BadRequestException('Choose the warehouse the goods were unloaded at');
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, branchId: true } });
    if (!warehouse) throw new BadRequestException('Warehouse not found');

    const quantity = dto.receivedQuantity ?? Number(transport.quantity);
    const rate = dto.purchaseRate ?? (transport.purchaseRate === null ? null : Number(transport.purchaseRate));
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.sequence.next(tx, 'SR', now);
      const batchNumber = await nextRawBatchNumber(tx, now);

      const delivered = await tx.supplierTransport.update({
        where: { id },
        data: {
          status: TransportStatus.DELIVERED,
          deliveredAt: now,
          dispatchedAt: transport.dispatchedAt ?? now,
          warehouseId,
          quantity,
          purchaseRate: rate,
          totalAmount: rate !== null ? round2(rate * quantity) : null,
          receiptNumber,
        },
      });

      const batch = await tx.rawMaterialBatch.create({
        data: {
          batchNumber,
          supplierTransportId: transport.id,
          supplierId: transport.supplierId,
          branchId: warehouse.branchId,
          cropName: transport.materialName,
          quantity,
          unit: transport.unit,
          status: 'STORED',
          warehouseId,
        },
      });

      await tx.warehouseStock.create({
        data: { warehouseId, batchId: batch.id, quantity, unit: transport.unit },
      });
      await tx.stockMovement.create({
        data: {
          batchId: batch.id,
          toWarehouseId: warehouseId,
          movementType: 'STOCK_IN',
          quantity,
          unit: transport.unit,
          reason: `Received from supplier, receipt ${receiptNumber}`,
          performedById,
        },
      });

      if (transport.purchaseOrderId) await this.refreshPoFulfilment(tx, transport.purchaseOrderId);

      return { ...delivered, batch: { id: batch.id, batchNumber: batch.batchNumber, status: batch.status } };
    });
  }

  /** A PO is FULFILLED once delivered transports reach its expected quantity, PARTIALLY_FULFILLED before that. */
  private async refreshPoFulfilment(tx: Prisma.TransactionClient, purchaseOrderId: string) {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po || po.status === PurchaseOrderStatus.CANCELLED) return;
    const got = await tx.supplierTransport.aggregate({
      where: { purchaseOrderId, status: TransportStatus.DELIVERED },
      _sum: { quantity: true },
    });
    const received = Number(got._sum.quantity ?? 0);
    const status = received >= Number(po.expectedQuantity) ? PurchaseOrderStatus.FULFILLED : PurchaseOrderStatus.PARTIALLY_FULFILLED;
    if (status !== po.status) await tx.purchaseOrder.update({ where: { id: po.id }, data: { status } });
  }

  async cancel(id: string, remarks?: string) {
    const transport = await this.prisma.supplierTransport.findUnique({ where: { id } });
    if (!transport) throw new NotFoundException('Transport not found');
    if (transport.status === TransportStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered transport');
    }

    return this.prisma.supplierTransport.update({
      where: { id },
      data: {
        status: TransportStatus.CANCELLED,
        remarks,
      },
    });
  }
}
