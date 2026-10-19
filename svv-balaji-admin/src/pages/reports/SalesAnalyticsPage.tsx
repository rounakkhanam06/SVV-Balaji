import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CompassOutlined,
  DollarCircleOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  LineChartOutlined,
  PhoneOutlined,
  ReloadOutlined,
  RiseOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SwapOutlined,
  SyncOutlined,
  TableOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Progress,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@shared/api/client';
import { reportsApi, type ReorderRow, type ReportQuery, type SalesReport } from '@shared/api/reports';
import type { SalesChannel } from '@shared/api/types';
import { useAuth } from '@shared/auth/useAuth';
import { BranchSelect } from '@shared/components/pickers';
import {
  CohortTable,
  inr,
  Legend,
  LineChart,
  periodLabel,
  SERIES,
  StackedBarChart,
  type Series,
} from '../../components/charts';
import { ORDER_STATUS_LABEL } from '../sales/orderStatus';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const FMT = 'YYYY-MM-DD';

export const RANGE_PRESETS: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: 'Last 7 days', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: 'Last 30 days', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'This month', value: [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Last month',
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: 'Last 90 days', value: [dayjs().subtract(89, 'day'), dayjs()] },
  { label: 'This year', value: [dayjs().startOf('year'), dayjs()] },
];

type TrendKey = 'b2b' | 'b2c' | 'pos';
const TREND_SERIES: Series<TrendKey>[] = [
  { key: 'b2b', label: 'B2B Wholesale', color: SERIES.blue },
  { key: 'b2c', label: 'B2C Direct', color: SERIES.orange },
  { key: 'pos', label: 'Store POS Counter', color: SERIES.aqua },
];

const REORDER_TAG: Record<ReorderRow['state'], { color: string; label: string; bg: string; text: string }> = {
  OVERDUE: { color: 'red', label: 'Overdue', bg: '#fef2f2', text: '#dc2626' },
  DUE: { color: 'gold', label: 'Due Soon', bg: '#fffbeb', text: '#d97706' },
  ON_TRACK: { color: 'green', label: 'On Track', bg: '#ecfdf5', text: '#059669' },
  ONE_ORDER: { color: 'default', label: 'Single Order', bg: '#f8fafc', text: '#64748b' },
};

const STATUS_COLOR_MAP: Record<string, string> = {
  DELIVERED: '#16a34a',
  DISPATCHED: '#0284c7',
  PACKED: '#d97706',
  CONFIRMED: '#7c3aed',
  ALLOCATED: '#0d9488',
  PLACED: '#6366f1',
  CANCELLED: '#dc2626',
  RETURNED: '#e11d48',
  REFUNDED: '#64748b',
};

export interface KpiProps {
  label: string;
  value: ReactNode;
  change?: number | null;
  hint?: ReactNode;
  invert?: boolean;
  icon?: ReactNode;
  iconColor?: string;
  iconBg?: string;
  highlight?: boolean;
  gradientBg?: boolean;
  badge?: ReactNode;
  subvalue?: ReactNode;
  onClick?: () => void;
  actionHint?: string;
}

/**
 * Modern KPI card: high-contrast typography, themed icon badges, change capsules, interactive hover elevation, and click-through drilldown.
 * Fully backwards compatible with existing consumers (Gstr1Page, EarningsFinancePage).
 */
export function Kpi({
  label,
  value,
  change,
  hint,
  invert,
  icon,
  iconColor = '#1E5E3A',
  iconBg = '#ECFDF5',
  highlight = false,
  gradientBg = false,
  badge,
  subvalue,
  onClick,
  actionHint,
}: KpiProps) {
  const good = change != null && (invert ? change < 0 : change > 0);
  const neutral = change === 0;

  const cardContent = (
    <Card
      size="small"
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        borderRadius: 14,
        height: '100%',
        border: highlight ? '1.5px solid #10b981' : '1px solid #e2e8f0',
        background: gradientBg
          ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
          : '#ffffff',
        boxShadow: highlight
          ? '0 4px 16px rgba(16, 185, 129, 0.12)'
          : '0 2px 8px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      bodyStyle={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}
      className={`kpi-hover-card ${onClick ? 'is-clickable' : ''}`}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                lineHeight: 1.3,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{label}</span>
              {onClick ? (
                <ArrowUpOutlined
                  className="kpi-click-arrow"
                  style={{
                    fontSize: 10,
                    transform: 'rotate(45deg)',
                    color: '#94a3b8',
                    transition: 'all 0.2s',
                  }}
                />
              ) : null}
            </div>
            {badge ? <div style={{ marginTop: 4 }}>{badge}</div> : null}
          </div>

          {icon ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.25,
            marginTop: 8,
            marginBottom: 4,
            color: '#0f172a',
            letterSpacing: '-0.3px',
          }}
        >
          {value}
        </div>

        {subvalue ? <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{subvalue}</div> : null}
      </div>

      <div
        style={{
          fontSize: 12,
          marginTop: 'auto',
          paddingTop: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {change != null ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                background: neutral ? '#f1f5f9' : good ? '#ecfdf5' : '#fef2f2',
                color: neutral ? '#64748b' : good ? '#059669' : '#dc2626',
              }}
            >
              {change > 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : change < 0 ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : null}
              {Math.abs(change)}% vs prev
            </span>
          ) : hint ? (
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>
              {hint}
            </Text>
          ) : null}
        </div>

        {onClick && actionHint ? (
          <span
            className="kpi-action-hint"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#16a34a',
              letterSpacing: '0.2px',
              transition: 'all 0.2s',
            }}
          >
            {actionHint} &rarr;
          </span>
        ) : null}
      </div>
    </Card>
  );

  return actionHint ? (
    <Tooltip title={`Click to ${actionHint.toLowerCase()}`} mouseEnterDelay={0.4}>
      {cardContent}
    </Tooltip>
  ) : (
    cardContent
  );
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sales Analytics (`/reports`). Comprehensive executive sales report hooked to real database data.
 */
