import { App as AntApp, Col, Form, InputNumber, Modal, Row, Typography } from 'antd';
import { apiErrorMessage } from '../../api/client';
import { WarehouseSelect } from '../../components/pickers';
import { useDeliverTransport } from '../../hooks/useTransports';
import type { SupplierTransport } from '../../../../shared/api/transports';

interface DeliverForm {
  warehouseId: string;
  receivedQuantity?: number;
  purchaseRate?: number;
}

export function DeliverTransportModal({
  open,
  onClose,
  transport,
}: {
  open: boolean;
  onClose: () => void;
  transport: SupplierTransport | null;
}) {
  const [form] = Form.useForm<DeliverForm>();
  const { message } = AntApp.useApp();
  const deliver = useDeliverTransport();

  const handleDeliver = async (values: DeliverForm) => {
    if (!transport) return;
    try {
      const res = await deliver.mutateAsync({ id: transport.id, ...values });
      message.success(
        `Received${res.receiptNumber ? ` (receipt ${res.receiptNumber})` : ''}. Raw batch ${res.batch?.batchNumber ?? ''} is in stock.`,
      );
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not complete delivery'));
    }
  };

  return (
    <Modal
      title="Confirm Delivery & Receive into Warehouse"
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      confirmLoading={deliver.isPending}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          Receiving <strong>{transport?.materialName}</strong> from{' '}
          <strong>{transport?.supplier?.fullName || 'Supplier'}</strong> (sent: {transport?.quantity} {transport?.unit}).
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          This issues a receipt, creates the raw material batch for this supplier and books it into the warehouse stock.
          Record its raw-material quality inspection as for farmer material.
        </Typography.Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          warehouseId: transport?.warehouseId || undefined,
          receivedQuantity: transport ? Number(transport.quantity) : undefined,
          purchaseRate: transport?.purchaseRate == null ? undefined : Number(transport.purchaseRate),
        }}
        onFinish={handleDeliver}
      >
        <Form.Item name="warehouseId" label="Receiving Warehouse" rules={[{ required: true, message: 'Please select a receiving warehouse' }]}>
          <WarehouseSelect placeholder="Select warehouse to deposit material" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="receivedQuantity" label={`Quantity received (${transport?.unit ?? 'KG'})`} extra="As weighed on arrival" rules={[{ required: true, message: 'Enter the quantity received' }]}>
              <InputNumber min={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="purchaseRate" label="Purchase rate (per unit)" extra="Used for production cost">
              <InputNumber min={0} step={0.5} prefix="₹" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
