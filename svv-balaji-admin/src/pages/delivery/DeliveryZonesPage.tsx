import {
  AppstoreOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleFilled,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { apiErrorMessage } from '@shared/api/client';
import {
  deliveryApi,
  type DeliveryZone,
  type OpeningWindow,
  type ZoneInput,
} from '@shared/api/delivery';
import { useCan } from '@shared/auth/useCan';
import { PageHeader } from '@shared/components/PageHeader';
import { useCategories } from '@shared/hooks/useCategories';
import { useDeliveryMutation, useZones } from '@shared/hooks/useDelivery';
import { useWarehouses } from '../../hooks/useWarehouses';
import { ZoneMapEditor, type LatLng } from './ZoneMapEditor';

const { Text, Title } = Typography;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const listOf = <T,>(x: unknown): T[] =>
  (Array.isArray(x) ? x : ((x as { data?: T[] })?.data ?? [])) as T[];

/**
 * Super Admin: which areas get Quick Delivery, from which outlet, how fast, when, and what happens otherwise.
 */
export function DeliveryZonesPage() {
  const zones = useZones();
  const canManage = useCan('DELIVERY_ZONES_MANAGE');
  const [editing, setEditing] = useState<DeliveryZone | 'new' | null>(null);
  const { message } = AntApp.useApp();
  const remove = useDeliveryMutation((id: string) => deliveryApi.removeZone(id));
  const toggle = useDeliveryMutation(
    ({ id, quickEnabled }: { id: string; quickEnabled: boolean }) =>
      deliveryApi.updateZone(id, { quickEnabled }),
  );

  const columns: ColumnsType<DeliveryZone> = [
    {
      title: 'Zone',
      key: 'zone',
      render: (_, z) => (
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{z.name}</span>
            {!z.isActive ? (
              <Tag color="default" style={{ borderRadius: 10, fontSize: 11 }}>
                Inactive
              </Tag>
            ) : null}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {z.code} · priority {z.priority}
          </Text>
        </div>
      ),
    },
    {
      title: 'Quick Delivery',
      key: 'quick',
      render: (_, z) => (
        <Space size={8}>
          <Switch
            size="small"
            checked={z.quickEnabled}
            disabled={!canManage || !z.isActive}
            loading={toggle.isPending}
            onChange={(v) =>
              toggle.mutate(
                { id: z.id, quickEnabled: v },
                { onError: (e) => message.error(apiErrorMessage(e)) },
              )
            }
          />
          {z.quickEnabled ? (
            <Tag
              color="orange"
              icon={<ThunderboltOutlined />}
              style={{ borderRadius: 12, fontWeight: 600 }}
            >
              {z.targetMinMinutes}–{z.targetMaxMinutes} min
            </Tag>
          ) : (
            <Tag style={{ borderRadius: 12 }}>Standard routing</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Serving Outlet',
      key: 'wh',
      render: (_, z) => (
        <Space size={6}>
          <ShopOutlined style={{ color: '#059669' }} />
          <span>{z.warehouse?.name ?? '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Coverage',
      key: 'cov',
      render: (_, z) => (
        <Space size={4} wrap>
          {z.boundary ? (
            <Tag color="blue" style={{ borderRadius: 6 }}>
              Boundary · {z.boundary.length} pts
            </Tag>
          ) : null}
          {z.pincodes.length ? (
            <Tooltip title={z.pincodes.join(', ')}>
              <Tag style={{ borderRadius: 6 }}>
                {z.pincodes.length} pincode{z.pincodes.length === 1 ? '' : 's'}
              </Tag>
            </Tooltip>
          ) : null}
          {z.maxRadiusKm ? (
            <Tag color="geekblue" style={{ borderRadius: 6 }}>
              ≤ {Number(z.maxRadiusKm)} km
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Operating Hours',
      key: 'hours',
      render: (_, z) =>
        z.operatingHours.length ? (
          <Tooltip
            title={z.operatingHours
              .map((w) => `${DAYS[w.day]} ${w.open}–${w.close}`)
              .join(', ')}
          >
            <Tag color="purple" style={{ borderRadius: 6 }}>
              {z.operatingHours.length} window{z.operatingHours.length === 1 ? '' : 's'}
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="green" style={{ borderRadius: 6 }}>
            24/7 Always Open
          </Tag>
        ),
    },
    {
      title: 'Quick Fee',
      key: 'fee',
      render: (_, z) =>
        Number(z.quickFee) ? (
          <span>
            <strong style={{ color: '#0f172a' }}>₹{Number(z.quickFee)}</strong>
            {z.quickFreeAbove ? (
              <span style={{ fontSize: 11, color: '#16a34a', display: 'block' }}>
                Free ≥ ₹{Number(z.quickFreeAbove)}
              </span>
            ) : null}
          </span>
        ) : (
          <Tag color="success" style={{ borderRadius: 10 }}>
            Free
          </Tag>
        ),
    },
    {
      title: 'Fallback',
      key: 'fb',
      render: (_, z) =>
        z.fallback === 'COURIER' ? (
          <Tag color="volcano">Always Courier</Tag>
        ) : (
          <Tag color="default">Standard</Tag>
        ),
    },
    {
      title: 'Orders',
      key: 'orders',
      align: 'right',
      render: (_, z) => <strong style={{ color: '#0f172a' }}>{z._count?.orders ?? 0}</strong>,
    },
    {
      title: 'Actions',
      key: 'act',
      width: 150,
      render: (_, z) =>
        canManage ? (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(z)}>
              Edit
            </Button>
            <Popconfirm
              title="Remove this zone?"
              description="A zone that served orders is switched off instead."
              onConfirm={() =>
                remove.mutate(z.id, {
                  onSuccess: (r) =>
                    message.success(r.deleted ? 'Zone deleted' : 'Zone deactivated'),
                  onError: (e) => message.error(apiErrorMessage(e)),
                })
              }
            >
              <Button size="small" danger>
                Remove
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: '16px 8px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHeader
          title="Delivery Zones"
          subtitle="Define geo-fenced boundaries, serving outlets, delivery promises, and pricing rules for Quick Delivery."
          actions={
            canManage ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setEditing('new')}
                style={{
                  borderRadius: 8,
                  backgroundColor: '#166534',
                  borderColor: '#166534',
                  fontWeight: 600,
                }}
              >
                New Delivery Zone
              </Button>
            ) : null
          }
        />
        <TestAddress />
        <Card size="small" style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <Table<DeliveryZone>
            rowKey="id"
            columns={columns}
            dataSource={zones.data ?? []}
            loading={zones.isLoading}
            pagination={false}
            scroll={{ x: 1000 }}
            locale={{ emptyText: 'No zones configured yet - customers receive standard delivery.' }}
          />
        </Card>
        {editing ? (
          <ZoneDrawer
            zone={editing === 'new' ? null : editing}
            all={zones.data ?? []}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Space>
    </div>
  );
}

function TestAddress() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [res, setRes] = useState<Awaited<ReturnType<typeof deliveryApi.testZone>> | null>(null);
  const { message } = AntApp.useApp();
  const run = async () => {
    try {
      setRes(
        await deliveryApi.testZone({
          latitude: lat ?? undefined,
          longitude: lng ?? undefined,
          pincode: pin || undefined,
        }),
      );
    } catch (e) {
      message.error(apiErrorMessage(e));
    }
  };
  return (
    <Card
      size="small"
      style={{ borderRadius: 14, border: '1px solid #e2e8f0' }}
      title={
        <Space>
          <EnvironmentOutlined style={{ color: '#166534' }} />
          <span>Check Address Coverage</span>
        </Space>
      }
    >
      <Space wrap size={10}>
        <InputNumber
          placeholder="Latitude (e.g. 23.23)"
          value={lat}
          onChange={(v) => setLat(v === null ? null : Number(v))}
          style={{ width: 160, borderRadius: 8 }}
        />
        <InputNumber
          placeholder="Longitude (e.g. 77.43)"
          value={lng}
          onChange={(v) => setLng(v === null ? null : Number(v))}
          style={{ width: 160, borderRadius: 8 }}
        />
        <Input
          placeholder="6-digit Pincode"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ width: 140, borderRadius: 8 }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={() => void run()}
          style={{ borderRadius: 8, backgroundColor: '#166534', borderColor: '#166534' }}
        >
          Check Coverage
        </Button>
        {res ? (
          res.zone ? (
            <Space style={{ marginLeft: 8 }}>
              <Tag color="green" style={{ borderRadius: 6, fontWeight: 600 }}>
                {res.zone.name}
              </Tag>
              <Text type="secondary" style={{ fontSize: 13 }}>
                matched by <strong>{res.matchedBy?.toLowerCase()}</strong>
                {res.distanceKm !== null
                  ? ` · ${res.distanceKm} km from ${res.servingOutlet}`
                  : ''}
              </Text>
              {res.quickEnabled ? (
                res.openNow ? (
                  <Tag color="orange" icon={<ThunderboltFilled />} style={{ borderRadius: 12 }}>
                    Quick open now
                  </Tag>
                ) : (
                  <Tag style={{ borderRadius: 12 }}>Quick closed now</Tag>
                )
              ) : (
                <Tag style={{ borderRadius: 12 }}>Quick disabled</Tag>
              )}
            </Space>
          ) : (
            <Tag color="default" style={{ borderRadius: 6 }}>
              Not inside any active zone - routes via standard delivery
            </Tag>
          )
        ) : null}
      </Space>
    </Card>
  );
}

interface FormValues {
  name: string;
  code: string;
  isActive: boolean;
  quickEnabled: boolean;
  warehouseId: string;
  pincodesText: string;
  maxRadiusKm: number | null;
  targetMinMinutes: number;
  targetMaxMinutes: number;
  timezone: string;
  productScope: 'ALL_PRODUCTS' | 'SELECTED_CATEGORIES';
  categoryIds: string[];
  fallback: 'STANDARD' | 'COURIER';
  quickFee: number;
  quickFreeAbove: number | null;
  priority: number;
}

/**
 * Modern, User-Friendly Delivery Zone Drawer
 * Organizes complex zone configuration into clear, structured tabs with live visual previews.
 */
function ZoneDrawer({
  zone,
  all,
  onClose,
}: {
  zone: DeliveryZone | null;
  all: DeliveryZone[];
  onClose: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { message } = AntApp.useApp();
  const warehouses = useWarehouses();
  const categories = useCategories();
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [boundary, setBoundary] = useState<LatLng[]>(zone?.boundary ?? []);
  const [hours, setHours] = useState<OpeningWindow[]>(zone?.operatingHours ?? []);
  const save = useDeliveryMutation((b: ZoneInput) =>
    zone ? deliveryApi.updateZone(zone.id, b) : deliveryApi.createZone(b),
  );

  // Watched fields for Live Preview
  const watchedName = Form.useWatch('name', form);
  const watchedCode = Form.useWatch('code', form);
  const watchedActive = Form.useWatch('isActive', form) ?? true;
  const watchedQuick = Form.useWatch('quickEnabled', form) ?? true;
  const watchedWhId = Form.useWatch('warehouseId', form);
  const watchedRadius = Form.useWatch('maxRadiusKm', form);
  const watchedMin = Form.useWatch('targetMinMinutes', form) ?? 15;
  const watchedMax = Form.useWatch('targetMaxMinutes', form) ?? 20;
  const watchedFee = Form.useWatch('quickFee', form) ?? 0;
  const watchedFreeAbove = Form.useWatch('quickFreeAbove', form);
  const watchedScope = Form.useWatch('productScope', form);
  const watchedPincodesText = Form.useWatch('pincodesText', form) ?? '';

  const whList = listOf<{
    id: string;
    name: string;
    kind?: string;
    isActive: boolean;
    latitude?: string | null;
    longitude?: string | null;
  }>(warehouses.data);

  const outlets = useMemo(
    () =>
      whList
        .filter((w) => w.isActive && w.latitude && w.longitude)
        .map((w) => ({
          id: w.id,
          name: w.name,
          lat: Number(w.latitude),
          lng: Number(w.longitude),
        })),
    [whList],
  );

  const selectedOutlet = useMemo(
    () => whList.find((w) => w.id === watchedWhId),
    [whList, watchedWhId],
  );

  const others = useMemo(
    () =>
      all
        .filter((z) => z.id !== zone?.id && z.isActive && z.boundary)
        .map((z) => ({ name: z.name, boundary: z.boundary as LatLng[] })),
    [all, zone?.id],
  );

  const parsedPincodes = useMemo(() => {
    return watchedPincodesText
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [watchedPincodesText]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const pincodes = v.pincodesText
        .split(/[\s,]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (boundary.length > 0 && boundary.length < 3) {
        setActiveTab('coverage');
        return message.error('A boundary polygon requires at least 3 points (or clear it)');
      }
      await save.mutateAsync({
        name: v.name,
        code: v.code.toUpperCase(),
        isActive: v.isActive,
        quickEnabled: v.quickEnabled,
        warehouseId: v.warehouseId,
        boundary: boundary.length ? boundary : null,
        pincodes,
        maxRadiusKm: v.maxRadiusKm ?? null,
        targetMinMinutes: v.targetMinMinutes,
        targetMaxMinutes: v.targetMaxMinutes,
        operatingHours: hours,
        timezone: v.timezone,
        productScope: v.productScope,
        categoryIds: v.productScope === 'SELECTED_CATEGORIES' ? v.categoryIds ?? [] : [],
        fallback: v.fallback,
        quickFee: v.quickFee ?? 0,
        quickFreeAbove: v.quickFreeAbove ?? null,
        priority: v.priority ?? 0,
      });
      message.success(zone ? 'Zone configuration updated' : 'Delivery zone created');
      onClose();
    } catch (e: any) {
      if (e?.errorFields?.length) {
        // Jump to the tab containing the first invalid field
        const firstField = e.errorFields[0].name[0];
        if (['name', 'code', 'warehouseId'].includes(firstField)) setActiveTab('basic');
        else if (['targetMinMinutes', 'targetMaxMinutes'].includes(firstField))
          setActiveTab('promise');
        else if (['categoryIds'].includes(firstField)) setActiveTab('hours');
        message.error('Please complete all required fields');
      } else {
        message.error(apiErrorMessage(e, 'Could not save the delivery zone'));
      }
    }
  };

  return (
    <Drawer
      open
      width={Math.min(1040, window.innerWidth)}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#ecfdf5',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <EnvironmentOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
              {zone ? `Edit Zone: ${zone.name}` : 'Configure New Delivery Zone'}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Serving outlet, geo-fence polygon, SLA promise, and operating schedule
            </Text>
          </div>
        </div>
      }
      onClose={onClose}
      destroyOnClose
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Changes apply in real-time to the next checkout attempt.
          </Text>
          <Space>
            <Button onClick={onClose} style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={save.isPending}
              onClick={() => void submit()}
              style={{
                borderRadius: 8,
                backgroundColor: '#166534',
                borderColor: '#166534',
                fontWeight: 600,
              }}
            >
              {zone ? 'Save Changes' : 'Create Delivery Zone'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          name: zone?.name,
          code: zone?.code,
          isActive: zone?.isActive ?? true,
          quickEnabled: zone?.quickEnabled ?? true,
          warehouseId: zone?.warehouseId,
          pincodesText: (zone?.pincodes ?? []).join(', '),
          maxRadiusKm: zone?.maxRadiusKm ? Number(zone.maxRadiusKm) : null,
          targetMinMinutes: zone?.targetMinMinutes ?? 15,
          targetMaxMinutes: zone?.targetMaxMinutes ?? 20,
          timezone: zone?.timezone ?? 'Asia/Kolkata',
          productScope: zone?.productScope ?? 'ALL_PRODUCTS',
          categoryIds: zone?.categoryIds ?? [],
          fallback: zone?.fallback ?? 'STANDARD',
          quickFee: zone ? Number(zone.quickFee) : 0,
          quickFreeAbove: zone?.quickFreeAbove ? Number(zone.quickFreeAbove) : null,
          priority: zone?.priority ?? 0,
        }}
      >
        {/* Sticky Live Customer-Facing Preview Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
              {watchedName || 'Untitled Zone'}
            </Text>
            {watchedCode ? (
              <Tag style={{ borderRadius: 6, fontWeight: 500, fontFamily: 'monospace' }}>
                {watchedCode.toUpperCase()}
              </Tag>
            ) : null}
            <Tag color={watchedActive ? 'green' : 'default'} style={{ borderRadius: 10 }}>
              {watchedActive ? 'Active' : 'Disabled'}
            </Tag>
            {watchedQuick ? (
              <Tag
                color="orange"
                icon={<ThunderboltFilled />}
                style={{ borderRadius: 12, fontWeight: 600 }}
              >
                {watchedMin}–{watchedMax} min
              </Tag>
            ) : (
              <Tag style={{ borderRadius: 12 }}>Standard Delivery</Tag>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Outlet: <strong>{selectedOutlet?.name ?? 'Not selected'}</strong>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Fee:{' '}
              <strong style={{ color: '#0f172a' }}>
                {watchedFee > 0 ? `₹${watchedFee}` : 'Free'}
              </strong>
              {watchedFreeAbove ? (
                <span style={{ color: '#16a34a', marginLeft: 4 }}>
                  (Free &gt; ₹{watchedFreeAbove})
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Coverage:{' '}
              <strong>
                {boundary.length > 0 ? `${boundary.length} map points` : `${parsedPincodes.length} pincodes`}
              </strong>
            </span>
          </div>
        </div>

        {/* Structured Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ShopOutlined /> General & Outlet
                </span>
              ),
              children: (
                <div style={{ padding: '8px 2px' }}>
                  <Row gutter={16}>
                    <Col xs={24} md={14}>
                      <Form.Item
                        name="name"
                        label={<Text strong>Zone Display Name</Text>}
                        rules={[{ required: true, min: 2, message: 'Please enter a zone name' }]}
                        extra="Customer and admin visible area label (e.g. South Delhi, Indiranagar, Arera Colony)."
                      >
                        <Input placeholder="e.g. Koramangala & HSR" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={10}>
                      <Form.Item
                        name="code"
                        label={<Text strong>Zone Identifier Code</Text>}
                        rules={[
                          {
                            required: true,
                            pattern: /^[A-Za-z0-9-]{2,30}$/,
                            message: 'Must be 2–30 alphanumeric characters or dashes',
                          },
                        ]}
                        extra="Unique system code for logs and routing (cannot be changed once created)."
                      >
                        <Input
                          placeholder="BLR-KRM"
                          disabled={Boolean(zone)}
                          style={{ borderRadius: 8, textTransform: 'uppercase' }}
                          onChange={(e) => {
                            form.setFieldsValue({ code: e.target.value.toUpperCase() });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="warehouseId"
                    label={<Text strong>Serving Warehouse / Retail Outlet</Text>}
                    rules={[{ required: true, message: 'Please select a serving outlet' }]}
                    extra="Quick delivery orders in this zone are fulfilled here. Its real-time inventory determines product availability."
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      loading={warehouses.isLoading}
                      placeholder="Select a serving outlet"
                      style={{ borderRadius: 8 }}
                      options={whList
                        .filter((w) => w.isActive)
                        .map((w) => ({
                          value: w.id,
                          label: `${w.name}${w.kind ? ` (${w.kind.toLowerCase()})` : ''}${w.latitude ? ' ✓ Map Ready' : ' ⚠️ No coordinates'}`,
                          disabled: !w.latitude,
                        }))}
                    />
                  </Form.Item>

                  <Divider style={{ margin: '16px 0' }} />

                  {/* Operational Switches */}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 12,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            Zone Active Status
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Master switch. If turned off, all orders in this area fallback to
                            standard delivery.
                          </Text>
                        </div>
                        <Form.Item name="isActive" valuePropName="checked" noStyle>
                          <Switch />
                        </Form.Item>
                      </div>
                    </Col>

                    <Col xs={24} md={12}>
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 12,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            Express Quick Delivery
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Enable instant 10–30 min delivery slot when outlet is open.
                          </Text>
                        </div>
                        <Form.Item name="quickEnabled" valuePropName="checked" noStyle>
                          <Switch />
                        </Form.Item>
                      </div>
                    </Col>
                  </Row>

                  <div style={{ marginTop: 16 }}>
                    <Form.Item
                      name="priority"
                      label={<Text strong>Zone Priority Ranking</Text>}
                      extra="When a customer's location overlaps multiple active zones, the zone with the higher priority wins."
                    >
                      <InputNumber
                        min={-100}
                        max={100}
                        style={{ width: 180, borderRadius: 8 }}
                      />
                    </Form.Item>
                  </div>
                </div>
              ),
            },
            {
              key: 'coverage',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <EnvironmentOutlined /> Coverage & Geo-Fencing
                </span>
              ),
              children: (
                <div style={{ padding: '8px 2px' }}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ borderRadius: 10, marginBottom: 14 }}
                    message="How Location Matching Works"
                    description="1. Custom Map Boundary: If drawn, pins inside the polygon qualify. 2. Radius Cap: Enforces a hard km limit from the outlet. 3. Pincodes: Used for addresses without a map pin."
                  />

                  {/* Interactive Map Section */}
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <Text strong style={{ fontSize: 14 }}>
                        Interactive Polygon Geo-fence Boundary:
                      </Text>
                      <Space>
                        <Tag color={boundary.length >= 3 ? 'success' : 'default'} style={{ borderRadius: 10 }}>
                          {boundary.length} Points {boundary.length >= 3 ? '(Valid Polygon)' : '(Need ≥3)'}
                        </Tag>
                      </Space>
                    </div>

                    <ZoneMapEditor
                      value={boundary}
                      onChange={setBoundary}
                      outlets={outlets}
                      servingOutletId={watchedWhId}
                      radiusKm={watchedRadius}
                      otherZones={others}
                    />
                  </div>

                  <Divider style={{ margin: '20px 0 16px' }} />

                  <Row gutter={16}>
                    <Col xs={24} md={14}>
                      <Form.Item
                        name="pincodesText"
                        label={<Text strong>Supported Postal Pincodes</Text>}
                        extra="Fallback for addresses without exact GPS pins. Enter 6-digit Indian pincodes separated by comma or space."
                      >
                        <Input.TextArea
                          rows={3}
                          placeholder="e.g. 560034, 560095, 560068"
                          style={{ borderRadius: 8 }}
                        />
                      </Form.Item>
                      {parsedPincodes.length > 0 ? (
                        <div style={{ marginTop: -8, marginBottom: 16 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Detected {parsedPincodes.length} pincode(s):{' '}
                          </Text>
                          <Space size={4} wrap style={{ marginTop: 4 }}>
                            {parsedPincodes.slice(0, 10).map((p) => (
                              <Tag key={p} color="blue" style={{ borderRadius: 6, fontSize: 11 }}>
                                {p}
                              </Tag>
                            ))}
                            {parsedPincodes.length > 10 ? (
                              <Tag style={{ borderRadius: 6, fontSize: 11 }}>
                                +{parsedPincodes.length - 10} more
                              </Tag>
                            ) : null}
                          </Space>
                        </div>
                      ) : null}
                    </Col>
                    <Col xs={24} md={10}>
                      <Form.Item
                        name="maxRadiusKm"
                        label={<Text strong>Hard Delivery Radius Cap (km)</Text>}
                        extra="Maximum allowable distance from the outlet in km. Orders further away will not qualify even if inside boundary."
                      >
                        <InputNumber
                          min={0.5}
                          max={100}
                          step={0.5}
                          placeholder="No limit (leave empty)"
                          style={{ width: '100%', borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'promise',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ThunderboltOutlined /> Promise & Pricing
                </span>
              ),
              children: (
                <div style={{ padding: '8px 2px' }}>
                  {/* Delivery Speed SLA Card */}
                  <Card
                    size="small"
                    style={{
                      borderRadius: 14,
                      backgroundColor: '#fff7ed',
                      border: '1px solid #fed7aa',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <ThunderboltFilled style={{ color: '#ea580c', fontSize: 18 }} />
                      <Text strong style={{ fontSize: 15, color: '#9a3412' }}>
                        Delivery Time SLA Promise
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 14 }}>
                      Displayed prominently on customer product pages, cart, and checkout badge.
                    </Text>

                    <Row gutter={16}>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="targetMinMinutes"
                          label="From (minutes)"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={5} max={180} style={{ width: '100%', borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="targetMaxMinutes"
                          label="To (minutes)"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={5} max={240} style={{ width: '100%', borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ paddingTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                            Quick Speed Presets:
                          </Text>
                          <Space wrap size={6} style={{ marginTop: 6 }}>
                            {[
                              [10, 15],
                              [15, 20],
                              [20, 30],
                              [30, 45],
                            ].map(([min, max]) => (
                              <Button
                                key={`${min}-${max}`}
                                size="small"
                                onClick={() =>
                                  form.setFieldsValue({
                                    targetMinMinutes: min,
                                    targetMaxMinutes: max,
                                  })
                                }
                                style={{ borderRadius: 6, fontSize: 12 }}
                              >
                                {min}–{max} min
                              </Button>
                            ))}
                          </Space>
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  {/* Delivery Fee & Free Delivery Threshold */}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="quickFee"
                        label={<Text strong>Quick Delivery Fee (₹)</Text>}
                        extra="Flat delivery charge applied for express fulfillment in this zone (0 = always free)."
                      >
                        <InputNumber
                          min={0}
                          prefix="₹"
                          style={{ width: '100%', borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="quickFreeAbove"
                        label={<Text strong>Free Quick Delivery Above (₹)</Text>}
                        extra="Cart subtotal threshold above which Quick Delivery fee is waived (empty = never free)."
                      >
                        <InputNumber
                          min={0}
                          prefix="₹"
                          placeholder="e.g. 499"
                          style={{ width: '100%', borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '14px 0' }} />

                  {/* Fallback Option */}
                  <Form.Item
                    name="fallback"
                    label={<Text strong>Fallback Routing Mode</Text>}
                    extra="What happens when Quick Delivery is unavailable (e.g. store is closed, item out of stock, or radius exceeded)."
                  >
                    <Radio.Group style={{ width: '100%' }}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <Radio value="STANDARD">
                              <strong>Standard Local Routing</strong>
                            </Radio>
                            <div style={{ fontSize: 12, color: '#64748b', marginLeft: 24, marginTop: 4 }}>
                              Routes via scheduled local van delivery if possible, otherwise courier.
                            </div>
                          </div>
                        </Col>
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <Radio value="COURIER">
                              <strong>Direct Courier Dispatch</strong>
                            </Radio>
                            <div style={{ fontSize: 12, color: '#64748b', marginLeft: 24, marginTop: 4 }}>
                              Dispatches directly via 3rd party logistics partner (BlueDart/Delhivery).
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </Radio.Group>
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'hours',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ClockCircleOutlined /> Hours & Products
                </span>
              ),
              children: (
                <div style={{ padding: '8px 2px' }}>
                  {/* Operating Hours Builder */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div>
                        <Text strong style={{ fontSize: 14 }}>
                          Weekly Operating Windows:
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Quick option is shown to customers only when within these open hours.
                        </Text>
                      </div>
                    </div>

                    <HoursEditor value={hours} onChange={setHours} />
                  </div>

                  <Row gutter={16}>
                    <Col xs={24} md={10}>
                      <Form.Item
                        name="timezone"
                        label={<Text strong>Operating Timezone</Text>}
                        extra="Default: Asia/Kolkata (Indian Standard Time)."
                      >
                        <Input style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '14px 0' }} />

                  {/* Product Scope */}
                  <Form.Item
                    name="productScope"
                    label={<Text strong>Product Eligibility Scope</Text>}
                    extra="Determine which product catalog items are allowed for Quick Delivery in this zone."
                  >
                    <Select
                      style={{ borderRadius: 8 }}
                      options={[
                        {
                          value: 'ALL_PRODUCTS',
                          label: 'All in-stock products at serving outlet',
                        },
                        {
                          value: 'SELECTED_CATEGORIES',
                          label: 'Only specific categories (must still be in stock)',
                        },
                      ]}
                    />
                  </Form.Item>

                  {watchedScope === 'SELECTED_CATEGORIES' ? (
                    <Form.Item
                      name="categoryIds"
                      label={<Text strong>Permitted Categories</Text>}
                      rules={[
                        {
                          required: true,
                          type: 'array',
                          min: 1,
                          message: 'Please select at least one category',
                        },
                      ]}
                      extra="Only items belonging to these categories will show the Quick Delivery badge."
                    >
                      <Select
                        mode="multiple"
                        optionFilterProp="label"
                        placeholder="Choose eligible categories"
                        style={{ borderRadius: 8 }}
                        options={listOf<{
                          id: string;
                          name: string;
                          parentId: string | null;
                        }>(categories.data).map((c) => ({
                          value: c.id,
                          label: c.parentId ? `  • ${c.name}` : c.name,
                        }))}
                      />
                    </Form.Item>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}

/**
 * Modern, User-Friendly Operating Hours Editor with 1-Click Presets & Clear Schedule Rows
 */
function HoursEditor({
  value,
  onChange,
}: {
  value: OpeningWindow[];
  onChange: (v: OpeningWindow[]) => void;
}) {
  const add = () => onChange([...value, { day: 1, open: '08:00', close: '22:00' }]);
  const everyDay = (open = '08:00', close = '22:00') =>
    onChange([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close })));
  const weekdaysOnly = () =>
    onChange([1, 2, 3, 4, 5].map((day) => ({ day, open: '08:00', close: '22:00' })));

  const set = (i: number, patch: Partial<OpeningWindow>) =>
    onChange(value.map((w, k) => (k === i ? { ...w, ...patch } : w)));

  const copyToAll = (fromIndex: number) => {
    const source = value[fromIndex];
    if (!source) return;
    onChange(
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        open: source.open,
        close: source.close,
      })),
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Quick Schedule Presets */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Space wrap size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Quick Presets:
          </Text>
          <Button size="small" onClick={() => everyDay('08:00', '22:00')} style={{ borderRadius: 6 }}>
            Every Day 08:00–22:00
          </Button>
          <Button size="small" onClick={() => everyDay('07:00', '23:00')} style={{ borderRadius: 6 }}>
            07:00–23:00
          </Button>
          <Button size="small" onClick={weekdaysOnly} style={{ borderRadius: 6 }}>
            Mon–Fri Only
          </Button>
          <Button
            size="small"
            type={value.length === 0 ? 'primary' : 'default'}
            onClick={() => onChange([])}
            style={{ borderRadius: 6 }}
          >
            24/7 Always Open
          </Button>
        </Space>

        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={add}
          style={{ borderRadius: 6 }}
        >
          Add Custom Window
        </Button>
      </div>

      {value.length === 0 ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleFilled />}
          message="Configured as 24/7 Always Open"
          description="Customers in this zone can place Quick Delivery orders around the clock at any time."
          style={{ borderRadius: 10 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {value.map((w, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Space wrap size={10} style={{ alignItems: 'center' }}>
                <Select
                  value={w.day}
                  style={{ width: 130, borderRadius: 6 }}
                  onChange={(d) => set(i, { day: d })}
                  options={DAYS.map((d, k) => ({ value: k, label: `${d} (${DAY_FULL[k]})` }))}
                />
                <span style={{ fontSize: 13, color: '#64748b' }}>Opens:</span>
                <TimePicker
                  format="HH:mm"
                  value={dayjs(w.open, 'HH:mm')}
                  allowClear={false}
                  onChange={(t) => t && set(i, { open: t.format('HH:mm') })}
                  style={{ borderRadius: 6 }}
                />
                <span style={{ fontSize: 13, color: '#64748b' }}>Closes:</span>
                <TimePicker
                  format="HH:mm"
                  value={dayjs(w.close, 'HH:mm')}
                  allowClear={false}
                  onChange={(t) => t && set(i, { close: t.format('HH:mm') })}
                  style={{ borderRadius: 6 }}
                />
                {w.close < w.open ? (
                  <Tag color="volcano" style={{ borderRadius: 6, margin: 0 }}>
                    Overnight (past midnight)
                  </Tag>
                ) : null}
              </Space>

              <Space size={6}>
                <Tooltip title="Apply this open/close timing to all 7 days of the week">
                  <Button size="small" onClick={() => copyToAll(i)} style={{ borderRadius: 6 }}>
                    Apply to All Days
                  </Button>
                </Tooltip>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange(value.filter((_, k) => k !== i))}
                  style={{ borderRadius: 6 }}
                />
              </Space>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
