import { App as AntApp, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { apiErrorMessage } from '../../api/client';
import type { CreateTransportDto, SupplierTransport } from '../../../../shared/api/transports';
import { useCreateTransport, useUpdateTransport } from '../../hooks/useTransports';
import { useSuppliers } from '../../hooks/useSuppliers';
import { usePurchaseOrders } from '../../hooks/usePurchaseOrders';
import { WarehouseSelect } from '../../components/pickers';
import { TransportSourceFields } from '../../components/TransportSourceFields';
import type { TransportSource } from '../../../../shared/api/transporters';

interface TransportFormValues {
  supplierId: string;
  purchaseOrderId?: string;
  materialName: string;
  quantity: number;
  unit?: string;
  purchaseRate?: number;
  transportSource?: TransportSource;
  transportSupplierId?: string;
  transporterId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  scheduledDate: dayjs.Dayjs;
  deliveryLocation?: string;
  warehouseId?: string;
  remarks?: string;
}

export function TransportFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: SupplierTransport | null;
}) {
  const [form] = Form.useForm<TransportFormValues>();
  const { message } = AntApp.useApp();
  const create = useCreateTransport();
  const update = useUpdateTransport();
  const suppliers = useSuppliers();
  const supplierId = Form.useWatch('supplierId', form) as string | undefined;
  const purchaseOrders = usePurchaseOrders(supplierId ? { supplierId, limit: 100 } : undefined);
  // Only POs that can still take a delivery; keep the one already linked when editing.
  const poOptions = (supplierId ? purchaseOrders.data ?? [] : [])
    .filter(
      (po) =>
        po.supplierId === supplierId &&
        (po.status === 'CONFIRMED' || po.status === 'PARTIALLY_FULFILLED' || po.id === editing?.purchaseOrderId),
    )
    .map((po) => ({
      value: po.id,
      label: `${po.poNumber} · ${po.materialName} · ${po.expectedQuantity} ${po.unit} @ ₹${po.purchaseRate}`,
      po,
    }));

  const onPoChange = (id?: string) => {
    const po = poOptions.find((o) => o.value === id)?.po;
    if (!po) return;
    // Prefill from the PO; the user can still adjust quantity for a part delivery.
    form.setFieldsValue({
      materialName: po.materialName,
      unit: po.unit,
      quantity: form.getFieldValue('quantity') ?? Number(po.expectedQuantity),
      purchaseRate: Number(po.purchaseRate),
    });
  };

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          supplierId: editing.supplierId,
          purchaseOrderId: editing.purchaseOrderId || undefined,
          materialName: editing.materialName,
          quantity: editing.quantity,
          unit: editing.unit || 'KG',
          purchaseRate: editing.purchaseRate == null ? undefined : Number(editing.purchaseRate),
          transportSource: editing.transportSource ?? 'SUPPLIER',
          transportSupplierId: editing.transportSupplierId || undefined,
          transporterId: editing.transporterId || undefined,
          vehicleNumber: editing.vehicleNumber || undefined,
          driverName: editing.driverName || undefined,
          driverPhone: editing.driverPhone || undefined,
          scheduledDate: editing.scheduledDate ? dayjs(editing.scheduledDate) : dayjs(),
          deliveryLocation: editing.deliveryLocation || undefined,
          warehouseId: editing.warehouseId || undefined,
          remarks: editing.remarks || undefined,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          unit: 'KG',
          scheduledDate: dayjs(),
        });
      }
    }
  }, [open, editing, form]);

  const handleSubmit = async (values: TransportFormValues) => {
    try {
      const payload: CreateTransportDto = {
        supplierId: values.supplierId,
        purchaseOrderId: values.purchaseOrderId,
        materialName: values.materialName,
        quantity: Number(values.quantity),
        unit: values.unit || 'KG',
        purchaseRate: values.purchaseRate,
        transportSource: values.transportSource,
        transportSupplierId: values.transportSource === 'SUPPLIER' ? values.transportSupplierId : undefined,
        transporterId: values.transportSource === 'TRANSPORTER' ? values.transporterId : undefined,
        vehicleNumber: values.vehicleNumber,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        scheduledDate: values.scheduledDate.toISOString(),
        deliveryLocation: values.deliveryLocation,
        warehouseId: values.warehouseId,
        remarks: values.remarks,
      };

      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload });
        message.success('Transport record updated');
      } else {
        await create.mutateAsync(payload);
        message.success('Transport scheduled successfully');
      }
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not save transport'));
    }
  };

  const supplierOptions = (suppliers.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.fullName}${s.supplierCode ? ` (${s.supplierCode})` : ''}${s.companyName ? ` — ${s.companyName}` : ''}`,
  }));

  return (
    <Modal
      title={editing ? 'Edit Transport' : 'Schedule Material Transport'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      confirmLoading={create.isPending || update.isPending}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="supplierId"
              label="Supplier"
              rules={[{ required: true, message: 'Please select a supplier' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={suppliers.isLoading ? 'Loading suppliers…' : 'Select supplier'}
                loading={suppliers.isLoading}
                options={supplierOptions}
                onChange={() => form.setFieldValue('purchaseOrderId', undefined)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="scheduledDate" label="Scheduled Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="purchaseOrderId"
          label="Purchase Order (optional)"
          extra="Links this delivery to a confirmed PO. On receipt the PO moves to Partially Fulfilled / Fulfilled automatically."
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={!supplierId}
            loading={!!supplierId && purchaseOrders.isLoading}
            placeholder={supplierId ? (poOptions.length ? 'Select purchase order' : 'No open POs for this supplier') : 'Select a supplier first'}
            options={poOptions.map(({ value, label }) => ({ value, label }))}
            onChange={onPoChange}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="purchaseRate"
              label="Purchase Rate (per unit)"
              extra="Carried onto the raw batch for production cost and supplier payment. Left empty, a linked PO's rate is used."
            >
              <InputNumber style={{ width: '100%' }} min={0} step={0.5} prefix="₹" placeholder="e.g. 32.50" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="materialName"
              label="Material / Crop Name"
              rules={[{ required: true, message: 'Please enter material name' }]}
            >
              <Input placeholder="e.g. Raw Sesame, Mustard Seed" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Enter quantity' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} step={1} placeholder="Quantity" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: 'KG', value: 'KG' },
                  { label: 'QUINTAL', value: 'QUINTAL' },
                  { label: 'TONNE', value: 'TONNE' },
                  { label: 'BAGS', value: 'BAGS' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="warehouseId" label="Destination Warehouse">
              <WarehouseSelect placeholder="Select receiving warehouse" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="deliveryLocation" label="Delivery Location / Note">
              <Input placeholder="e.g. Nagpur Facility Bay 2" />
            </Form.Item>
          </Col>
        </Row>

        <TransportSourceFields deliveringSupplierId={supplierId} />

        <Form.Item name="remarks" label="Remarks / Transport Instructions">
          <Input.TextArea rows={2} placeholder="Optional delivery instructions or notes" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
