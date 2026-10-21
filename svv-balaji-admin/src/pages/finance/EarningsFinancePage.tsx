import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BankOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  MobileOutlined,
  PayCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RiseOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TableOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Input,
  Progress,
  Row,
  Segmented,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@shared/api/client';
import { AGEING_LABEL } from '@shared/api/receivables';
import { reportsApi, type FinanceChannel, type FinanceReport, type ReportQuery } from '@shared/api/reports';
import { useAuth } from '@shared/auth/useAuth';
import { PageHeader } from '@shared/components/PageHeader';
import { BranchSelect } from '@shared/components/pickers';
import { inr, Legend, LineChart, periodLabel, SERIES, ShareBars, type Series } from '../../components/charts';
import { downloadBlob, Kpi, RANGE_PRESETS } from '../reports/SalesAnalyticsPage';

dayjs.extend(relativeTime);

/** Clean Indian Rupee (₹) circular badge component */
export function RupeeCircleOutlined({
  size = 18,
  color = 'currentColor',
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        color: color,
        fontSize: Math.round(size * 0.6),
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
        userSelect: 'none',
        ...style,
      }}
    >
      ₹
    </span>
  );
}

/** Plain Indian Rupee (₹) symbol */
export function RupeeOutlined({
  size = 16,
  color = 'currentColor',
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
        userSelect: 'none',
        ...style,
      }}
    >
      ₹
    </span>
  );
}

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const REFUND_LABEL: Record<string, string> = {
  WALLET: 'Refund wallet',
  UPI: 'UPI (manual transfer)',
  BANK: 'Bank transfer (NEFT/IMPS)',
  CREDIT_NOTE: 'B2B credit note',
  UNSPECIFIED: 'Method not recorded',
};

type TrendKey = 'billed' | 'collected';
const TREND_SERIES: Series<TrendKey>[] = [
  { key: 'billed', label: 'Billed (orders placed)', color: '#2563eb' },
  { key: 'collected', label: 'Collected (money received)', color: '#16a34a' },
];

const CHANNEL_CONFIG: Record<
  string,
  { label: string; badge: string; color: string; bg: string; icon: React.ReactNode }
> = {
  B2B: {
    label: 'B2B Wholesale',
    badge: 'Wholesale & Institution',
    color: '#2563eb',
    bg: '#eff6ff',
    icon: <ShopOutlined />,
  },
  B2C: {
    label: 'B2C Direct App',
    badge: 'Retail & Quick Commerce',
    color: '#ea580c',
    bg: '#fff7ed',
    icon: <ShoppingOutlined />,
  },
  POS: {
    label: 'Store POS Counter',
    badge: 'Physical Outlet Walk-in',
    color: '#059669',
    bg: '#ecfdf5',
    icon: <RupeeCircleOutlined size={16} color="#059669" />,
  },
};

const PAYMENT_MODE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  UPI: { label: 'UPI / QR', icon: <MobileOutlined />, color: '#7c3aed', bg: '#f5f3ff' },
  BANK: { label: 'Bank Transfer', icon: <BankOutlined />, color: '#0284c7', bg: '#f0f9ff' },
  BANK_TRANSFER: { label: 'Bank Transfer', icon: <BankOutlined />, color: '#0284c7', bg: '#f0f9ff' },
  CASH: { label: 'Cash / COD', icon: <RupeeCircleOutlined size={16} color="#16a34a" />, color: '#16a34a', bg: '#f0fdf4' },
  COD: { label: 'Cash on Delivery', icon: <RupeeCircleOutlined size={16} color="#16a34a" />, color: '#16a34a', bg: '#f0fdf4' },
  ONLINE: { label: 'Online Payment Gateway', icon: <CreditCardOutlined />, color: '#2563eb', bg: '#eff6ff' },
  CREDIT_NOTE: { label: 'Credit Note', icon: <RollbackOutlined />, color: '#d97706', bg: '#fffbeb' },
  WALLET: { label: 'Refund Wallet', icon: <WalletOutlined />, color: '#0d9488', bg: '#f0fdfa' },
};

