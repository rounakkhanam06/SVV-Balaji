import { api } from './client';

/** Who provides the vehicle. FARMER (the farmer's own vehicle) is for farmer collections only. */
export type TransportSource = 'SUPPLIER' | 'TRANSPORTER' | 'FARMER';

export const TRANSPORT_SOURCE_LABELS: Record<TransportSource, string> = {
  SUPPLIER: 'Supplier',
  TRANSPORTER: 'Registered Transporter',
  FARMER: "Farmer's own vehicle",
};

/** The source and trip fields sent with a supplier delivery or a farmer collection. */
export interface TransportSourceInput {
  transportSource?: TransportSource;
  transportSupplierId?: string;
  transporterId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

/** What a delivery / collection read returns about who carried it. */
export interface TransportSourceView {
  transportSource: TransportSource | null;
  transportSupplierId: string | null;
  transporterId: string | null;
  transportSupplier?: { id: string; fullName: string; companyName: string | null; supplierCode: string | null } | null;
  transporter?: { id: string; name: string; transporterCode: string; phone: string } | null;
}

export interface Transporter {
  id: string;
  transporterCode: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  gstin: string | null;
  panNumber: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  /** YYYY-MM-DD (date only). */
  insuranceValidUntil: string | null;
  insuranceDocumentUrl: string | null;
  remarks: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { transports: number; collections: number };
}

export interface CreateTransporterDto {
  name: string;
  contactPerson?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  gstin?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceValidUntil?: string;
  insuranceDocumentUrl?: string;
  remarks?: string;
}

export const transportersApi = {
  list: (params?: { q?: string; active?: 'true' | 'false' }) =>
    api.get<Transporter[]>('/transporters', { params }).then((res) => res.data),
  get: (id: string) => api.get<Transporter>(`/transporters/${id}`).then((res) => res.data),
  create: (data: CreateTransporterDto) => api.post<Transporter>('/transporters', data).then((res) => res.data),
  update: (id: string, data: Partial<CreateTransporterDto>) =>
    api.patch<Transporter>(`/transporters/${id}`, data).then((res) => res.data),
  setActive: (id: string, isActive: boolean) =>
    api.patch<Transporter>(`/transporters/${id}/active`, { isActive }).then((res) => res.data),
};

/** Expired / expiring-soon flag for the insurance column. Null = no insurance recorded. */
export function insuranceState(validUntil: string | null, today = new Date()): 'VALID' | 'EXPIRING' | 'EXPIRED' | null {
  if (!validUntil) return null;
  const ymd = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const until = validUntil.slice(0, 10);
  if (until < ymd) return 'EXPIRED';
  const soon = new Date(`${ymd}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  return until <= soon.toISOString().slice(0, 10) ? 'EXPIRING' : 'VALID';
}
