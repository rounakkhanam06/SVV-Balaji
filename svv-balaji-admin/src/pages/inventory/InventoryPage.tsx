import {
  AppstoreOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Input, Row, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState, type ReactNode } from 'react';
import type { ProductStockSummary, StockStatus } from '@shared/api/types';
import { Can } from '@shared/components/Can';
import { DataTable } from '@shared/components/DataTable';
import { PageHeader } from '@shared/components/PageHeader';
import { useProductStockSummary } from '@shared/hooks/useProduction';
import { ThresholdEditModal } from './ThresholdEditModal';

const { Text } = Typography;

const STATUS: Record<StockStatus, { label: string; color: string; tag: string; bg: string }> = {
  OK: { label: 'In stock', color: '#389e0d', tag: 'success', bg: '#f6ffed' },
  LOW: { label: 'Low', color: '#d48806', tag: 'warning', bg: '#fffbe6' },
  CRITICAL: { label: 'Critical', color: '#cf1322', tag: 'error', bg: '#fff1f0' },
};

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

function KpiCard({ title, value, icon, color, bg, active, onClick }: {
  title: string; value: number; icon: ReactNode; color: string; bg: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      styles={{ body: { padding: 18 } }}
      style={{ borderColor: active ? color : undefined, boxShadow: active ? `0 0 0 1px ${color}` : undefined, height: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', fontSize: 20, flex: '0 0 44px' }}>
          {icon}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, color }}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Stock level against its two trip wires. The bar runs to 2x the reorder point
 * (or the stock, if higher); the dashed markers are safety stock (red) and
 * reorder point (amber), so "how close to reordering" reads at a glance.
 */
function StockBar({ row }: { row: ProductStockSummary }) {
  const max = Math.max(row.availableQuantity, row.reorderPoint * 2, row.safetyStock * 2, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const s = STATUS[row.status];
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 15 }}>{fmt(row.availableQuantity)}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{row.unit}</Text>
      </div>
      <Tooltip title={`Safety ${fmt(row.safetyStock)} · Reorder at ${fmt(row.reorderPoint)} ${row.unit}`}>
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: '#f0f0f0' }}>
          <div style={{ width: pct(row.availableQuantity), height: '100%', borderRadius: 4, background: s.color, transition: 'width .3s' }} />
          {row.safetyStock > 0 ? (
            <div style={{ position: 'absolute', top: -3, left: pct(row.safetyStock), height: 14, borderLeft: '2px dashed #cf1322' }} />
          ) : null}
          {row.reorderPoint > 0 ? (
            <div style={{ position: 'absolute', top: -3, left: pct(row.reorderPoint), height: 14, borderLeft: '2px dashed #d48806' }} />
          ) : null}
        </div>
      </Tooltip>
    </div>
  );
}

/**
 * Sellable finished-goods stock against each product's reorder point and
 * safety stock - the two trip wires, not the raw ledger. `/stock-movements`
 * and `/warehouse-stock` already show the ledger and per-warehouse detail for
 * whoever moves stock; this answers "what needs reordering" in one screen.
 */
