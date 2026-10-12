import { Alert, App as AntApp, Form, Input, Modal, Select } from 'antd';
import { apiErrorMessage } from '../../api/client';
import type { Supplier, VerifySupplierDto } from '../../../../shared/api/suppliers';
import { useVerifySupplier } from '../../hooks/useSuppliers';

export function VerifySupplierModal({
  supplier,
  open,
  onClose,
}: {
  supplier: Supplier;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<VerifySupplierDto>();
  const { message } = AntApp.useApp();
  const verify = useVerifySupplier();
  const action = Form.useWatch('action', form) as VerifySupplierDto['action'] | undefined;
  // Same rule the server applies (supplier-readiness.ts): no approval without bank details to pay into.
  const bankGaps = [
    ['Account holder name', supplier.bankAccountName],
    ['Bank name', supplier.bankName],
    ['Account number', supplier.bankAccountNo],
    ['IFSC code', supplier.ifscCode],
  ]
    .filter(([, v]) => !v || !String(v).trim())
    .map(([label]) => label as string);
  if (supplier.ifscCode?.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(supplier.ifscCode.trim().toUpperCase())) bankGaps.push('a valid IFSC code');
  const blocked = action === 'APPROVED' && bankGaps.length > 0;

  const handleSubmit = async (values: VerifySupplierDto) => {
    try {
      await verify.mutateAsync({ id: supplier.id, data: values });
      message.success('Supplier verification logged');
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not verify'));
    }
  };

  return (
    <Modal
      title="Verify Supplier"
      open={open}
      onCancel={onClose}
      onOk={form.submit}
      okButtonProps={{ disabled: blocked }}
      confirmLoading={verify.isPending}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ action: 'APPROVED' }}
      >
        <Form.Item name="action" label="Action" rules={[{ required: true }]}>
          <Select
            options={[
              { label: 'Approve', value: 'APPROVED' },
              { label: 'Reject & Blacklist', value: 'REJECTED' },
            ]}
          />
        </Form.Item>
        {blocked ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Add bank details before approving"
            description={`Missing: ${bankGaps.join(', ')}. Edit the supplier to add them - the same rule as farmer onboarding.`}
          />
        ) : null}
        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
