import { SafetyCertificateOutlined } from '@ant-design/icons';
import { App as AntApp, Col, DatePicker, Divider, Form, Input, Modal, Row } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { apiErrorMessage } from '../../api/client';
import { FileUploadField } from '../../components/FileUploadField';
import type { CreateTransporterDto, Transporter } from '../../../../shared/api/transporters';
import { useCreateTransporter, useUpdateTransporter } from '../../hooks/useTransporters';
import { fieldRules, maxLength, required } from '../../validation/rules';

type FormValues = Omit<CreateTransporterDto, 'insuranceValidUntil'> & { insuranceValidUntil?: Dayjs | null };

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const upper = (v?: string) => v?.toUpperCase();

/**
 * Register / edit a transporter. Who they are and their (optional) insurance -
 * the vehicle and driver are entered on each trip, not here.
 */
export function TransporterFormModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transporter | null;
  /** Called with the saved transporter, e.g. so a trip form can select a just-registered one. */
  onSaved?: (t: Transporter) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { message } = AntApp.useApp();
  const create = useCreateTransporter();
  const update = useUpdateTransporter();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      form.setFieldsValue({
        ...Object.fromEntries(Object.entries(editing).map(([k, v]) => [k, v ?? undefined])),
        insuranceValidUntil: editing.insuranceValidUntil ? dayjs(editing.insuranceValidUntil.slice(0, 10)) : undefined,
      } as FormValues);
    }
  }, [open, editing, form]);

  const handleSubmit = async (values: FormValues) => {
    const clean = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]),
    ) as FormValues;
    const payload: CreateTransporterDto = {
      ...clean,
      name: clean.name,
      phone: clean.phone,
      insuranceValidUntil: values.insuranceValidUntil ? values.insuranceValidUntil.format('YYYY-MM-DD') : undefined,
    };
    try {
      const saved = editing
        ? await update.mutateAsync({ id: editing.id, data: payload })
        : await create.mutateAsync(payload);
      message.success(editing ? 'Transporter updated' : `Transporter registered - ${saved.transporterCode}`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not save the transporter'));
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${editing.transporterCode}` : 'Register Transporter'}
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okText={editing ? 'Save' : 'Register'}
      confirmLoading={create.isPending || update.isPending}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="Transporter / Company name" rules={[required('Name'), maxLength(150)]}>
              <Input placeholder="e.g. Raj Roadlines" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contactPerson" label="Contact person" rules={[maxLength(120)]}>
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="phone" label="Mobile" rules={fieldRules.mobile}>
              <Input placeholder="10-digit mobile" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="alternatePhone" label="Alternate mobile" rules={fieldRules.optionalMobile}>
              <Input placeholder="Optional" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="gstin"
              label="GSTIN"
              normalize={upper}
              rules={[{ pattern: GSTIN, message: 'GSTIN looks like 23ABCDE1234F1Z5' }]}
            >
              <Input placeholder="Optional" maxLength={15} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="panNumber" label="PAN" normalize={upper} rules={fieldRules.pan}>
              <Input placeholder="Optional" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label="Address">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="city" label="City">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="district" label="District">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="state" label="State">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="pincode" label="Pincode" rules={[{ pattern: /^\d{6}$/, message: '6 digits' }]}>
              <Input maxLength={6} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>
          <SafetyCertificateOutlined /> Insurance (optional)
        </Divider>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="insuranceProvider" label="Insurer" rules={[maxLength(120)]}>
              <Input placeholder="e.g. New India Assurance" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="insurancePolicyNumber" label="Policy number" rules={[maxLength(60)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="insuranceValidUntil" label="Valid until">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="insuranceDocumentUrl" label="Policy document">
              <FileUploadField folder="transporter-documents" hint="PDF or photo of the policy" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
