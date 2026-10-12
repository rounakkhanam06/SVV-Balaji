import { api } from './client';
import { Supplier } from './suppliers';
import type { TransportSourceInput, TransportSourceView } from './transporters';

export type TransportStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface SupplierTransport extends TransportSourceView {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  purchaseOrderId: string | null;
  materialName: string;
  quantity: number;
  unit: string;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  scheduledDate: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  deliveryLocation: string | null;
  warehouseId: string | null;
  warehouse?: { id: string; name: string };
  receiptNumber: string | null;
  purchaseRate?: string | number | null;
  totalAmount?: string | number | null;
  /** The raw material batch created on delivery. */
  batch?: { id: string; batchNumber: string; status: string } | null;
  status: TransportStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransportDto extends TransportSourceInput {
  supplierId: string;
  purchaseOrderId?: string;
  materialName: string;
  quantity: number;
  unit?: string;
  /** Per unit; defaults to the PO rate when a PO is linked. */
  purchaseRate?: number;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  scheduledDate: string;
  deliveryLocation?: string;
  warehouseId?: string;
  remarks?: string;
}

export interface QueryTransportDto {
  supplierId?: string;
  transporterId?: string;
  materialName?: string;
  warehouseId?: string;
  status?: TransportStatus;
  page?: number;
  limit?: number;
}

export const transportsApi = {
  list: (params?: QueryTransportDto) => api.get<SupplierTransport[]>('/transports', { params }).then((res) => res.data),
  get: (id: string) => api.get<SupplierTransport>(`/transports/${id}`).then((res) => res.data),
  create: (data: CreateTransportDto) => api.post<SupplierTransport>('/transports', data).then((res) => res.data),
  update: (id: string, data: Partial<CreateTransportDto>) => api.patch<SupplierTransport>(`/transports/${id}`, data).then((res) => res.data),
  dispatch: (id: string) => api.patch<SupplierTransport>(`/transports/${id}/dispatch`).then((res) => res.data),
  deliver: (id: string, body: { warehouseId: string; receivedQuantity?: number; purchaseRate?: number }) =>
    api.patch<SupplierTransport>(`/transports/${id}/deliver`, body).then((res) => res.data),
  cancel: (id: string, remarks?: string) => api.patch<SupplierTransport>(`/transports/${id}/cancel`, { remarks }).then((res) => res.data),
};