/** Client-side export helper generating a clean CSV file */
function exportFinanceCsv(d: FinanceReport, query: ReportQuery) {
  const lines: string[] = [];
  lines.push('SVV Balaji - Financial MIS & Revenue Report');
  lines.push(`Report Range: ${query.from} to ${query.to}`);
  lines.push(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
  lines.push('');
  lines.push('=== 1. EXECUTIVE TOTALS ===');
  lines.push(`Gross Billed (incl. GST),${d.totals.billed}`);
  lines.push(`GST Component,${d.totals.tax}`);
  lines.push(`Net of GST,${d.totals.netOfTax}`);
  lines.push(`Money Collected (Cash Inflow),${d.collections.total}`);
  lines.push(`Outstanding (Unpaid from range),${d.totals.outstanding}`);
  lines.push(`Total Refunds & Reversals,${d.totals.refunds}`);
  lines.push(`Net Realized Revenue,${d.totals.netRevenue}`);
  lines.push(`Total Orders & Sales,${d.totals.orders}`);
  lines.push(`Rider Delivery Pay Accrued,${d.payables.riderEarnings}`);
  lines.push(`Affiliate Commission Payable,${d.payables.affiliateCommission.amount}`);
  lines.push('');
  lines.push('=== 2. CHANNELS PERFORMANCE ===');
  lines.push('Channel,Key,Orders,Billed,GST,Net of GST,Collected,Outstanding,Discounts,Coins Redeemed,Refunds,Avg Order Value,Share %');
  d.channels.forEach((c) => {
    lines.push(
      `"${c.label}","${c.key}",${c.orders},${c.billed},${c.tax},${c.netOfTax},${c.collected},${c.outstanding},${c.discounts},${c.coinsRedeemed},${c.refunds},${c.avgOrderValue},${c.share}%`,
    );
  });
  lines.push('');
  lines.push('=== 3. COLLECTIONS BY PAYMENT METHOD ===');
  lines.push('Method,Label,Amount,Transaction Count');
  d.collections.rows.forEach((r) => {
    lines.push(`"${r.key}","${r.label}",${r.amount},${r.count}`);
  });
  lines.push('');
  lines.push('=== 4. RECENT COLLECTIONS STREAM ===');
  lines.push('Date,Source,Mode,Party,Document / Order,Reference,Amount');
  d.recentCollections.forEach((r) => {
    lines.push(
      `"${dayjs(r.at).format('YYYY-MM-DD HH:mm:ss')}","${r.source}","${r.mode}","${r.party ?? ''}","${r.document ?? ''}","${r.reference ?? ''}",${r.amount}`,
    );
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `financial-mis-${query.from}-to-${query.to}.csv`);
}

/**
 * Earnings & Financial MIS (`/earnings`).
 * Modern executive financial dashboard covering revenue recognition, cash inflows,
 * collection efficiency, statutory GST reconciliation, and working capital MIS.
 */
export function EarningsFinancePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [activePresetIndex, setActivePresetIndex] = useState<number>(2); // 'This month'
  const [range, setRange] = useState<[Dayjs, Dayjs]>(RANGE_PRESETS[2].value);
  const [branchId, setBranchId] = useState<string | undefined>();

  const query: ReportQuery = {
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
    branchId,
  };

  const q = useQuery({
    queryKey: ['reports', 'finance', query],
    queryFn: () => reportsApi.finance(query),
    placeholderData: keepPreviousData,
  });

  const handlePresetChange = (index: number) => {
    setActivePresetIndex(index);
    setRange(RANGE_PRESETS[index].value);
  };

  const handleCustomRange = (val: [Dayjs | null, Dayjs | null] | null) => {
    if (val?.[0] && val[1]) {
      setActivePresetIndex(-1);
      setRange([val[0], val[1]]);
    }
  };

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1440, margin: '0 auto' }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* Modern Executive Page Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #1e5e3a 0%, #166534 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
                  boxShadow: '0 8px 16px rgba(22, 101, 52, 0.25)',
                }}
              >
                ₹
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                    Earnings & Financial MIS
                  </Title>
                  <Tag
                    color="success"
                    style={{
                      borderRadius: 20,
                      fontWeight: 600,
                      padding: '2px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: '#16a34a',
                        display: 'inline-block',
                      }}
                    />
                    Live Accounting
                  </Tag>
                  <Tag
                    color="blue"
                    style={{ borderRadius: 20, fontWeight: 500, padding: '2px 8px' }}
                  >
                    Accrual & Cash Basis
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
                  Comprehensive revenue realization, payment reconciliation, GST statutory metrics, and working capital ledger.
                </Text>
              </div>
            </div>

            {/* Quick Actions */}
            <Space wrap size={10}>
              <Button
                icon={<FileExcelOutlined />}
                disabled={!q.data}
                onClick={() => q.data && exportFinanceCsv(q.data, query)}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                Export MIS (.csv)
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                Print View
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined spin={q.isFetching} />}
                onClick={() => void q.refetch()}
                loading={q.isFetching}
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  backgroundColor: '#166534',
                  borderColor: '#166534',
                  boxShadow: '0 2px 8px rgba(22, 101, 52, 0.2)',
                }}
              >
                Refresh
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Quick Date Presets & Filters Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Period:
              </Text>
              <Space wrap size={6}>
                {RANGE_PRESETS.map((p, idx) => {
                  const active = activePresetIndex === idx;
                  return (
                    <Button
                      key={p.label}
                      size="small"
                      type={active ? 'primary' : 'default'}
                      onClick={() => handlePresetChange(idx)}
                      style={{
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        backgroundColor: active ? '#166534' : '#ffffff',
                        borderColor: active ? '#166534' : '#cbd5e1',
                        color: active ? '#ffffff' : '#334155',
                      }}
                    >
                      {p.label}
                    </Button>
                  );
                })}
              </Space>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <RangePicker
                size="small"
                value={range}
                allowClear={false}
                disabledDate={(dt) => dt.isAfter(dayjs(), 'day')}
                onChange={(v) => handleCustomRange(v as [Dayjs | null, Dayjs | null])}
                style={{ borderRadius: 8, padding: '4px 10px' }}
              />
              {isSuperAdmin ? (
                <div style={{ width: 200 }}>
                  <BranchSelect
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="All branches"
                    allowClear
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {q.isError ? (
          <Alert
            type="error"
            showIcon
            message={apiErrorMessage(q.error, 'Could not load the financial MIS report')}
            style={{ borderRadius: 12 }}
          />
        ) : null}

        {q.data ? (
          <FinanceBody d={q.data} query={query} />
        ) : q.isLoading ? (
          <Card
            loading
            style={{ borderRadius: 16, height: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
          />
        ) : null}
      </Space>
    </div>
  );
}

function FinanceBody({ d, query }: { d: FinanceReport; query: ReportQuery }) {
  const navigate = useNavigate();
  const t = d.totals;
  const [trendView, setTrendView] = useState<'chart' | 'table'>('chart');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [collectionSearch, setCollectionSearch] = useState<string>('');

  // Key Financial Ratios
  const collectionRate = t.billed > 0 ? Math.min(100, (d.collections.total / t.billed) * 100) : 0;
  const netRealizationRate = t.billed > 0 ? ((t.netRevenue / t.billed) * 100) : 0;
  const refundRatio = t.billed > 0 ? ((t.refunds / t.billed) * 100) : 0;
  const gstRatio = t.billed > 0 ? ((t.tax / t.billed) * 100) : 0;

  // Filtered Recent Collections
  const filteredCollections = useMemo(() => {
    return d.recentCollections.filter((r) => {
      if (collectionFilter !== 'ALL' && r.source !== collectionFilter) return false;
      if (!collectionSearch.trim()) return true;
      const q = collectionSearch.toLowerCase();
      return (
        (r.party && r.party.toLowerCase().includes(q)) ||
        (r.document && r.document.toLowerCase().includes(q)) ||
        (r.reference && r.reference.toLowerCase().includes(q)) ||
        (r.mode && r.mode.toLowerCase().includes(q))
      );
    });
  }, [d.recentCollections, collectionFilter, collectionSearch]);

  // Channel Table Columns
  const channelColumns: ColumnsType<FinanceChannel> = [
    {
      title: 'Channel',
      dataIndex: 'label',
      fixed: 'left',
      width: 220,
      render: (v: string, r) => {
        const conf = CHANNEL_CONFIG[r.key] ?? {
          color: '#64748b',
          bg: '#f8fafc',
          icon: <ShopOutlined />,
          badge: 'Channel',
        };
        return (
          <Space direction="vertical" size={2}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: conf.bg,
                  color: conf.color,
                  fontSize: 13,
                }}
              >
                {conf.icon}
              </span>
              <Text strong style={{ color: '#0f172a' }}>
                {v}
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 32 }}>
              <Tag color="default" style={{ margin: 0, fontSize: 11, borderRadius: 10 }}>
                {r.orders} {r.key === 'POS' ? 'sales' : 'orders'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.share}% of total billing
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Gross Billed',
      dataIndex: 'billed',
      align: 'right',
      render: (v: number) => <Text strong style={{ color: '#0f172a' }}>{inr(v)}</Text>,
    },
    {
      title: 'Net of GST',
      dataIndex: 'netOfTax',
      align: 'right',
      render: inr,
    },
    {
      title: 'GST Component',
      dataIndex: 'tax',
      align: 'right',
      render: (v: number) => <Text type="secondary">{inr(v)}</Text>,
    },
    {
      title: 'Paid / Realized',
      dataIndex: 'collected',
      align: 'right',
      render: (v: number, r) => {
        const rate = r.billed > 0 ? Math.min(100, Math.round((v / r.billed) * 100)) : 0;
        return (
          <div>
            <Text strong style={{ color: '#16a34a' }}>
              {inr(v)}
            </Text>
            <div style={{ width: 100, marginLeft: 'auto', marginTop: 3 }}>
              <Progress
                percent={rate}
                size="small"
                showInfo={false}
                strokeColor="#16a34a"
                trailColor="#f1f5f9"
              />
              <span style={{ fontSize: 10, color: '#64748b' }}>{rate}% paid</span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Unpaid / Pending',
      dataIndex: 'outstanding',
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <Tag color="warning" style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
            {inr(v)}
          </Tag>
        ) : (
          <Text type="secondary">{inr(v)}</Text>
        ),
    },
    {
      title: 'Discounts',
      dataIndex: 'discounts',
      align: 'right',
      render: inr,
    },
    {
      title: 'Coins Redeemed',
      dataIndex: 'coinsRedeemed',
      align: 'right',
      render: inr,
    },
    {
      title: 'Refunded',
      dataIndex: 'refunds',
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <Tag color="error" style={{ borderRadius: 6, margin: 0 }}>
            {inr(v)}
          </Tag>
        ) : (
          <Text type="secondary">{inr(v)}</Text>
        ),
    },
    {
      title: 'Avg Order Value',
      dataIndex: 'avgOrderValue',
      align: 'right',
      render: inr,
    },
  ];

  // Recent Collections Table Columns
  const recentColumns: ColumnsType<FinanceReport['recentCollections'][number]> = [
    {
      title: 'Timestamp',
      dataIndex: 'at',
      width: 170,
      render: (v: string) => {
        const d = dayjs(v);
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>{d.format('D MMM YYYY, HH:mm')}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {d.fromNow()}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Channel & Method',
      dataIndex: 'source',
      width: 200,
      render: (v: string, r) => {
        const m = PAYMENT_MODE_CONFIG[r.mode] ?? {
          label: r.mode,
          icon: <RupeeCircleOutlined size={16} color="#64748b" />,
          color: '#64748b',
          bg: '#f1f5f9',
        };
        const sourceColor =
          v === 'ONLINE' ? 'blue' : v === 'COD' ? 'orange' : v === 'POS' ? 'green' : 'purple';
        return (
          <Space size={6} wrap>
            <Tag color={sourceColor} style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>
              {v}
            </Tag>
            <Tag
              style={{
                borderRadius: 6,
                backgroundColor: m.bg,
                color: m.color,
                borderColor: 'transparent',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                margin: 0,
              }}
            >
              {m.icon}
              {m.label}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'From / Party',
      dataIndex: 'party',
      render: (v: string | null) =>
        v ? (
          <Space size={6}>
            <UserOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text strong style={{ fontSize: 13 }}>
              {v}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Order / Receipt',
      dataIndex: 'document',
      render: (v: string | null) =>
        v ? (
          <Tag color="default" style={{ borderRadius: 6, fontWeight: 500 }}>
            {v}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Transaction Ref',
      dataIndex: 'reference',
      render: (v: string | null) =>
        v ? (
          <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {v}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Amount Received',
      dataIndex: 'amount',
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#16a34a', fontSize: 14 }}>
          {inr(v)}
        </Text>
      ),
    },
  ];

  return (
    <>
      {/* 1. Executive Top Metric Cards */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Gross Invoiced"
            value={inr(t.billed)}
            hint={`${t.orders} orders & counter sales`}
            icon={<RupeeCircleOutlined size={22} color="#2563eb" />}
            iconColor="#2563eb"
            iconBg="#eff6ff"
            subvalue={`Taxable ${inr(t.netOfTax)}`}
            badge="Sales Volume"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Money Collected"
            value={inr(d.collections.total)}
            hint="Cash basis from all sources"
            icon={<WalletOutlined />}
            iconColor="#166534"
            iconBg="#f0fdf4"
            highlight
            subvalue={`${collectionRate.toFixed(1)}% of gross billed`}
            badge="Cash Inflow"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Net Realized Revenue"
            value={inr(t.netRevenue)}
            hint={`After GST & ${inr(t.refunds)} refunds`}
            icon={<RiseOutlined />}
            iconColor="#059669"
            iconBg="#ecfdf5"
            gradientBg
            subvalue={`${netRealizationRate.toFixed(1)}% realization`}
            badge="Bottomline"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Uncollected / Pending"
            value={inr(t.outstanding)}
            hint="Billed in range, not yet paid"
            icon={<ClockCircleOutlined />}
            iconColor="#d97706"
            iconBg="#fffbeb"
            subvalue={t.outstanding > 0 ? 'Requires follow-up' : 'All clear'}
            badge={t.outstanding > 0 ? 'Credit / COD' : 'Fully Settled'}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Total Refunds"
            value={inr(t.refunds)}
            hint={`${d.refunds.returns.count + d.refunds.undelivered.count + d.refunds.posRefunds.count} reversals issued`}
            icon={<RollbackOutlined />}
            iconColor="#e11d48"
            iconBg="#fff1f2"
            invert
            subvalue={`${refundRatio.toFixed(1)}% reversal rate`}
            badge="Reverse Logistics"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Kpi
            label="Rider Delivery Pay"
            value={inr(d.payables.riderEarnings)}
            hint="Fleet pay earned in range"
            icon={<CarOutlined />}
            iconColor="#7c3aed"
            iconBg="#f5f3ff"
            onClick={() => navigate('/riders/earnings')}
            actionHint="View Rider Earnings"
            subvalue="Accrued per order"
            badge="Payable"
          />
        </Col>
      </Row>

      {/* 2. Financial Velocity & Cashflow Realization Flow Bar */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
              Cash Realization & Collection Efficiency
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Progress of converting gross invoiced orders into cash receipts during this period
            </Text>
          </div>
          <Space size={14}>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Collection Efficiency
              </Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                {collectionRate.toFixed(1)}%
              </div>
            </div>
            <Divider type="vertical" style={{ height: 32 }} />
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Net Retention
              </Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>
                {netRealizationRate.toFixed(1)}%
              </div>
            </div>
          </Space>
        </div>

        {/* Multi-tier Progress Bar */}
        <Progress
          percent={collectionRate}
          strokeColor={{
            '0%': '#10b981',
            '100%': '#16a34a',
          }}
          trailColor="#f1f5f9"
          strokeWidth={12}
          style={{ borderRadius: 8 }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#16a34a' }} />
              Collected: <strong>{inr(d.collections.total)}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#d97706' }} />
              Pending / Credit: <strong>{inr(t.outstanding)}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#dc2626' }} />
              Refunds: <strong>{inr(t.refunds)}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#64748b' }} />
              GST Component: <strong>{inr(t.tax)}</strong>
            </span>
          </div>

          <Tag color="cyan" style={{ borderRadius: 12, fontWeight: 500 }}>
            {t.orders} total sales transactions across all outlets
          </Tag>
        </div>
      </Card>

      {/* 3. Sales Channel Performance Matrix */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ color: '#2563eb' }} />
            <span>Channel Performance Matrix</span>
          </div>
        }
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Revenue, GST, collections, and discounts partitioned by channel
          </Text>
        }
      >
        <Table
          size="middle"
          rowKey="key"
          columns={channelColumns}
          dataSource={d.channels}
          pagination={false}
          scroll={{ x: 1200 }}
          summary={() => (
            <Table.Summary.Row
              style={{
                backgroundColor: '#f8fafc',
                fontWeight: 600,
                borderTop: '2px solid #cbd5e1',
              }}
            >
              <Table.Summary.Cell index={0}>
                <Text strong style={{ fontSize: 14 }}>
                  Total Aggregate
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                  {inr(t.billed)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                {inr(t.netOfTax)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text type="secondary">{inr(t.tax)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong style={{ color: '#16a34a' }}>
                  {inr(t.collected)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ color: t.outstanding > 0 ? '#d97706' : '#64748b' }}>
                  {inr(t.outstanding)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={3} />
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          )}
        />
      </Card>

      {/* 4. Trend Analysis: Billed vs Collected Over Time */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LineChartOutlined style={{ color: '#16a34a' }} />
            <span>Billed vs Collected Trend Analysis</span>
          </div>
        }
        extra={
          <Space size={12}>
            <Legend series={TREND_SERIES} />
            <Segmented
              size="small"
              value={trendView}
              onChange={(v) => setTrendView(v as 'chart' | 'table')}
              options={[
                { label: 'Chart View', value: 'chart', icon: <LineChartOutlined /> },
                { label: 'Ledger Table', value: 'table', icon: <TableOutlined /> },
              ]}
              style={{ borderRadius: 8 }}
            />
          </Space>
        }
      >
        {trendView === 'chart' ? (
          <div style={{ padding: '8px 4px' }}>
            <LineChart data={d.trend} series={TREND_SERIES} />
          </div>
        ) : (
          <Table
            size="small"
            rowKey="period"
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={d.trend}
            columns={[
              { title: 'Period', dataIndex: 'period', render: periodLabel },
              {
                title: 'Billed (Sales)',
                dataIndex: 'billed',
                align: 'right',
                render: (v: number) => <Text strong>{inr(v)}</Text>,
              },
              {
                title: 'Collected (Inflow)',
                dataIndex: 'collected',
                align: 'right',
                render: (v: number) => (
                  <Text strong style={{ color: '#16a34a' }}>
                    {inr(v)}
                  </Text>
                ),
              },
              {
                title: 'Variance / Gap',
                key: 'gap',
                align: 'right',
                render: (_, r) => {
                  const diff = r.billed - r.collected;
                  return diff > 0 ? (
                    <Text type="warning">+{inr(diff)}</Text>
                  ) : (
                    <Text type="secondary">{inr(diff)}</Text>
                  );
                },
              },
              {
                title: 'Collection Rate',
                key: 'rate',
                align: 'right',
                render: (_, r) => {
                  const pct = r.billed > 0 ? Math.round((r.collected / r.billed) * 100) : 100;
                  return (
                    <Tag
                      color={pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'error'}
                      style={{ borderRadius: 10, fontWeight: 600 }}
                    >
                      {pct}%
                    </Tag>
                  );
                },
              },
            ]}
          />
        )}
      </Card>

      {/* 5. Inflow Breakdown & Refunds Grid */}
      <Row gutter={[16, 16]}>
        {/* Payment Methods Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 16,
              height: '100%',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
              border: '1px solid #e2e8f0',
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PayCircleOutlined style={{ color: '#ea580c' }} />
                <span>Collections by Payment Mode</span>
              </div>
            }
            extra={
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Total Received</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
                  {inr(d.collections.total)}
                </div>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {d.collections.rows.map((row) => {
                const conf = PAYMENT_MODE_CONFIG[row.key] ?? {
                  label: row.label,
                  icon: <RupeeCircleOutlined size={16} color="#64748b" />,
                  color: '#64748b',
                  bg: '#f8fafc',
                };
                const pct = d.collections.total > 0 ? (row.amount / d.collections.total) * 100 : 0;
                return (
                  <div
                    key={row.key}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #edf2f7',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: conf.bg,
                            color: conf.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                          }}
                        >
                          {conf.icon}
                        </span>
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {row.label}
                          </Text>
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                            {row.count} payments
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                          {inr(row.amount)}
                        </Text>
                        <Tag
                          style={{
                            borderRadius: 10,
                            marginLeft: 8,
                            fontSize: 11,
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {pct.toFixed(1)}%
                        </Tag>
                      </div>
                    </div>
                    <Progress
                      percent={pct}
                      size="small"
                      showInfo={false}
                      strokeColor={conf.color}
                      trailColor="#e2e8f0"
                    />
                  </div>
                );
              })}

              {d.collections.refundWalletUsed > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  icon={<WalletOutlined />}
                  message={
                    <span>
                      Customer Refund Wallet: <strong>{inr(d.collections.refundWalletUsed)}</strong> was
                      redeemed to pay for orders (internal store credit, not new banking inflow).
                    </span>
                  }
                  style={{ borderRadius: 10, marginTop: 4 }}
                />
              ) : null}
            </div>
          </Card>
        </Col>

        {/* Refunds & Reverse Logistics Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 16,
              height: '100%',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
              border: '1px solid #e2e8f0',
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RollbackOutlined style={{ color: '#e11d48' }} />
                <span>Refunds & Reverse Logistics</span>
              </div>
            }
            extra={
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Total Reversed</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e11d48' }}>
                  {inr(d.refunds.total)}
                </div>
              </div>
            }
          >
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    backgroundColor: '#fff1f2',
                    border: '1px solid #ffe4e6',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Customer Returns
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#e11d48', marginTop: 2 }}>
                    {d.refunds.returns.count} orders
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Processed return claims
                  </Text>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Undelivered Orders
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706', marginTop: 2 }}>
                    {inr(d.refunds.undelivered.amount)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {d.refunds.undelivered.count} orders auto-refunded
                  </Text>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    POS Bill Voids
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#475569', marginTop: 2 }}>
                    {inr(d.refunds.posRefunds.amount)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {d.refunds.posRefunds.count} counter bills cancelled
                  </Text>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                  Settlement Method of Customer Returns:
                </Text>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(d.refunds.returns.byMethod).length > 0 ? (
                    Object.entries(d.refunds.returns.byMethod).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #edf2f7',
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{REFUND_LABEL[k] ?? k}</span>
                        <Text strong style={{ color: '#e11d48' }}>
                          {inr(v)}
                        </Text>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      No customer return refunds issued in this period.
                    </Text>
                  )}
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 6. Statutory GST Compliance Center */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: '#2563eb' }} />
            <span>GST Statutory Liability & Reconciliation</span>
          </div>
        }
        extra={
          <Space size={12}>
            <Link to="/invoices">
              <Button size="small" type="link">
                Tax Invoices →
              </Button>
            </Link>
            <Link to="/gst-returns">
              <Button size="small" type="link">
                GSTR-1 Portal →
              </Button>
            </Link>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={15}>
            {/* 4 Tax Metric Capsules */}
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={6}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Net Taxable Value
                  </Text>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {inr(d.gst.netTaxable)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {d.gst.invoices} invoices
                  </Text>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #dbeafe',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', color: '#1d4ed8' }}>
                    CGST (Central)
                  </Text>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1e40af', marginTop: 2 }}>
                    {inr(d.gst.netCgst)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Intra-state
                  </Text>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #dbeafe',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', color: '#1d4ed8' }}>
                    SGST (State)
                  </Text>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1e40af', marginTop: 2 }}>
                    {inr(d.gst.netSgst)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Intra-state
                  </Text>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ede9fe',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', color: '#6d28d9' }}>
                    IGST (Inter-state)
                  </Text>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#5b21b6', marginTop: 2 }}>
                    {inr(d.gst.netIgst)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Integrated
                  </Text>
                </div>
              </Col>
            </Row>

            {d.gst.creditNotes.count ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12, borderRadius: 10 }}
                message={
                  <span>
                    Net of <strong>{d.gst.creditNotes.count} credit notes</strong> adjusting{' '}
                    <strong>{inr(d.gst.creditNotes.taxable)}</strong> taxable value and{' '}
                    <strong>{inr(d.gst.creditNotes.tax)}</strong> GST. (Gross invoices without credit notes:{' '}
                    {inr(d.gst.taxable)} taxable, {inr(d.gst.tax)} GST).
                  </span>
                }
              />
            ) : null}

            {/* GST Rate-wise table */}
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 13 }}>
                Rate-wise Tax Slab Breakdown:
              </Text>
              <Table
                style={{ marginTop: 8 }}
                size="small"
                rowKey="rate"
                pagination={false}
                dataSource={d.gst.byRate}
                locale={{ emptyText: 'No taxable invoices issued in this period' }}
                columns={[
                  {
                    title: 'GST Slab',
                    dataIndex: 'rate',
                    render: (v: number) => (
                      <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 600 }}>
                        {v}% GST
                      </Tag>
                    ),
                  },
                  {
                    title: 'Taxable Turnover',
                    dataIndex: 'taxable',
                    align: 'right',
                    render: (v: number) => <Text strong>{inr(v)}</Text>,
                  },
                  {
                    title: 'Tax Accrued',
                    dataIndex: 'tax',
                    align: 'right',
                    render: (v: number) => <Text style={{ color: '#0f172a' }}>{inr(v)}</Text>,
                  },
                  {
                    title: 'Effective Tax Share',
                    key: 'share',
                    align: 'right',
                    render: (_, r) => {
                      const share = d.gst.tax > 0 ? Math.round((r.tax / d.gst.tax) * 100) : 0;
                      return (
                        <div style={{ width: 80, marginLeft: 'auto' }}>
                          <Progress percent={share} size="small" strokeColor="#2563eb" trailColor="#f1f5f9" />
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
          </Col>

          {/* Compliance & E-Invoice Status */}
          <Col xs={24} lg={9}>
            <div
              style={{
                height: '100%',
                padding: '16px',
                borderRadius: 14,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                  Statutory Compliance Status
                </Text>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 10,
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 13 }}>
                        B2B Invoices (Registered)
                      </Text>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {d.gst.bySupply.B2B.invoices} invoices issued
                      </div>
                    </div>
                    <Text strong style={{ color: '#2563eb' }}>
                      Tax {inr(d.gst.bySupply.B2B.tax)}
                    </Text>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 10,
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 13 }}>
                        B2C Invoices (Retail/App)
                      </Text>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {d.gst.bySupply.B2C.invoices} invoices issued
                      </div>
                    </div>
                    <Text strong style={{ color: '#ea580c' }}>
                      Tax {inr(d.gst.bySupply.B2C.tax)}
                    </Text>
                  </div>
                </div>

                <Divider style={{ margin: '14px 0' }} />

                <Text strong style={{ fontSize: 13 }}>
                  e-Invoice & IRN Clearance:
                </Text>
                <Space wrap style={{ marginTop: 8 }}>
                  <Tag color="success" style={{ borderRadius: 6, fontWeight: 500 }}>
                    IRN Generated: {d.gst.eInvoice.generated}
                  </Tag>
                  {d.gst.eInvoice.pending > 0 ? (
                    <Tag color="gold" style={{ borderRadius: 6, fontWeight: 600 }}>
                      IRN Pending: {d.gst.eInvoice.pending}
                    </Tag>
                  ) : null}
                  {d.gst.eInvoice.failed > 0 ? (
                    <Tag color="error" style={{ borderRadius: 6, fontWeight: 600 }}>
                      IRN Failed: {d.gst.eInvoice.failed}
                    </Tag>
                  ) : null}
                  {d.gst.cancelled > 0 ? (
                    <Tag color="default" style={{ borderRadius: 6 }}>
                      {d.gst.cancelled} Invoices Cancelled
                    </Tag>
                  ) : null}
                </Space>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Net statutory GST liability for the filing cycle:{' '}
                  <strong style={{ color: '#0f172a' }}>{inr(d.gst.netTax)}</strong>
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 7. Working Capital: Receivables & Payables Hub */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: '#0d9488' }} />
            <span>Working Capital, Credit Ageing & Payables</span>
          </div>
        }
      >
        <Tabs
          defaultActiveKey="receivables"
          items={[
            {
              key: 'receivables',
              label: (
                <span>
                  B2B Trade Debtors & Receivables{' '}
                  <Tag color="warning" style={{ borderRadius: 10, marginLeft: 4 }}>
                    {inr(d.receivables?.outstanding ?? 0)}
                  </Tag>
                </span>
              ),
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {/* Summary Bar */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: 12,
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fef3c7',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        Total Outstanding Debt
                      </Text>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706', marginTop: 2 }}>
                        {inr(d.receivables?.outstanding ?? 0)}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {d.receivables?.debtors ?? 0} active credit clients
                      </Text>
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        borderRadius: 12,
                        backgroundColor: '#fff1f2',
                        border: '1px solid #ffe4e6',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        Overdue Portion
                      </Text>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#e11d48', marginTop: 2 }}>
                        {inr(d.receivables?.overdue ?? 0)}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Past agreed payment terms
                      </Text>
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        borderRadius: 12,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        Credit Period Start
                      </Text>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                        {d.receivables?.creditPeriodStart === 'DISPATCH' ? 'From Dispatch Date' : 'From Order Date'}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Standardized terms
                      </Text>
                    </div>
                  </div>

                  {/* Ageing Buckets */}
                  {d.receivables?.ageing ? (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>
                        Receivables Ageing Breakdown:
                      </Text>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 10,
                          marginTop: 8,
                        }}
                      >
                        {(['NOT_DUE', 'D1_30', 'D31_60', 'D61_90', 'D90_PLUS'] as const).map((b) => {
                          const val = d.receivables.ageing[b] ?? 0;
                          const isAlert = b === 'D61_90' || b === 'D90_PLUS';
                          return (
                            <div
                              key={b}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                backgroundColor: isAlert && val > 0 ? '#fff1f2' : '#f8fafc',
                                border: `1px solid ${isAlert && val > 0 ? '#fecdd3' : '#e2e8f0'}`,
                              }}
                            >
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {AGEING_LABEL[b] ?? b}
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: isAlert && val > 0 ? '#e11d48' : '#0f172a',
                                  marginTop: 2,
                                }}
                              >
                                {inr(val)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Top Debtors Table */}
                  {d.receivables?.topDebtors && d.receivables.topDebtors.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        Top Overdue Debtors:
                      </Text>
                      <Table
                        style={{ marginTop: 8 }}
                        size="small"
                        rowKey="customerId"
                        pagination={false}
                        dataSource={d.receivables.topDebtors}
                        columns={[
                          {
                            title: 'Customer',
                            dataIndex: 'name',
                            render: (v: string, r) => (
                              <Space direction="vertical" size={0}>
                                <Text strong>{v}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {r.customerCode} · {r.phone}
                                </Text>
                              </Space>
                            ),
                          },
                          {
                            title: 'Terms',
                            dataIndex: 'paymentTerms',
                            render: (v: string) => <Tag color="blue">{v}</Tag>,
                          },
                          {
                            title: 'Outstanding',
                            dataIndex: 'outstanding',
                            align: 'right',
                            render: inr,
                          },
                          {
                            title: 'Overdue Amount',
                            dataIndex: 'overdue',
                            align: 'right',
                            render: (v: number) => (
                              <Text strong style={{ color: '#e11d48' }}>
                                {inr(v)}
                              </Text>
                            ),
                          },
                          {
                            title: 'Overdue Bills',
                            dataIndex: 'overdueBills',
                            align: 'center',
                            render: (v: number) => (
                              <Tag color={v > 0 ? 'volcano' : 'default'}>{v} bills</Tag>
                            ),
                          },
                          {
                            title: 'Oldest Overdue',
                            dataIndex: 'oldestOverdueDays',
                            align: 'right',
                            render: (v: number) => (
                              <Tag color={v > 30 ? 'red' : 'gold'}>{v} days</Tag>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ) : null}
                </Space>
              ),
            },
            {
              key: 'payables',
              label: 'Payables & Disbursements',
              children: (
                <Row gutter={[16, 16]} style={{ padding: '8px 0' }}>
                  <Col xs={24} md={12}>
                    <div
                      style={{
                        padding: '18px',
                        borderRadius: 14,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CarOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
                          <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                            Rider Delivery Fleet Earnings
                          </Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                          Accrued task delivery fees and incentives earned by riders during this range.
                        </Text>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed', marginTop: 12 }}>
                          {inr(d.payables.riderEarnings)}
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <Link to="/riders/earnings">
                          <Button type="primary" ghost style={{ borderRadius: 8 }}>
                            Open Rider Earnings & Payouts →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div
                      style={{
                        padding: '18px',
                        borderRadius: 14,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TeamOutlined style={{ color: '#0284c7', fontSize: 18 }} />
                          <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                            Affiliate Partner Commissions
                          </Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                          Commission accrued for referral orders, ready for scheduled disbursement.
                        </Text>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0284c7', marginTop: 12 }}>
                          {inr(d.payables.affiliateCommission.amount)}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {d.payables.affiliateCommission.lines} commission line items
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <Link to="/affiliates/payouts">
                          <Button type="primary" ghost style={{ borderRadius: 8 }}>
                            Open Affiliate Payouts Queue →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </Card>

      {/* 8. Live Recent Collections Stream */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WalletOutlined style={{ color: '#16a34a' }} />
            <span>Latest Money Received Ledger</span>
          </div>
        }
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Recent payments, online receipts, and COD handovers in this period
          </Text>
        }
      >
        {/* Filter & Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Segmented
            value={collectionFilter}
            onChange={(v) => setCollectionFilter(v as string)}
            options={[
              { label: 'All Modes', value: 'ALL' },
              { label: 'Online PG', value: 'ONLINE' },
              { label: 'COD Cash', value: 'COD' },
              { label: 'Store POS', value: 'POS' },
              { label: 'B2B Receipt', value: 'CREDIT_RECEIPT' },
            ]}
            style={{ borderRadius: 8 }}
          />

          <div style={{ width: 280 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by party, doc, or ref..."
              value={collectionSearch}
              onChange={(e) => setCollectionSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>

        <Table
          size="middle"
          rowKey={(r) => `${r.source}-${r.id}`}
          columns={recentColumns}
          dataSource={filteredCollections}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 960 }}
          locale={{ emptyText: 'No transactions match the selected filter' }}
        />
      </Card>
    </>
  );
}
