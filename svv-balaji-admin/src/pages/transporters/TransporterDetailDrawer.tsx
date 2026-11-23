import { Descriptions, Drawer, Space, Tag, Typography } from 'antd';
import { insuranceState, type Transporter } from '../../../../shared/api/transporters';
import { formatDate } from '../../utils/format';

const INSURANCE_TAG = {
  VALID: { color: 'green', text: 'Valid' },
  EXPIRING: { color: 'gold', text: 'Expires soon' },
  EXPIRED: { color: 'red', text: 'Expired' },
} as const;

const dash = (v: string | null | undefined) => (v ? v : <Typography.Text type="secondary">-</Typography.Text>);

/** Read-only view of every field recorded for one transporter. */
export function TransporterDetailDrawer({ transporter: t, onClose }: { transporter: Transporter | null; onClose: () => void }) {
  const ins = t ? insuranceState(t.insuranceValidUntil) : null;
  return (
    <Drawer
      open={!!t}
      onClose={onClose}
      width={560}
      title={
        t ? (
          <Space>
            <Typography.Text code>{t.transporterCode}</Typography.Text>
            {t.name}
            <Tag color={t.isActive ? 'green' : 'default'}>{t.isActive ? 'Active' : 'Inactive'}</Tag>
          </Space>
        ) : null
      }
    >
      {t ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions title="Contact" column={1} bordered size="small">
            <Descriptions.Item label="Contact person">{dash(t.contactPerson)}</Descriptions.Item>
            <Descriptions.Item label="Mobile">{dash(t.phone)}</Descriptions.Item>
            <Descriptions.Item label="Alternate mobile">{dash(t.alternatePhone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{dash(t.email)}</Descriptions.Item>
          </Descriptions>
          <Descriptions title="Address" column={1} bordered size="small">
            <Descriptions.Item label="Address">{dash(t.address)}</Descriptions.Item>
            <Descriptions.Item label="City">{dash(t.city)}</Descriptions.Item>
            <Descriptions.Item label="District">{dash(t.district)}</Descriptions.Item>
            <Descriptions.Item label="State">{dash(t.state)}</Descriptions.Item>
            <Descriptions.Item label="Pincode">{dash(t.pincode)}</Descriptions.Item>
          </Descriptions>
          <Descriptions title="Tax" column={1} bordered size="small">
            <Descriptions.Item label="GSTIN">{dash(t.gstin)}</Descriptions.Item>
            <Descriptions.Item label="PAN">{dash(t.panNumber)}</Descriptions.Item>
          </Descriptions>
          <Descriptions title="Insurance" column={1} bordered size="small">
            <Descriptions.Item label="Status">
              {ins ? <Tag color={INSURANCE_TAG[ins].color}>{INSURANCE_TAG[ins].text}</Tag> : dash(null)}
            </Descriptions.Item>
            <Descriptions.Item label="Provider">{dash(t.insuranceProvider)}</Descriptions.Item>
            <Descriptions.Item label="Policy number">{dash(t.insurancePolicyNumber)}</Descriptions.Item>
            <Descriptions.Item label="Valid until">{t.insuranceValidUntil ? formatDate(t.insuranceValidUntil) : dash(null)}</Descriptions.Item>
            <Descriptions.Item label="Document">
              {t.insuranceDocumentUrl ? (
                <a href={t.insuranceDocumentUrl} target="_blank" rel="noreferrer">
                  Open document
                </a>
              ) : (
                dash(null)
              )}
            </Descriptions.Item>
          </Descriptions>
          <Descriptions title="Activity" column={1} bordered size="small">
            <Descriptions.Item label="Supplier deliveries">{t._count?.transports ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Farmer collections">{t._count?.collections ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Registered on">{formatDate(t.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Last updated">{formatDate(t.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Remarks">{dash(t.remarks)}</Descriptions.Item>
          </Descriptions>
        </Space>
      ) : null}
    </Drawer>
  );
}