export function InventoryPage() {
  const summary = useProductStockSummary();
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProductStockSummary | null>(null);

  const all = summary.data ?? [];
  const rows = useMemo(
    () =>
      all
        .filter((row) => {
          if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
          if (search && !`${row.name} ${row.sku}`.toLowerCase().includes(search.toLowerCase())) return false;
          return true;
        })
        // Most urgent first.
        .sort((a, b) => ['CRITICAL', 'LOW', 'OK'].indexOf(a.status) - ['CRITICAL', 'LOW', 'OK'].indexOf(b.status)),
    [all, statusFilter, search],
  );

  const counts = useMemo(
    () => ({
      ALL: all.length,
      OK: all.filter((r) => r.status === 'OK').length,
      LOW: all.filter((r) => r.status === 'LOW').length,
      CRITICAL: all.filter((r) => r.status === 'CRITICAL').length,
    }),
    [all],
  );

  const toggle = (s: StockStatus | 'ALL') => setStatusFilter((cur) => (cur === s ? 'ALL' : s));

  const columns: ColumnsType<ProductStockSummary> = [
    {
      title: 'Product',
      key: 'name',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: STATUS[row.status].color, flex: '0 0 4px' }} />
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ display: 'block', wordBreak: 'break-word' }}>{row.name}</Text>
            <Space size={6} wrap>
              <Tag style={{ margin: 0, fontSize: 11 }}>{row.sku}</Tag>
              {row.category ? <Text type="secondary" style={{ fontSize: 12 }}>{row.category.name}</Text> : null}
            </Space>
          </div>
        </div>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Available stock',
      key: 'available',
      width: 240,
      render: (_, row) => <StockBar row={row} />,
      sorter: (a, b) => a.availableQuantity - b.availableQuantity,
    },
    {
      title: (
        <Tooltip title="Below this the product shows as Low and should be reordered">
          <span>Reorder point</span>
        </Tooltip>
      ),
      key: 'reorderPoint',
      width: 130,
      align: 'right',
      render: (_, row) => (
        <Text>
          {fmt(row.reorderPoint)} <Text type="secondary" style={{ fontSize: 12 }}>{row.unit}</Text>
        </Text>
      ),
    },
    {
      title: (
        <Tooltip title="Below this the product is Critical">
          <span>Safety stock</span>
        </Tooltip>
      ),
      key: 'safetyStock',
      width: 130,
      align: 'right',
      render: (_, row) => (
        <Text>
          {fmt(row.safetyStock)} <Text type="secondary" style={{ fontSize: 12 }}>{row.unit}</Text>
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, row) => (
        <Space direction="vertical" size={4}>
          <Tag color={STATUS[row.status].tag} style={{ margin: 0, fontWeight: 500 }}>{STATUS[row.status].label}</Tag>
          {row.allowBackorder ? <Text type="secondary" style={{ fontSize: 11 }}>Backorder allowed</Text> : null}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, row) => (
        <Can do="PRODUCT_MANAGE">
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row)}>
            Thresholds
          </Button>
        </Can>
      ),
    },
  ];

  const toolbar = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', width: '100%' }}>
      <Segmented<StockStatus | 'ALL'>
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { label: `All (${counts.ALL})`, value: 'ALL' },
          { label: `In stock (${counts.OK})`, value: 'OK' },
          { label: `Low (${counts.LOW})`, value: 'LOW' },
          { label: `Critical (${counts.CRITICAL})`, value: 'CRITICAL' },
        ]}
      />
      <Input.Search allowClear placeholder="Search product or SKU" style={{ width: 260, maxWidth: '100%' }} onChange={(e) => setSearch(e.target.value)} />
    </div>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Inventory"
        subtitle="Sellable finished-goods stock across every warehouse, against each product's reorder point and safety stock."
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <KpiCard title="Products tracked" value={counts.ALL} icon={<AppstoreOutlined />} color="#1677ff" bg="#e6f4ff" active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard title="In stock" value={counts.OK} icon={<CheckCircleOutlined />} color={STATUS.OK.color} bg={STATUS.OK.bg} active={statusFilter === 'OK'} onClick={() => toggle('OK')} />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard title="Low - reorder soon" value={counts.LOW} icon={<ExclamationCircleOutlined />} color={STATUS.LOW.color} bg={STATUS.LOW.bg} active={statusFilter === 'LOW'} onClick={() => toggle('LOW')} />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard title="Critical" value={counts.CRITICAL} icon={<WarningOutlined />} color={STATUS.CRITICAL.color} bg={STATUS.CRITICAL.bg} active={statusFilter === 'CRITICAL'} onClick={() => toggle('CRITICAL')} />
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <DataTable<ProductStockSummary>
          rows={rows}
          columns={columns}
          rowKey="productId"
          isLoading={summary.isLoading}
          isFetching={summary.isFetching}
          error={summary.error}
          onRetry={() => void summary.refetch()}
          toolbar={toolbar}
          emptyText={statusFilter === 'ALL' && !search ? 'No active products yet' : 'No products match this filter'}
        />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 12, borderTop: '2px dashed #d48806', marginRight: 6, verticalAlign: 'middle' }} />
            Reorder point
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 12, borderTop: '2px dashed #cf1322', marginRight: 6, verticalAlign: 'middle' }} />
            Safety stock
          </Text>
        </div>
      </Card>

      <ThresholdEditModal row={editing} onClose={() => setEditing(null)} />
    </Space>
  );
}