export function SalesAnalyticsPage() {
  const { message } = AntApp.useApp();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [range, setRange] = useState<[Dayjs, Dayjs]>(RANGE_PRESETS[1].value);
  const [channel, setChannel] = useState<'ALL' | SalesChannel>('ALL');
  const [branchId, setBranchId] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);

  const query: ReportQuery = {
    from: range[0].format(FMT),
    to: range[1].format(FMT),
    channel: channel === 'ALL' ? undefined : channel,
    branchId,
  };

  const q = useQuery({
    queryKey: ['reports', 'sales', query],
    queryFn: () => reportsApi.sales(query),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  const trendSeries = useMemo(
    () => TREND_SERIES.filter((s) => (channel === 'B2B' ? s.key === 'b2b' : channel === 'B2C' ? s.key !== 'b2b' : true)),
    [channel],
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await reportsApi.salesCsv(query), `sales-orders-${query.from}-to-${query.to}.csv`);
      message.success('Sales orders report exported successfully');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not export the orders'));
    } finally {
      setExporting(false);
    }
  };

  // Identify active preset if dates match
  const activePresetLabel = useMemo(() => {
    const f = range[0].format(FMT);
    const t = range[1].format(FMT);
    const match = RANGE_PRESETS.find((p) => p.value[0].format(FMT) === f && p.value[1].format(FMT) === t);
    return match?.label ?? null;
  }, [range]);

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1440, margin: '0 auto' }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* Top Header Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: '#1E5E3A',
                  background: '#ECFDF5',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                Executive MIS
              </span>
              <Badge status="processing" color="#16a34a" text={<span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Real-Time Data</span>} />
            </div>
            <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 700, letterSpacing: '-0.4px' }}>
              Sales & Revenue Analytics
            </Title>
            <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
              Comprehensive performance across B2B wholesale, B2C storefront, and retail POS. Figures include GST.
            </Text>
          </div>

          <Space wrap size={10}>
            <Tooltip title="Refresh data from server">
              <Button
                icon={<ReloadOutlined spin={q.isFetching} />}
                onClick={() => void q.refetch()}
                style={{ borderRadius: 8, height: 38 }}
              >
                Refresh
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={() => void exportCsv()}
              style={{
                borderRadius: 8,
                height: 38,
                background: 'linear-gradient(135deg, #1E5E3A 0%, #166534 100%)',
                borderColor: '#1E5E3A',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(30, 94, 58, 0.25)',
              }}
            >
              Export Orders (CSV)
            </Button>
          </Space>
        </div>

        {/* Filter Control Bar */}
        <Card
          size="small"
          style={{
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            background: '#ffffff',
          }}
          bodyStyle={{ padding: '14px 18px' }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              {/* Presets + Custom Range */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarOutlined /> Range:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {RANGE_PRESETS.map((p) => {
                    const active = activePresetLabel === p.label;
                    return (
                      <Button
                        key={p.label}
                        size="small"
                        type={active ? 'primary' : 'default'}
                        onClick={() => setRange(p.value)}
                        style={{
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: active ? 600 : 500,
                          background: active ? '#1E5E3A' : '#f8fafc',
                          borderColor: active ? '#1E5E3A' : '#e2e8f0',
                          color: active ? '#ffffff' : '#475569',
                          height: 28,
                          paddingInline: 10,
                        }}
                      >
                        {p.label}
                      </Button>
                    );
                  })}
                </div>
                <RangePicker
                  value={range}
                  allowClear={false}
                  disabledDate={(dt) => dt.isAfter(dayjs(), 'day')}
                  onChange={(v) => v?.[0] && v[1] && setRange([v[0], v[1]])}
                  style={{ borderRadius: 8, height: 32 }}
                />
              </div>

              {/* Channel and Branch filters */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <Segmented
                  value={channel}
                  onChange={(v) => setChannel(v as typeof channel)}
                  options={[
                    { label: 'All Channels', value: 'ALL' },
                    { label: 'B2B Wholesale', value: 'B2B' },
                    { label: 'B2C Direct', value: 'B2C' },
                  ]}
                  style={{ background: '#f1f5f9', padding: 2, borderRadius: 8 }}
                />

                {isSuperAdmin ? (
                  <div style={{ minWidth: 180 }}>
                    <BranchSelect
                      value={branchId}
                      onChange={setBranchId}
                      placeholder="All Outlets / Branches"
                      allowClear
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Comparison banner */}
            {d ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #f1f5f9',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                  <SwapOutlined style={{ color: '#16a34a' }} />
                  <span>
                    Compared with previous cycle:{' '}
                    <strong style={{ color: '#334155' }}>
                      {dayjs(d.previousRange.from).format('D MMM YYYY')} – {dayjs(d.previousRange.to).format('D MMM YYYY')}
                    </strong>{' '}
                    (same duration)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Tag color="cyan" style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>
                    {dayjs(query.to).diff(dayjs(query.from), 'day') + 1} Days Analyzed
                  </Tag>
                  {channel !== 'ALL' ? (
                    <Tag color="blue" style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>
                      Filtered: {channel}
                    </Tag>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Space>
        </Card>

        {q.isError ? <Alert type="error" showIcon message={apiErrorMessage(q.error, 'Could not load the sales analytics report')} /> : null}

        {d ? <SalesBody d={d} trendSeries={trendSeries} channel={channel} /> : q.isLoading ? <Card loading style={{ borderRadius: 14 }} /> : null}
      </Space>
    </div>
  );
}

function SectionHeading({ title, description, badge }: { title: string; description?: string; badge?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 12px' }}>
      <div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginRight: 8 }}>{title}</span>
        {description ? <span style={{ fontSize: 12, color: '#64748b' }}>{description}</span> : null}
      </div>
      {badge}
    </div>
  );
}

function SalesBody({
  d,
  trendSeries,
  channel,
}: {
  d: SalesReport;
  trendSeries: Series<TrendKey>[];
  channel: 'ALL' | SalesChannel;
}) {
  const navigate = useNavigate();
  const k = d.kpis;
  const grainWord = d.granularity === 'day' ? 'day' : d.granularity === 'week' ? 'week (from Monday)' : 'month';

  const [chartView, setChartView] = useState<'chart' | 'line' | 'table'>('chart');
  const [productSearch, setProductSearch] = useState('');
  const [reorderSearch, setReorderSearch] = useState('');
  const [reorderFilter, setReorderFilter] = useState<'ALL' | ReorderRow['state']>('ALL');

  // Peak period calculation
  const peakPeriod = useMemo(() => {
    if (!d.trend.length) return null;
    return d.trend.reduce((max, curr) => (curr.total > max.total ? curr : max), d.trend[0]);
  }, [d.trend]);

  const maxProductRevenue = useMemo(() => {
    if (!d.topProducts.length) return 1;
    return Math.max(...d.topProducts.map((p) => p.revenue), 1);
  }, [d.topProducts]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return d.topProducts;
    const q = productSearch.toLowerCase();
    return d.topProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
  }, [d.topProducts, productSearch]);

  const filteredReorder = useMemo(() => {
    if (!d.reorder?.customers) return [];
    return d.reorder.customers.filter((c) => {
      if (reorderFilter !== 'ALL' && c.state !== reorderFilter) return false;
      if (reorderSearch.trim()) {
        const q = reorderSearch.toLowerCase();
        const mName = c.name.toLowerCase().includes(q);
        const mCode = c.customerCode.toLowerCase().includes(q);
        const mPhone = c.phone.toLowerCase().includes(q);
        const mCity = c.city ? c.city.toLowerCase().includes(q) : false;
        return mName || mCode || mPhone || mCity;
      }
      return true;
    });
  }, [d.reorder?.customers, reorderFilter, reorderSearch]);

  const productColumns: ColumnsType<SalesReport['topProducts'][number]> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (_, __, idx) => {
        if (idx === 0) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FEF08A, #F59E0B)',
                color: '#78350F',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              1
            </span>
          );
        }
        if (idx === 1) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F1F5F9, #94A3B8)',
                color: '#1E293B',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              2
            </span>
          );
        }
        if (idx === 2) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFEDD5, #EA580C)',
                color: '#7C2D12',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              3
            </span>
          );
        }
        return <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{idx + 1}</span>;
      },
    },
    {
      title: 'Product',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1e293b', fontSize: 13 }}>
            {r.name}
          </Text>
          {r.sku ? (
            <Tag color="default" style={{ fontSize: 11, borderRadius: 4, margin: 0, paddingInline: 6 }}>
              {r.sku}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Units Sold',
      dataIndex: 'units',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
          {v.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      title: 'Order Lines',
      dataIndex: 'orders',
      width: 100,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
      ),
    },
    {
      title: 'Revenue Generated',
      dataIndex: 'revenue',
      width: 170,
      align: 'right',
      render: (v: number) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</div>
          <div
            style={{
              width: 100,
              height: 4,
              background: '#f1f5f9',
              borderRadius: 2,
              marginLeft: 'auto',
              marginTop: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(4, (v / maxProductRevenue) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #1E5E3A, #16A34A)',
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Share',
      dataIndex: 'share',
      width: 80,
      align: 'right',
      render: (v: number) => (
        <Tag color="blue" style={{ borderRadius: 10, fontSize: 11, fontWeight: 600, margin: 0 }}>
          {v}%
        </Tag>
      ),
    },
  ];

  const regionColumns: ColumnsType<SalesReport['byRegion'][number]> = [
    {
      title: 'State / Territory',
      dataIndex: 'state',
      render: (s: string) => {
        const isUnknown = !s || s.toLowerCase() === 'not recorded';
        const displayState = isUnknown ? 'All-India Direct / Storefront' : s;
        const code = isUnknown ? 'IN' : s.slice(0, 2).toUpperCase();
        return (
          <Space size={8}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isUnknown ? '#f1f5f9' : '#f0fdf4',
                color: isUnknown ? '#475569' : '#166534',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {code}
            </span>
            <Text strong style={{ color: '#1e293b' }}>
              {displayState}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Orders',
      dataIndex: 'orders',
      align: 'right',
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
    {
      title: 'Customers',
      dataIndex: 'customers',
      align: 'right',
      render: (v: number, r) => (r.state && v === 0 ? '—' : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>),
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</span>
      ),
    },
    {
      title: 'Contribution',
      dataIndex: 'share',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#1E5E3A', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
      ),
    },
  ];

  const reorderColumns: ColumnsType<ReorderRow> = [
    {
      title: 'Retailer Store',
      key: 'name',
      width: 250,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Link to={`/b2b-customers/${r.customerId}`} style={{ fontWeight: 600, color: '#1E5E3A', fontSize: 13 }}>
            {r.name}
          </Link>
          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{r.customerCode}</span>
            {r.city ? <span>· {r.city}</span> : null}
            <span>
              · <PhoneOutlined style={{ fontSize: 10 }} /> {r.phone}
            </span>
          </div>
        </Space>
      ),
    },
    {
      title: 'Total Orders',
      dataIndex: 'orders',
      width: 100,
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
    {
      title: 'Usual Cadence',
      dataIndex: 'avgGapDays',
      width: 110,
      align: 'right',
      render: (v: number | null) =>
        v === null ? (
          <span style={{ color: '#94a3b8' }}>—</span>
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v} days</span>
        ),
    },
    {
      title: 'Last Purchase',
      dataIndex: 'lastOrderDate',
      width: 130,
      render: (v: string, r) => (
        <Space direction="vertical" size={1}>
          <span style={{ fontSize: 12, color: '#334155' }}>{dayjs(v).format('D MMM YYYY')}</span>
          <span
            style={{
              fontSize: 11,
              color: r.daysSinceLast > 14 ? '#dc2626' : '#64748b',
              fontWeight: r.daysSinceLast > 14 ? 600 : 400,
            }}
          >
            {r.daysSinceLast} days ago
          </span>
        </Space>
      ),
    },
    {
      title: 'Expected Next Order',
      dataIndex: 'expectedNextDate',
      width: 140,
      render: (v: string | null) => {
        if (!v) return <span style={{ color: '#94a3b8' }}>—</span>;
        const isPast = dayjs(v).isBefore(dayjs(), 'day');
        return (
          <span
            style={{
              fontSize: 12,
              fontWeight: isPast ? 600 : 400,
              color: isPast ? '#dc2626' : '#1e293b',
            }}
          >
            {dayjs(v).format('D MMM YYYY')}
          </span>
        );
      },
    },
    {
      title: 'Lifetime Value (LTV)',
      dataIndex: 'lifetimeValue',
      width: 130,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</span>
      ),
    },
    {
      title: 'Cadence Status',
      dataIndex: 'state',
      width: 120,
      align: 'center',
      render: (s: ReorderRow['state']) => {
        const conf = REORDER_TAG[s];
        return (
          <Tag
            style={{
              borderRadius: 20,
              padding: '2px 10px',
              fontWeight: 600,
              fontSize: 11,
              background: conf.bg,
              color: conf.text,
              border: `1px solid ${conf.text}33`,
            }}
          >
            {conf.label}
          </Tag>
        );
      },
    },
  ];

  const trendColumns: ColumnsType<SalesReport['trend'][number]> = [
    {
      title: d.granularity === 'month' ? 'Month' : d.granularity === 'week' ? 'Week Starting' : 'Period / Date',
      dataIndex: 'period',
      render: (p: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{periodLabel(p)}</span>,
    },
    ...trendSeries.map((s) => ({
      title: s.label,
      dataIndex: s.key,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</span>,
    })),
    {
      title: 'Total Revenue',
      dataIndex: 'total',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{inr(v)}</span>
      ),
    },
    {
      title: 'Orders Count',
      dataIndex: 'orders',
      align: 'right',
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
  ];

  return (
    <>
      {/* ---------------- Financial Growth Highlights (Clickable Drilldown) ---------------- */}
      <div>
        <SectionHeading
          title="Financial Performance Highlights"
          description="Gross billed, net realization, and order economics · Click any card to drill down"
        />
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Gross Revenue (incl. GST)"
              value={inr(k.revenue)}
              change={d.changes.revenue}
              highlight
              gradientBg
              icon={<RiseOutlined />}
              iconColor="#166534"
              iconBg="#DCFCE7"
              hint="Total gross sales realized in period"
              onClick={() => navigate('/earnings')}
              actionHint="Earnings MIS"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Net Revenue (excl. GST)"
              value={inr(k.netOfTax)}
              icon={<WalletOutlined />}
              iconColor="#1D4ED8"
              iconBg="#EFF6FF"
              hint="Core revenue retained by business"
              onClick={() => navigate('/earnings')}
              actionHint="Earnings MIS"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Average Order Value"
              value={inr(k.avgOrderValue)}
              change={d.changes.avgOrderValue}
              icon={<DollarCircleOutlined />}
              iconColor="#B45309"
              iconBg="#FEF3C7"
              hint="Average ticket size per order"
              onClick={() => navigate(channel === 'B2B' ? '/b2b-orders' : '/b2c-orders')}
              actionHint="View Orders"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Gross Margin"
              value="—"
              icon={<InfoCircleOutlined />}
              iconColor="#6B21A8"
              iconBg="#F3E8FF"
              badge={
                <Tag color="purple" style={{ borderRadius: 6, fontSize: 10, margin: 0, paddingInline: 4 }}>
                  COGS Pending
                </Tag>
              }
              hint={<span title={d.margin.reason}>Needs product cost mapping (FRD34)</span>}
              onClick={() => {
                const advisoryEl = document.getElementById('margin-advisory-section');
                if (advisoryEl) {
                  advisoryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  advisoryEl.style.boxShadow = '0 0 0 3px #38bdf8';
                  setTimeout(() => {
                    advisoryEl.style.boxShadow = 'none';
                  }, 2000);
                } else {
                  navigate('/production-cost');
                }
              }}
              actionHint="Margin Details"
            />
          </Col>
        </Row>
      </div>

      {/* ---------------- Volume, Retention & Operational Health (Clickable Drilldown) ---------------- */}
      <div>
        <SectionHeading
          title="Volume, Retention & Fulfillment Health"
          description="Order throughput, repeat retention rate, and operational reliability · Click any card to drill down"
        />
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Orders & POS Sales"
              value={(k.orders + k.posSales).toLocaleString('en-IN')}
              change={d.changes.orders}
              icon={<InboxOutlined />}
              hint={`${k.orders} web orders · ${k.posSales} POS sales`}
              onClick={() => navigate(channel === 'B2B' ? '/b2b-orders' : '/b2c-orders')}
              actionHint="View Orders"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Total Units Moved"
              value={k.units.toLocaleString('en-IN')}
              change={d.changes.units}
              icon={<ShoppingOutlined />}
              hint="Item units delivered or sold"
              onClick={() => navigate('/inventory')}
              actionHint="View Inventory"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Ordering Buyers"
              value={k.customers}
              change={d.changes.customers}
              icon={<TeamOutlined />}
              hint={`${k.newCustomers} new · ${k.returningCustomers} returning`}
              onClick={() => navigate(channel === 'B2B' ? '/b2b-accounts' : '/b2c-customers')}
              actionHint="View Customers"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Customer Repeat Rate"
              value={`${k.repeatRate}%`}
              icon={<SyncOutlined />}
              hint={`${k.returningCustomers} had purchased previously`}
              onClick={() => {
                const cohortEl = document.getElementById('customer-cohorts-section');
                if (cohortEl) {
                  cohortEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  cohortEl.style.boxShadow = '0 0 0 3px #10b981';
                  setTimeout(() => {
                    cohortEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                  }, 2000);
                }
              }}
              actionHint="Cohort Heatmap"
            />
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="New Buyers Acquired"
              value={k.newCustomers}
              icon={<UserAddOutlined />}
              hint="First purchase ever in this period"
              onClick={() => navigate(channel === 'B2B' ? '/b2b-accounts' : '/b2c-customers')}
              actionHint="View Customers"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Cancelled Orders"
              value={k.cancelledOrders}
              icon={<CloseCircleOutlined />}
              iconColor="#DC2626"
              iconBg="#FEE2E2"
              hint={`${k.cancellationRate}% cancellation rate`}
              onClick={() => navigate(channel === 'B2B' ? '/b2b-orders?status=CANCELLED' : '/b2c-orders?status=CANCELLED')}
              actionHint="View Cancelled"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Return & Exchange Cases"
              value={k.returnRequests}
              change={d.changes.returnRequests}
              invert
              icon={<RollbackOutlined />}
              hint="Post-sale return requests"
              onClick={() => navigate(channel === 'B2B' ? '/returns/retailers' : '/returns/customers')}
              actionHint="View Returns"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Kpi
              label="Order Return Rate"
              value={`${k.returnRate}%`}
              icon={<SafetyCertificateOutlined />}
              iconColor="#059669"
              iconBg="#D1FAE5"
              hint="Per order sold (<2% ideal)"
              onClick={() => navigate(channel === 'B2B' ? '/returns/retailers' : '/returns/customers')}
              actionHint="View Returns"
            />
          </Col>
        </Row>
      </div>

      {/* ---------------- Revenue Trajectory Card ---------------- */}
      <Card
        id="revenue-trajectory-section"
        style={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        bodyStyle={{ padding: '20px 24px' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#ECFDF5',
                color: '#1E5E3A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <LineChartOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Revenue Trajectory & Channel Mix</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                Aggregated per {grainWord} · Showing channel trends
              </div>
            </div>
          </div>
        }
        extra={
          <Space wrap size={12}>
            {peakPeriod ? (
              <Tag color="gold" style={{ borderRadius: 12, paddingInline: 8, margin: 0 }}>
                Peak: {periodLabel(peakPeriod.period)} ({inr(peakPeriod.total)})
              </Tag>
            ) : null}
            <Segmented
              value={chartView}
              onChange={(v) => setChartView(v as typeof chartView)}
              options={[
                { label: 'Stacked Bar', value: 'chart', icon: <BarChartOutlined /> },
                { label: 'Trend Lines', value: 'line', icon: <LineChartOutlined /> },
                { label: 'Data Table', value: 'table', icon: <TableOutlined /> },
              ]}
              style={{ borderRadius: 8, background: '#f1f5f9' }}
            />
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {trendSeries.length > 1 && chartView !== 'table' ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingBottom: 4,
              }}
            >
              <Legend series={trendSeries} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Hover bars for channel breakdown and order count
              </Text>
            </div>
          ) : null}

          {chartView === 'chart' ? (
            <StackedBarChart
              data={d.trend}
              series={trendSeries}
              height={280}
              tooltipExtra={(r) => (
                <div style={{ color: '#64748b', marginTop: 4, fontSize: 11, borderTop: '1px dashed #e2e8f0', paddingTop: 4 }}>
                  {r.orders} orders placed
                </div>
              )}
            />
          ) : chartView === 'line' ? (
            <LineChart data={d.trend} series={trendSeries} height={280} />
          ) : (
            <Table
              size="small"
              rowKey="period"
              columns={trendColumns}
              dataSource={d.trend}
              pagination={false}
              scroll={{ y: 320 }}
              style={{ borderRadius: 8, overflow: 'hidden' }}
            />
          )}
        </Space>
      </Card>

      {/* ---------------- Channel Breakdown & Category Distribution ---------------- */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 14, height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            bodyStyle={{ padding: '20px 24px' }}
            title={
              <Space size={8}>
                <ShopOutlined style={{ color: '#2563EB', fontSize: 16 }} />
                <span style={{ fontWeight: 700 }}>Sales by Channel</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Distribution by revenue</Text>}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              {d.bySource.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>No sales recorded in this range</div>
              ) : (
                d.bySource.map((s, idx) => {
                  const colors = ['#2563EB', '#EA580C', '#16A34A', '#7C3AED'];
                  const color = colors[idx % colors.length];
                  const friendlyLabel =
                    s.label.toLowerCase().includes('b2b')
                      ? 'B2B Wholesale'
                      : s.label.toLowerCase().includes('b2c')
                        ? 'B2C Online Direct'
                        : s.label.toLowerCase().includes('pos')
                          ? 'Store Counter POS'
                          : s.label;
                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          <Text strong style={{ color: '#1e293b', fontSize: 13 }}>
                            {friendlyLabel}
                          </Text>
                          <Tag style={{ borderRadius: 10, fontSize: 10, margin: 0, paddingInline: 6 }}>
                            {s.orders} orders
                          </Tag>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {inr(s.revenue)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color,
                              background: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: 12,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {s.share}%
                          </span>
                        </div>
                      </div>
                      <Progress
                        percent={s.share}
                        showInfo={false}
                        strokeColor={color}
                        trailColor="#e2e8f0"
                        size={['100%', 6]}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 14, height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            bodyStyle={{ padding: '20px 24px' }}
            title={
              <Space size={8}>
                <ShoppingOutlined style={{ color: '#16A34A', fontSize: 16 }} />
                <span style={{ fontWeight: 700 }}>Sales by Category</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Product category mix</Text>}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              {d.byCategory.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>No categories sold in this range</div>
              ) : (
                d.byCategory.map((c, idx) => {
                  const catTitle =
                    !c.name || c.name.toLowerCase().includes('uncategor')
                      ? 'General / Other'
                      : c.name;
                  return (
                    <div
                      key={c.categoryId ?? `cat-${idx}`}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', minWidth: 16 }}>#{idx + 1}</span>
                          <Text strong style={{ color: '#1e293b', fontSize: 13 }}>
                            {catTitle}
                          </Text>
                          <Tag style={{ borderRadius: 10, fontSize: 10, margin: 0, paddingInline: 6 }}>
                            {c.units} units
                          </Tag>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {inr(c.revenue)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#1E5E3A',
                              background: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: 12,
                              border: '1px solid #10b98140',
                            }}
                          >
                            {c.share}%
                          </span>
                        </div>
                      </div>
                      <Progress
                        percent={c.share}
                        showInfo={false}
                        strokeColor={{
                          '0%': '#1E5E3A',
                          '100%': '#16A34A',
                        }}
                        trailColor="#e2e8f0"
                        size={['100%', 6]}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ---------------- Top Products Table ---------------- */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        bodyStyle={{ padding: '16px 20px' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ color: '#d97706', fontSize: 16 }} />
            <span style={{ fontWeight: 700 }}>Top Performing Products</span>
            <Tag color="orange" style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>
              {d.topProducts.length} items
            </Tag>
          </div>
        }
        extra={
          <Input
            placeholder="Search products by name or SKU..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            allowClear
            style={{ width: 260, borderRadius: 8 }}
          />
        }
      >
        <Table
          size="small"
          rowKey="productId"
          columns={productColumns}
          dataSource={filteredProducts}
          pagination={filteredProducts.length > 8 ? { pageSize: 8 } : false}
        />
      </Card>

      {/* ---------------- State Distribution & Order Lifecycle Mix ---------------- */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 14, height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title={
              <Space size={8}>
                <CompassOutlined style={{ color: '#1E5E3A', fontSize: 16 }} />
                <span style={{ fontWeight: 700 }}>Sales by State</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Customer billing state</Text>}
          >
            <Table
              size="small"
              rowKey="state"
              columns={regionColumns}
              dataSource={d.byRegion}
              pagination={false}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            style={{ borderRadius: 14, height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            bodyStyle={{ padding: '20px 24px' }}
            title={
              <Space size={8}>
                <InboxOutlined style={{ color: '#7C3AED', fontSize: 16 }} />
                <span style={{ fontWeight: 700 }}>Fulfillment Pipeline</span>
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Status mix</Text>}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {Object.entries(d.statusMix).length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>No orders placed in this range</div>
              ) : (
                (() => {
                  const totalOrders = Object.values(d.statusMix).reduce((acc, v) => acc + v, 0);
                  return Object.entries(d.statusMix)
                    .sort((a, b) => b[1] - a[1])
                    .map(([statusKey, count]) => {
                      const label = ORDER_STATUS_LABEL[statusKey as keyof typeof ORDER_STATUS_LABEL] ?? statusKey;
                      const color = STATUS_COLOR_MAP[statusKey] ?? '#64748b';
                      const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                      return (
                        <div
                          key={statusKey}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {count}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>({pct}%)</span>
                            </div>
                          </div>
                          <Progress
                            percent={pct}
                            showInfo={false}
                            strokeColor={color}
                            trailColor="#e2e8f0"
                            size={['100%', 5]}
                          />
                        </div>
                      );
                    });
                })()
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ---------------- B2B Reorder Intelligence Radar ---------------- */}
      {d.reorder ? (
        <Card
          id="b2b-reorder-section"
          style={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
          bodyStyle={{ padding: '20px 24px' }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined style={{ color: '#1E5E3A', fontSize: 16 }} />
              <span style={{ fontWeight: 700 }}>B2B Retailer Reorder Intelligence Radar</span>
            </div>
          }
          extra={
            <Tag color="cyan" style={{ borderRadius: 12, paddingInline: 8, fontSize: 12, margin: 0 }}>
              Median Cadence: {d.reorder.medianGapDays === null ? '—' : `${d.reorder.medianGapDays} days`}
            </Tag>
          }
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Status Breakdown:</span>
                <Tag
                  color="red"
                  style={{
                    borderRadius: 12,
                    cursor: 'pointer',
                    opacity: reorderFilter === 'OVERDUE' || reorderFilter === 'ALL' ? 1 : 0.5,
                  }}
                  onClick={() => setReorderFilter(reorderFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                >
                  Overdue: {d.reorder.counts.overdue}
                </Tag>
                <Tag
                  color="gold"
                  style={{
                    borderRadius: 12,
                    cursor: 'pointer',
                    opacity: reorderFilter === 'DUE' || reorderFilter === 'ALL' ? 1 : 0.5,
                  }}
                  onClick={() => setReorderFilter(reorderFilter === 'DUE' ? 'ALL' : 'DUE')}
                >
                  Due: {d.reorder.counts.due}
                </Tag>
                <Tag
                  color="green"
                  style={{
                    borderRadius: 12,
                    cursor: 'pointer',
                    opacity: reorderFilter === 'ON_TRACK' || reorderFilter === 'ALL' ? 1 : 0.5,
                  }}
                  onClick={() => setReorderFilter(reorderFilter === 'ON_TRACK' ? 'ALL' : 'ON_TRACK')}
                >
                  On Track: {d.reorder.counts.onTrack}
                </Tag>
                <Tag
                  style={{
                    borderRadius: 12,
                    cursor: 'pointer',
                    opacity: reorderFilter === 'ONE_ORDER' || reorderFilter === 'ALL' ? 1 : 0.5,
                  }}
                  onClick={() => setReorderFilter(reorderFilter === 'ONE_ORDER' ? 'ALL' : 'ONE_ORDER')}
                >
                  Single Order: {d.reorder.counts.oneOrder}
                </Tag>
              </div>

              <Input
                placeholder="Filter retailer by name, phone, code or city..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={reorderSearch}
                onChange={(e) => setReorderSearch(e.target.value)}
                allowClear
                style={{ width: 280, borderRadius: 8 }}
              />
            </div>

            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Tracks each retailer&apos;s ordering rhythm. Marked <b>Due</b> once they pass their customary order interval, and{' '}
              <b style={{ color: '#dc2626' }}>Overdue</b> past 1.5× their cadence — trigger point for account manager follow-up.
            </Text>

            <Table
              size="small"
              rowKey="customerId"
              columns={reorderColumns}
              dataSource={filteredReorder}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 920 }}
            />
          </Space>
        </Card>
      ) : null}

      {/* ---------------- Customer Cohort Retention Heatmap ---------------- */}
      <Card
        id="customer-cohorts-section"
        style={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        bodyStyle={{ padding: '20px 24px' }}
        title={
          <Space size={8}>
            <TeamOutlined style={{ color: '#2563EB', fontSize: 16 }} />
            <span style={{ fontWeight: 700 }}>Customer Retention Cohorts</span>
          </Space>
        }
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            % of each month&apos;s new buyers who placed subsequent orders
          </Text>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 12,
              color: '#64748b',
              background: '#f8fafc',
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            <span>Cohort index: Month 0 is initial acquisition month; +1, +2 denote consecutive months.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Heatmap intensity:</span>
              <span style={{ width: 14, height: 10, background: '#f4f8fd', borderRadius: 2 }} />
              <span style={{ width: 14, height: 10, background: '#9ec5f4', borderRadius: 2 }} />
              <span style={{ width: 14, height: 10, background: '#3987e5', borderRadius: 2 }} />
              <span style={{ width: 14, height: 10, background: '#184f95', borderRadius: 2 }} />
              <span style={{ fontSize: 11, marginLeft: 4 }}>Higher retention</span>
            </div>
          </div>
          <CohortTable rows={d.cohorts} />
        </Space>
      </Card>

      {/* ---------------- Executive Advisory Notice ---------------- */}
      <div
        id="margin-advisory-section"
        style={{
          borderRadius: 14,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <InfoCircleOutlined style={{ fontSize: 20, color: '#0284c7', marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 2 }}>
            Gross Margin Calculation Status
          </div>
          <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
            {d.margin.reason} Production batch costs are currently being finalized with the client team (FRD34 reporting roadmap).
            Once item-level landed purchase and manufacturing costs are posted, automatic gross profit margins and COGS analytics will appear here.
          </div>
        </div>
      </div>
    </>
  );
}
