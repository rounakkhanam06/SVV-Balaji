import { UploadOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Typography, Upload } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import {
  COLLECTION_PAYMENT_METHODS,
  type CollectionPaymentMethod,
} from '../../../../shared/api/collections';
import type { PaymentStatus, RawMaterialCollection } from '../../../../shared/api/types';
import { uploadsApi } from '../../../../shared/api/uploads';
import { useSetPaymentStatus } from '../../hooks/useCollections';
import { formatCurrency } from '../../utils/format';

interface Values {
  paymentMethod: CollectionPaymentMethod;
  paymentReference?: string;
  paymentDate: dayjs.Dayjs;
  paidAmount?: number;
  paymentRemarks?: string;
}

/**
 * Shown when a collection is moved to PAID or PARTIAL. Captures how the farmer
 * was paid and, for any non-cash payment, a proof file (screenshot / bank slip).
 */
export function CollectionPaymentModal({
  collection,
  status,
  onClose,
}: {
  collection: RawMaterialCollection | null;
  status: PaymentStatus | null;
  onClose: () => void;
}) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<Values>();
  const setPayment = useSetPaymentStatus();
  const [proofUrl, setProofUrl] = useState<string | undefined>();
  const [proofName, setProofName] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const method = Form.useWatch('paymentMethod', form);
  const open = !!collection && !!status;
  const partial = status === 'PARTIAL';
  const needsProof = !!method && method !== 'CASH';
  const needsRef = !!method && method !== 'CASH' && method !== 'OTHER';

  useEffect(() => {
    if (!open || !collection) return;
    form.resetFields();
    form.setFieldsValue({
      paymentMethod: (collection.paymentMethod as CollectionPaymentMethod) || undefined,
      paymentReference: collection.paymentReference || undefined,
      paymentDate: collection.paymentDate ? dayjs(collection.paymentDate) : dayjs(),
      paidAmount: partial ? (collection.paidAmount ? Number(collection.paidAmount) : undefined) : Number(collection.totalAmount),
    });
    setProofUrl(collection.paymentProofUrl || undefined);
    setProofName(collection.paymentProofUrl ? 'Existing proof' : undefined);
  }, [open, collection, partial, form]);

  const submit = async (v: Values) => {
    if (!collection || !status) return;
    if (needsProof && !proofUrl) {
      message.error('Upload the payment proof first');
      return;
    }
    try {
      await setPayment.mutateAsync({
        id: collection.id,
        paymentStatus: status,
        evidence: {
          paymentMethod: v.paymentMethod,
          paymentReference: v.paymentReference,
          paymentDate: v.paymentDate.format('YYYY-MM-DD'),
          paidAmount: v.paidAmount,
          paymentProofUrl: proofUrl,
          paymentRemarks: v.paymentRemarks,
        },
      });
      message.success(`${collection.receiptNumber} marked ${partial ? 'partially paid' : 'paid'}`);
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not update the payment'));
    }
  };

  return (
    <Modal
      open={open}
      title={`${partial ? 'Record partial payment' : 'Mark as paid'} — ${collection?.receiptNumber ?? ''}`}
      okText="Save payment"
      onOk={form.submit}
      okButtonProps={{ disabled: uploading }}
      confirmLoading={setPayment.isPending}
      onCancel={onClose}
      destroyOnClose
      width={620}
    >
      {collection ? (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <Space split="·" wrap>
              <span>{collection.farmer?.fullName}</span>
              <span>Total {formatCurrency(collection.totalAmount)}</span>
            </Space>
          }
        />
      ) : null}
      <Form form={form} layout="vertical" onFinish={submit} requiredMark>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="paymentMethod" label="Payment method" rules={[{ required: true, message: 'Select a method' }]}>
              <Select
                placeholder="How was the farmer paid?"
                options={Object.entries(COLLECTION_PAYMENT_METHODS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="paymentDate" label="Payment date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="paymentReference"
              label="UTR / Transaction ID / Cheque no."
              rules={[{ required: needsRef, message: 'Enter the reference number' }]}
            >
              <Input placeholder={method === 'CHEQUE' ? 'Cheque number' : 'e.g. 4321XXXX9876'} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="paidAmount"
              label="Amount paid"
              rules={[{ required: partial, message: 'Enter the amount paid so far' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                prefix="₹"
                min={0}
                max={collection ? Number(collection.totalAmount) : undefined}
                disabled={!partial}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="Payment proof"
          required={needsProof}
          extra={needsProof ? 'Required for UPI / bank / cheque — screenshot, bank slip or PDF.' : 'Optional for cash — e.g. signed receipt photo.'}
        >
          <Space direction="vertical">
            <Upload
              accept="image/*,application/pdf"
              maxCount={1}
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                setUploading(true);
                try {
                  const stored = await uploadsApi.upload('payment-proofs', file as File);
                  setProofUrl(stored.url);
                  setProofName((file as File).name);
                  onSuccess?.(stored);
                } catch (e) {
                  message.error(apiErrorMessage(e, 'Upload failed'));
                  onError?.(e as Error);
                } finally {
                  setUploading(false);
                }
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                {proofUrl ? 'Replace proof' : 'Upload proof'}
              </Button>
            </Upload>
            {proofUrl ? (
              <Typography.Link href={proofUrl} target="_blank" rel="noreferrer">
                {proofName ?? 'View uploaded proof'}
              </Typography.Link>
            ) : null}
          </Space>
        </Form.Item>
        <Form.Item name="paymentRemarks" label="Remarks">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
