import {
  BarChartOutlined,
  CustomerServiceOutlined,
  InboxOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RightOutlined,
  RollbackOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Segmented, Spin, Tag, Tooltip, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@shared/api/client';
import { reportsApi } from '@shared/api/reports';
import { inr } from '../components/charts';
import { ORDER_STATUS_COLOUR, ORDER_STATUS_LABEL } from './sales/orderStatus';

const { Text } = Typography;

type MetricCard = (title: string, value: number | string, icon: ReactNode, color1: string, color2: string) => ReactNode;

const FULFIL_STEPS = ['PLACED', 'CONFIRMED', 'ALLOCATED', 'PACKED', 'DISPATCHED'] as const;

const BRAND = '#1E5E3A';
const CARD_STYLE = { borderRadius: 12, border: '1px solid #EEF2F0', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.04)' } as const;
const NUM = { fontVariantNumeric: 'tabular-nums' } as const;

/** White KPI tile: tinted icon, label, big figure, optional sub-line. Click goes to the screen behind it. */
function Kpi({ label, value, sub, icon, color, tint, onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; color: string; tint: string; onClick?: () => void;
}) {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{ ...CARD_STYLE, height: '100%', borderTop: `3px solid ${color}` }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{label}</Text>
          <div style={{ ...NUM, fontSize: 28, fontWeight: 700, color: '#0F172A', lineHeight: 1.25, marginTop: 6 }}>{value}</div>
          {sub ? <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>{sub}</div> : null}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: tint, color, display: 'grid', placeItems: 'center', fontSize: 20, flex: '0 0 44px' }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>
      <span style={{ color: BRAND, fontSize: 16 }}>{icon}</span>
      {children}
    </span>
  );
}

