import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, RiseOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Empty, Row, Space, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EARNING_TYPE_LABEL, type RiderEarningsReport } from '@shared/api/delivery';
import { useCan } from '@shared/auth/useCan';
import { PageHeader } from '@shared/components/PageHeader';
import { useRiderEarningsReport } from '@shared/hooks/useDelivery';
import { StatCard } from '../../customers/detailPageParts';
import { AdjustmentModal } from './RiderDetailPage';
import { OutletSelect, RiderCell, inr } from './riderParts';

type Row = RiderEarningsReport['rows'][number];

/** What every rider earned in a period (default: this week), split by earning type. */
export function RiderEarningsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [outlet, setOutlet] = useState<string | undefined>();
  const q = { ...(range ? { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') } : {}), warehouseId: outlet };
  const report = useRiderEarningsReport(q);
  const canAdjust = useCan('DELIVERY_SETTINGS_MANAGE');
  const [adjust, setAdjust] = useState<Row['rider'] | null>(null);
  const navigate = useNavigate();
  const data = report.data;
  // Only the earning types that appear in this period get a column.
  const types = Object.keys(data?.byType ?? {}).sort((a, b) => Object.keys(EARNING_TYPE_LABEL).indexOf(a) - Object.keys(EARNING_TYPE_LABEL).indexOf(b));
  const period = data ? `${dayjs(data.from).format('D MMM')} – ${dayjs(data.to).subtract(1, 'minute').format('D MMM YYYY')}` : '';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Rider Earnings"
        subtitle="What each rider earned, worked out from the pay rules as deliveries finish. Adjustments add a bonus or a deduction with a reason the rider sees."
        extra={
          <Space wrap>
            <OutletSelect allowClear placeholder="All outlets" value={outlet} onChange={setOutlet} style={{ width: 180 }} />
            <DatePicker.RangePicker value={range} onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)} placeholder={['This week', 'today']}
              presets={[
                { label: 'Today', value: [dayjs(), dayjs()] },
                { label: 'Yesterday', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
                { label: 'Last 7 days', value: [dayjs().subtract(6, 'day'), dayjs()] },
                { label: 'This month', value: [dayjs().startOf('month'), dayjs()] },
                { label: 'Last month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              ]} />
          </Space>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}><StatCard icon={<RiseOutlined />} tone="blue" label="Total earned" value={inr(data?.totals.earned ?? 0)} /></Col>
        <Col xs={12} lg={6}><StatCard icon={<CheckCircleOutlined />} tone="green" label="Deliveries" value={data?.totals.deliveries ?? 0} /></Col>
        <Col xs={12} lg={6}><StatCard icon={<CloseCircleOutlined />} tone="red" label="Failed attempts" value={data?.totals.failed ?? 0} /></Col>
        <Col xs={12} lg={6}><StatCard icon={<TeamOutlined />} tone="slate" label="Riders who earned" value={data?.totals.riders ?? 0} /></Col>
        <Col xs={12} lg={8}><StatCard icon={<CheckCircleOutlined />} tone="green" label="Paid (this period)" value={inr(data?.totals.paid ?? 0)} /></Col>
        <Col xs={12} lg={8}><StatCard icon={<ClockCircleOutlined />} tone="red" label="Not paid yet (this period)" value={inr(data?.totals.unpaid ?? 0)} /></Col>
        <Col xs={24} lg={8}><StatCard icon={<WalletOutlined />} tone="blue" label="Balance due to riders (all time)" value={inr(data?.totals.balanceDue ?? 0)} /></Col>
      </Row>
      <Card className="page-card" title={<span>Per rider <Typography.Text type="secondary" style={{ fontWeight: 400 }}>{period}</Typography.Text></span>}
        extra={types.length ? <Space size={4} wrap>{types.map((t) => <Tag key={t}>{EARNING_TYPE_LABEL[t] ?? t} {inr(data!.byType[t])}</Tag>)}</Space> : null}>
        <Table<Row>
          rowKey={(r) => r.rider.id} loading={report.isLoading} dataSource={data?.rows ?? []} scroll={{ x: 1350 + types.length * 110 }} pagination={{ pageSize: 25, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No riders or earnings in this period" /> }}
          summary={() => (data?.rows.length ? (
            <Table.Summary.Row style={{ background: '#fafafa' }}>
              <Table.Summary.Cell index={0}><b>Total</b></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><b>{data.totals.deliveries}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><b>{data.totals.failed}</b></Table.Summary.Cell>
              {types.map((t, i) => <Table.Summary.Cell key={t} index={3 + i} align="right">{inr(data.byType[t])}</Table.Summary.Cell>)}
              <Table.Summary.Cell index={3 + types.length} align="right"><b>{inr(data.totals.earned)}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={4 + types.length} align="right"><b>{inr(data.totals.paid)}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={5 + types.length} />
              <Table.Summary.Cell index={6 + types.length} align="right"><b>{inr(data.totals.balanceDue)}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={7 + types.length} />
            </Table.Summary.Row>
          ) : null)}
          columns={[
            { title: 'Rider', key: 'r', fixed: 'left', width: 250, render: (_, r) => <RiderCell rider={r.rider} sub={[r.rider.code, r.rider.warehouse?.name].filter(Boolean).join(' · ')} onOpen={() => navigate(`/riders/${r.rider.id}?tab=earnings`)} /> },
            { title: 'Delivered', dataIndex: 'deliveries', align: 'right', sorter: (a, b) => a.deliveries - b.deliveries },
            { title: 'Failed', dataIndex: 'failed', align: 'right', render: (v: number) => (v ? <Typography.Text type="danger">{v}</Typography.Text> : 0) },
            ...types.map((t) => ({
              title: EARNING_TYPE_LABEL[t] ?? t, key: t, align: 'right' as const,
              render: (_: unknown, r: Row) => (r.byType[t] ? inr(r.byType[t]) : <Typography.Text type="secondary">—</Typography.Text>),
            })),
            { title: 'Total', dataIndex: 'total', align: 'right', sorter: (a, b) => a.total - b.total, defaultSortOrder: 'descend', render: (v: number) => <Typography.Text strong>{inr(v)}</Typography.Text> },
            { title: 'Paid', dataIndex: 'paid', align: 'right', render: (v: number) => (v ? inr(v) : <Typography.Text type="secondary">—</Typography.Text>) },
            {
              title: 'Status', key: 's', align: 'center',
              render: (_, r) => {
                if (r.total <= 0) return <Typography.Text type="secondary">—</Typography.Text>;
                if (r.unpaid <= 0) return <Tag color="green">Settled</Tag>;
                return r.paid > 0 ? <Tag color="orange">Part paid · {inr(r.unpaid)} due</Tag> : <Tag color="red">Unpaid</Tag>;
              },
            },
            {
              title: <Tooltip title="Everything still owed to the rider, whenever it was earned">Balance due</Tooltip>, dataIndex: 'balanceDue', align: 'right',
              sorter: (a, b) => a.balanceDue - b.balanceDue,
              render: (v: number) => (v > 0 ? <Typography.Text strong type="danger">{inr(v)}</Typography.Text> : <Typography.Text type="success">{inr(0)}</Typography.Text>),
            },
            { title: 'Last paid', dataIndex: 'lastPaidAt', render: (v: string | null) => (v ? dayjs(v).format('D MMM YYYY') : <Typography.Text type="secondary">Never</Typography.Text>) },
            {
              title: '', key: 'a', fixed: 'right', width: 190,
              render: (_, r) => (
                <Space>
                  <Button size="small" type="link" onClick={() => navigate(`/riders/${r.rider.id}?tab=earnings`)}>Lines</Button>
                  {r.balanceDue > 0 ? <Button size="small" type="primary" onClick={() => navigate(`/riders/payouts?rider=${r.rider.id}`)}>Pay</Button> : null}
                  {canAdjust ? <Button size="small" onClick={() => setAdjust(r.rider)}>Adjust</Button> : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <AdjustmentModal riderId={adjust?.id ?? null} riderName={adjust?.fullName} onClose={() => setAdjust(null)} />
    </Space>
  );
}
