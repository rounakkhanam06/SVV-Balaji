import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Divider, Form, Input, Radio, Row, Select, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { TRANSPORT_SOURCE_LABELS, insuranceState, type TransportSource } from '../../../shared/api/transporters';
import { useSuppliers } from '../hooks/useSuppliers';
import { useTransporters } from '../hooks/useTransporters';
import { useCan } from '../auth/useCan';
import { TransporterFormModal } from '../pages/transporters/TransporterFormModal';
import { fieldRules } from '../validation/rules';

/**
 * "Who brings it in" - one block for the supplier-delivery form and the
 * farmer-collection form, so both offer the same choices and the trip's
 * vehicle and driver are entered in exactly one place.
 *
 * Fields (in the parent Form): transportSource, transportSupplierId,
 * transporterId, vehicleNumber, driverName, driverPhone.
 *
 *   allowFarmer       - adds "Farmer's own vehicle" (collections)
 *   deliveringSupplierId - supplier deliveries: Supplier is pre-selected with
 *                       this supplier, and follows it until staff pick another
 *   optional          - collections may leave transport unrecorded
 */
export function TransportSourceFields({
  allowFarmer = false,
  deliveringSupplierId,
  optional = false,
}: {
  allowFarmer?: boolean;
  deliveringSupplierId?: string;
  optional?: boolean;
}) {
  const form = Form.useFormInstance();
  const source = Form.useWatch('transportSource', form) as TransportSource | undefined;
  const canRegister = useCan('TRANSPORTER_MANAGE');
  const [registerOpen, setRegisterOpen] = useState(false);
  const suppliers = useSuppliers();
  const transporters = useTransporters({ active: 'true' }, source === 'TRANSPORTER');

  // Supplier deliveries: keep the transport supplier in step with the delivering
  // supplier, unless staff deliberately chose a different one.
  const lastDelivering = useRef<string | undefined>(deliveringSupplierId);
  useEffect(() => {
    if (!deliveringSupplierId) return;
    const current = form.getFieldValue('transportSupplierId');
    if (!form.getFieldValue('transportSource')) form.setFieldValue('transportSource', 'SUPPLIER');
    if (!current || current === lastDelivering.current) form.setFieldValue('transportSupplierId', deliveringSupplierId);
    lastDelivering.current = deliveringSupplierId;
  }, [deliveringSupplierId, form]);

  const sources: TransportSource[] = allowFarmer ? ['SUPPLIER', 'TRANSPORTER', 'FARMER'] : ['SUPPLIER', 'TRANSPORTER'];
  const usable = (suppliers.data ?? []).filter((s) => s.status !== 'BLACKLISTED' && s.status !== 'SUSPENDED');

  return (
    <>
      <Divider orientation="left" plain style={{ marginTop: 4 }}>
        Transport
      </Divider>
      <Form.Item
        name="transportSource"
        label="Transport source"
        rules={optional ? [] : [{ required: true, message: 'Choose how the goods are transported' }]}
        extra={optional ? 'Optional - leave blank if not known.' : undefined}
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={sources.map((s) => ({ value: s, label: TRANSPORT_SOURCE_LABELS[s] }))}
          onChange={(e) => {
            const next = e.target.value as TransportSource;
            if (next !== 'SUPPLIER') form.setFieldValue('transportSupplierId', undefined);
            else if (deliveringSupplierId && !form.getFieldValue('transportSupplierId')) form.setFieldValue('transportSupplierId', deliveringSupplierId);
            if (next !== 'TRANSPORTER') form.setFieldValue('transporterId', undefined);
          }}
        />
      </Form.Item>
      {optional && source ? (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, marginTop: -16, marginBottom: 8 }}
          onClick={() => form.setFieldsValue({ transportSource: undefined, transportSupplierId: undefined, transporterId: undefined })}
        >
          Clear transport source
        </Button>
      ) : null}

      {source === 'SUPPLIER' ? (
        <Form.Item
          name="transportSupplierId"
          label="Supplier providing the vehicle"
          rules={[{ required: true, message: 'Choose the supplier' }]}
          extra={deliveringSupplierId ? 'Defaults to the supplier sending the goods.' : undefined}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={suppliers.isLoading}
            placeholder="Select from Suppliers"
            options={usable.map((s) => ({
              value: s.id,
              label: `${s.fullName}${s.supplierCode ? ` (${s.supplierCode})` : ''}${s.companyName ? ` - ${s.companyName}` : ''}`,
            }))}
          />
        </Form.Item>
      ) : null}

      {source === 'TRANSPORTER' ? (
        <Form.Item
          label="Registered transporter"
          required
          extra={
            canRegister ? (
              <Button type="link" size="small" icon={<PlusOutlined />} style={{ padding: 0 }} onClick={() => setRegisterOpen(true)}>
                Register a new transporter
              </Button>
            ) : undefined
          }
        >
          <Form.Item name="transporterId" noStyle rules={[{ required: true, message: 'Choose the transporter' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={transporters.isLoading}
              placeholder="Select from Transporters"
              notFoundContent={transporters.isLoading ? undefined : 'No active transporters - register one'}
              options={(transporters.data ?? []).map((t) => ({
                value: t.id,
                label: `${t.name} (${t.transporterCode}) · ${t.phone}`,
                insurance: insuranceState(t.insuranceValidUntil),
              }))}
              optionRender={(option) => (
                <span>
                  {option.label}
                  {option.data.insurance === 'EXPIRED' ? (
                    <Typography.Text type="danger" style={{ marginLeft: 6, fontSize: 12 }}>insurance expired</Typography.Text>
                  ) : null}
                </span>
              )}
            />
          </Form.Item>
        </Form.Item>
      ) : null}

      {source ? (
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="vehicleNumber" label="Vehicle number" normalize={(v?: string) => v?.toUpperCase()}>
              <Input placeholder="e.g. MP09AB1234" maxLength={20} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="driverName" label="Driver name">
              <Input placeholder={source === 'FARMER' ? 'Farmer or driver' : 'Driver name'} maxLength={120} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="driverPhone" label="Driver mobile" rules={fieldRules.optionalMobile}>
              <Input placeholder="10-digit mobile" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>
      ) : null}

      <TransporterFormModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        editing={null}
        onSaved={(t) => form.setFieldValue('transporterId', t.id)}
      />
    </>
  );
}

/** "Raj Roadlines (TRN-0001)" / "Agro Traders (SUP-...)" / "Farmer's own vehicle" - for tables and drawers. */
export function transportSourceText(r: {
  transportSource: TransportSource | null;
  transportSupplier?: { fullName: string; supplierCode: string | null } | null;
  transporter?: { name: string; transporterCode: string } | null;
}): string | null {
  if (!r.transportSource) return null;
  if (r.transportSource === 'TRANSPORTER' && r.transporter) return `${r.transporter.name} (${r.transporter.transporterCode})`;
  if (r.transportSource === 'SUPPLIER' && r.transportSupplier) {
    return `${r.transportSupplier.fullName}${r.transportSupplier.supplierCode ? ` (${r.transportSupplier.supplierCode})` : ''}`;
  }
  return TRANSPORT_SOURCE_LABELS[r.transportSource];
}