/** The Customer & Retail half of the dashboard. Every figure is live from GET /dashboard/commerce. */
export function CommerceDashboard(_props: { renderMetricCard?: MetricCard }) {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null);
  const range = rangeFor(preset, custom);
  const q = useQuery({
    queryKey: ['dashboard', 'commerce', range.from, range.to],
    queryFn: () => reportsApi.commerceDashboard(range),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  // Re-render every 30s so "Updated x min ago" stays true.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const toolbar = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <Segmented<Preset>
          value={preset}
          onChange={(v) => setPreset(v)}
          options={[
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Last 7 days', value: '7d' },
            { label: 'This month', value: 'month' },
            { label: 'Last month', value: 'lastMonth' },
            { label: 'Custom', value: 'custom' },
          ]}
        />
        {preset === 'custom' ? (
          <DatePicker.RangePicker
            value={custom}
            onChange={(v) => setCustom(v && v[0] && v[1] ? [v[0], v[1]] : null)}
            format="D MMM YYYY"
            allowClear={false}
            disabledDate={(day) => day.isAfter(dayjs(), 'day')}
          />
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {q.dataUpdatedAt ? `Updated ${relative(q.dataUpdatedAt)}` : ''}
        </Text>
        <Tooltip title="Refresh now">
          <Button icon={<ReloadOutlined spin={q.isFetching} />} onClick={() => void q.refetch()} disabled={q.isFetching}>
            Refresh
          </Button>
        </Tooltip>
      </div>
    </div>
  );

  if (q.isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{toolbar}<div style={{ padding: 100, textAlign: 'center' }}><Spin size="large" /></div></div>;
  if (q.isError || !q.data) return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{toolbar}<Alert type="error" showIcon message={apiErrorMessage(q.error, 'Could not load the dashboard')} /></div>;
  const d = q.data;
  const monthLabel = periodLabel(preset, range);
  const monthTotal = d.month.b2b.revenue + d.month.b2c.revenue + d.month.pos.revenue;

  const attention: Array<{ label: string; path: string; icon: ReactNode; count?: number; tone?: string }> = [
    { label: 'Consumer orders', path: '/b2c-orders', icon: <ShoppingCartOutlined /> },
    { label: 'Retailer orders', path: '/b2b-orders', icon: <ShopOutlined /> },
    { label: 'Retailer registrations', path: '/b2b-accounts', icon: <UserAddOutlined />, count: d.pendingRetailerApprovals, tone: '#D97706' },
    { label: 'Support tickets', path: '/support-tickets', icon: <CustomerServiceOutlined />, count: d.openSupportTickets, tone: '#DC2626' },
    { label: 'Returns & exchanges', path: '/returns/customers', icon: <RollbackOutlined />, count: d.openReturns, tone: '#EA580C' },
    { label: 'Sales analytics', path: '/reports', icon: <BarChartOutlined /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: q.isFetching && q.isPlaceholderData ? 0.6 : 1, transition: 'opacity .2s' }}>
      {toolbar}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            label="Today's sales"
            value={inr(d.today.revenue)}
            sub={`${d.today.orders} order${d.today.orders === 1 ? '' : 's'} today`}
            icon={<LineChartOutlined />}
            color={BRAND}
            tint="#E8F3EC"
            onClick={() => navigate('/reports')}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            label={`Revenue · ${monthLabel}`}
            value={compact(monthTotal)}
            sub={<>B2B {compact(d.month.b2b.revenue)} · B2C {compact(d.month.b2c.revenue)}{d.month.pos.revenue ? ` · Store ${compact(d.month.pos.revenue)}` : ''}</>}
            icon={<TeamOutlined />}
            color="#0E7490"
            tint="#E0F2F5"
            onClick={() => navigate('/reports')}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            label="Orders to fulfil"
            value={d.toFulfil.total}
            sub={d.toFulfil.total ? 'Waiting to be packed or shipped' : 'All caught up'}
            icon={<InboxOutlined />}
            color="#D97706"
            tint="#FEF3E2"
            onClick={() => navigate('/b2c-orders')}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            label="Open returns"
            value={d.openReturns}
            sub={d.openReturns ? 'Need review or QC' : 'Nothing pending'}
            icon={<RollbackOutlined />}
            color="#DC2626"
            tint="#FDECEC"
            onClick={() => navigate('/returns/customers')}
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card
              title={<SectionTitle icon={<WarningOutlined />}>Low stock</SectionTitle>}
              extra={
                <div style={{ display: 'flex', gap: 6 }}>
                  <Tag color="error" style={{ margin: 0 }}>Critical {d.lowStock.critical}</Tag>
                  <Tag color="warning" style={{ margin: 0 }}>Low {d.lowStock.low}</Tag>
                </div>
              }
              style={CARD_STYLE}
              styles={{ body: { padding: d.lowStock.items.length ? 0 : 24 } }}
            >
              {d.lowStock.items.length ? (
                d.lowStock.items.map((p, i) => {
                  const critical = p.status === 'CRITICAL';
                  return (
                    <div
                      key={`${p.sku}-${i}`}
                      onClick={() => navigate('/inventory')}
                      className="dash-row"
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: i ? '1px solid #F1F5F3' : undefined, cursor: 'pointer' }}
                    >
                      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: critical ? '#DC2626' : '#D97706' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block' }}>{p.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {p.sku} · reorder at {p.reorderPoint} · safety {p.safetyStock}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...NUM, fontWeight: 600, color: critical ? '#DC2626' : '#B45309' }}>{p.available} {p.unit}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>sellable</Text>
                      </div>
                      <Tag color={critical ? 'error' : 'warning'} style={{ margin: 0, minWidth: 64, textAlign: 'center' }}>{critical ? 'Critical' : 'Low'}</Tag>
                    </div>
                  );
                })
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Every product is above its reorder point" />
              )}
            </Card>

            <Card
              title={<SectionTitle icon={<ShoppingCartOutlined />}>Latest orders</SectionTitle>}
              extra={<a onClick={() => navigate('/b2c-orders')}>View all</a>}
              style={CARD_STYLE}
              styles={{ body: { padding: d.recentOrders.length ? 0 : 24 } }}
            >
              {d.recentOrders.length ? (
                d.recentOrders.map((o, i) => (
                  <div
                    key={o.id}
                    className="dash-row"
                    onClick={() => navigate(`/${o.channel === 'B2B' ? 'b2b' : 'b2c'}-orders/${o.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: i ? '1px solid #F1F5F3' : undefined, cursor: 'pointer' }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: o.channel === 'B2B' ? '#E0F2F5' : '#E8F3EC', color: o.channel === 'B2B' ? '#0E7490' : BRAND, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flex: '0 0 38px' }}>
                      {o.channel}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: 'block' }}>{o.orderNumber}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {o.customer.name} · {dayjs(o.createdAt).format('D MMM, h:mm A')}
                      </Text>
                    </div>
                    <Text strong style={{ ...NUM, fontSize: 15 }}>{inr(o.total)}</Text>
                    <Tag color={ORDER_STATUS_COLOUR[o.status as keyof typeof ORDER_STATUS_COLOUR]} style={{ margin: 0, minWidth: 80, textAlign: 'center' }}>
                      {ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status}
                    </Tag>
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No orders yet" />
              )}
            </Card>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<SectionTitle icon={<WarningOutlined />}>Needs attention</SectionTitle>}
            style={{ ...CARD_STYLE, height: '100%' }}
            styles={{ body: { padding: 0 } }}
          >
            {attention.map((a, i) => (
              <div key={a.path}>
                <div
                  className="dash-row"
                  onClick={() => navigate(a.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: i ? '1px solid #F1F5F3' : undefined, cursor: 'pointer' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F7F3', color: BRAND, display: 'grid', placeItems: 'center', fontSize: 15, flex: '0 0 34px' }}>
                    {a.icon}
                  </div>
                  <Text style={{ flex: 1, fontWeight: 500 }}>{a.label}</Text>
                  {a.count ? (
                    <span style={{ ...NUM, minWidth: 24, height: 22, padding: '0 8px', borderRadius: 11, background: a.tone, color: '#fff', fontSize: 12, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>
                      {a.count}
                    </span>
                  ) : null}
                  <RightOutlined style={{ color: '#CBD5E1', fontSize: 12 }} />
                </div>
                {a.path === '/b2b-orders' && FULFIL_STEPS.some((s) => d.toFulfil.byStatus[s]) ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 20px 12px 66px' }}>
                    {FULFIL_STEPS.filter((s) => d.toFulfil.byStatus[s]).map((s) => (
                      <Tag key={s} color={ORDER_STATUS_COLOUR[s]} style={{ margin: 0 }}>{ORDER_STATUS_LABEL[s]}: {d.toFulfil.byStatus[s]}</Tag>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div style={{ margin: 16, padding: 14, borderRadius: 10, background: '#F6FAF7', border: '1px solid #E3EFE7' }}>
              <Text strong style={{ display: 'block', marginBottom: 8, color: BRAND }}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
              {[
                ['Retailers (B2B)', `${d.month.b2b.orders} orders`, inr(d.month.b2b.revenue)],
                ['Consumers (B2C)', `${d.month.b2c.orders} orders`, inr(d.month.b2c.revenue)],
                ['Store counters', `${d.month.pos.sales} sales`, inr(d.month.pos.revenue)],
              ].map(([k, n, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0' }}>
                  <Text type="secondary">{k} <span style={{ fontSize: 12 }}>· {n}</span></Text>
                  <Text strong style={NUM}>{v}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

type Preset = 'today' | 'yesterday' | '7d' | 'month' | 'lastMonth' | 'custom';
const YMD = 'YYYY-MM-DD';

function rangeFor(p: Preset, custom: [Dayjs, Dayjs] | null): { from: string; to: string } {
  const t = dayjs();
  switch (p) {
    case 'today': return { from: t.format(YMD), to: t.format(YMD) };
    case 'yesterday': { const y = t.subtract(1, 'day').format(YMD); return { from: y, to: y }; }
    case '7d': return { from: t.subtract(6, 'day').format(YMD), to: t.format(YMD) };
    case 'lastMonth': { const m = t.subtract(1, 'month'); return { from: m.startOf('month').format(YMD), to: m.endOf('month').format(YMD) }; }
    case 'custom':
      // Until both dates are picked, show this month.
      return custom ? { from: custom[0].format(YMD), to: custom[1].format(YMD) } : { from: t.startOf('month').format(YMD), to: t.format(YMD) };
    default: return { from: t.startOf('month').format(YMD), to: t.format(YMD) };
  }
}

function periodLabel(p: Preset, r: { from: string; to: string }): string {
  if (p === 'today') return 'today';
  if (p === 'yesterday') return 'yesterday';
  if (p === '7d') return 'last 7 days';
  if (p === 'month') return dayjs(r.from).format('MMMM');
  if (p === 'lastMonth') return dayjs(r.from).format('MMMM');
  return r.from === r.to ? dayjs(r.from).format('D MMM') : `${dayjs(r.from).format('D MMM')} – ${dayjs(r.to).format('D MMM')}`;
}

function relative(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : dayjs(ts).format('h:mm A');
}

/** ₹12.4L style, for the big tiles. */
function compact(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}
