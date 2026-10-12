import { PlusOutlined } from '@ant-design/icons';
import { App as AntApp, Button, Card, Input, Segmented, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import { Can } from '../../components/Can';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { RowActions } from '../../components/RowActions';
import { insuranceState, type Transporter } from '../../../../shared/api/transporters';
import { useSetTransporterActive, useTransporters } from '../../hooks/useTransporters';
import { formatDate } from '../../utils/format';
import { TransporterFormModal } from './TransporterFormModal';

const INSURANCE_TAG = {
  VALID: { color: 'green', text: 'Valid' },
  EXPIRING: { color: 'gold', text: 'Expires soon' },
  EXPIRED: { color: 'red', text: 'Expired' },
} as const;

/**
 * Transporter master - registered transporters that can be chosen as the
 * transport source on supplier deliveries and farmer collections.
 */
export function TransportersPage() {
  const { message } = AntApp.useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'true' | 'false'>('true');
  const transporters = useTransporters({ q: q || undefined, active: status === 'all' ? undefined : status });
  const setActive = useSetTransporterActive();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transporter | null>(null);

  const columns: ColumnsType<Transporter> = [
    {
      title: 'Code',
      dataIndex: 'transporterCode',
      key: 'code',
      width: 110,
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Transporter',
      key: 'name',
      render: (_, t) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{t.name}</Typography.Text>
          {t.contactPerson ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.contactPerson}</Typography.Text> : null}
        </Space>
      ),
    },
    { title: 'Mobile', dataIndex: 'phone', key: 'phone' },
    { title: 'City', key: 'city', render: (_, t) => [t.city, t.state].filter(Boolean).join(', ') || '-' },
    {
      title: 'Insurance',
      key: 'insurance',
      render: (_, t) => {
        const state = insuranceState(t.insuranceValidUntil);
        if (!state) return <Typography.Text type="secondary">Not recorded</Typography.Text>;
        return (
          <Space direction="vertical" size={0}>
            <Tag color={INSURANCE_TAG[state].color}>{INSURANCE_TAG[state].text}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t.insuranceProvider ? `${t.insuranceProvider} · ` : ''}until {formatDate(t.insuranceValidUntil)}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: 'Trips',
      key: 'trips',
      align: 'right',
      render: (_, t) => (t._count ? t._count.transports + t._count.collections : 0),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, t) => <Tag color={t.isActive ? 'green' : 'default'}>{t.isActive ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, t) => (
        <RowActions
          label={t.name}
          entity="transporter"
          can="TRANSPORTER_MANAGE"
          onEdit={() => {
            setEditing(t);
            setFormOpen(true);
          }}
          isActive={t.isActive}
          onSetActive={async (isActive) => {
            try {
              await setActive.mutateAsync({ id: t.id, isActive });
              message.success(isActive ? `${t.name} reactivated` : `${t.name} deactivated - no longer offered for new trips`);
            } catch (e) {
              message.error(apiErrorMessage(e, 'Could not change status'));
            }
          }}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Transporters"
        subtitle="Registered transporters that can carry supplier deliveries and farmer collections"
        actions={
          <Can do="TRANSPORTER_MANAGE">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Register Transporter
            </Button>
          </Can>
        }
      />
      <Card bodyStyle={{ padding: 0 }}>
        <Space style={{ padding: 16 }} wrap>
          <Input.Search allowClear placeholder="Name, code, mobile or contact" onSearch={setQ} style={{ width: 300 }} />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
              { label: 'All', value: 'all' },
            ]}
          />
        </Space>
        <DataTable<Transporter>
          rows={transporters.data}
          columns={columns}
          rowKey="id"
          isLoading={transporters.isLoading}
          error={transporters.error}
          onRetry={() => transporters.refetch()}
        />
      </Card>
      <TransporterFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </>
  );
}
