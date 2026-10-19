import {
  BellFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  EyeOutlined,
  LeftOutlined,
  MutedOutlined,
  RightOutlined,
  ShopOutlined,
  SoundOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCancelOrder, useConfirmOrder, useOrder } from '@shared/hooks/useSales';
import { useIncomingOrders } from '../live/incomingOrderStore';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { OrderItem } from '../api/types';

const { Text, Title, Paragraph } = Typography;

const REJECT_REASONS = [
  'Out of stock / Inventory shortage',
  'Delivery location unserviceable',
  'Customer requested cancellation',
  'Pricing or coupon discrepancy',
  'Store closing / Unable to fulfill',
];

function ElapsedTimer({ timestamp }: { timestamp: number }) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - timestamp) / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - timestamp) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [timestamp]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: elapsed < 30 ? '#dcfce7' : elapsed < 90 ? '#fef3c7' : '#fee2e2',
        color: elapsed < 30 ? '#15803d' : elapsed < 90 ? '#b45309' : '#b91c1c',
      }}
    >
      <ClockCircleOutlined style={{ fontSize: 11 }} /> {timeText} ago
    </span>
  );
}

export function IncomingOrderBroadcastModal() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const {
    currentAlert,
    currentIndex,
    total,
    dismiss,
    silence,
    isSilenced,
    setIndex,
  } = useIncomingOrders();

  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const confirmOrderMutation = useConfirmOrder();
  const cancelOrderMutation = useCancelOrder();

  const order = currentAlert?.order;

  // Handle Accept
  const handleAccept = async (orderId: string, orderNumber: string) => {
    silence();
    try {
      await confirmOrderMutation.mutateAsync(orderId);
      message.success(`Order #${orderNumber} accepted & confirmed!`);
      dismiss(orderId);
      if (previewOrderId === orderId) setPreviewOrderId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm order';
      message.error(msg);
    }
  };

  // Open Reject Dialog
  const handleOpenReject = (orderId: string) => {
    silence();
    setRejectReason('');
    setRejectingOrderId(orderId);
  };

  // Handle Close Preview: completely cuts/dismisses the popup so accept/reject modal doesn't re-appear
  const handleClosePreview = () => {
    if (previewOrderId) {
      dismiss(previewOrderId);
    }
    silence();
    setPreviewOrderId(null);
  };

  // Handle navigate to full order page from preview
  const handleOpenOrderPage = (orderId: string, channel: string) => {
    if (previewOrderId) {
      dismiss(previewOrderId);
    }
    silence();
    setPreviewOrderId(null);
    navigate(`/${channel === 'B2B' ? 'b2b' : 'b2c'}-orders/${orderId}`);
  };

  // Submit Reject
  const handleConfirmReject = async () => {
    if (!rejectingOrderId) return;
    const finalReason = rejectReason.trim() || 'Rejected by Super Admin';
    try {
      await cancelOrderMutation.mutateAsync({ id: rejectingOrderId, reason: finalReason });
      message.info(`Order rejected with reason: ${finalReason}`);
      dismiss(rejectingOrderId);
      if (previewOrderId === rejectingOrderId) setPreviewOrderId(null);
      setRejectingOrderId(null);
      setRejectReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject order';
      message.error(msg);
    }
  };

  if (!order) return null;

  const isB2B = order.channel === 'B2B';
  const isCod = order.paymentMode === 'COD' || order.paymentMode === 'CREDIT';

  return (
    <>
      <Modal
        open={Boolean(order) && !previewOrderId}
        closable={false}
        footer={null}
        width={560}
        centered
        destroyOnClose={false}
        maskClosable={false}
        className="broadcast-modal-card"
        styles={{
          content: {
            padding: 0,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5)',
            border: '2px solid #16a34a',
          },
          mask: {
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)',
            padding: '16px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="broadcast-dot" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', color: '#ffffff' }}>
                  NEW ORDER BROADCAST
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '1px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  LIVE
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                Requires immediate action: Accept or Reject
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ElapsedTimer timestamp={currentAlert.receivedAt} />
            <Button
              size="small"
              type={isSilenced ? 'default' : 'primary'}
              danger={!isSilenced}
              icon={isSilenced ? <MutedOutlined /> : <SoundOutlined />}
              onClick={silence}
              style={{
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: isSilenced ? '1px solid rgba(255,255,255,0.4)' : undefined,
              }}
              title={isSilenced ? 'Alarm silenced' : 'Silence ringing alarm'}
            >
              {isSilenced ? 'Silenced' : 'Silence'}
            </Button>
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined style={{ color: '#ffffff', fontSize: 13 }} />}
              onClick={() => {
                silence();
                dismiss(order.id);
              }}
              style={{
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
              }}
              title="Close & Review Later"
            />
          </div>
        </div>

        {/* Multi-order Carousel Bar if queue > 1 */}
        {total > 1 && (
          <div
            style={{
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <Space size={6}>
              <Badge status="processing" color="#f97316" />
              <Text strong style={{ color: '#0f172a' }}>
                Order {currentIndex + 1} of {total} waiting in queue
              </Text>
            </Space>
            <Space size={4}>
              <Button
                size="small"
                icon={<LeftOutlined />}
                disabled={currentIndex === 0}
                onClick={() => setIndex(currentIndex - 1)}
              />
              <Button
                size="small"
                icon={<RightOutlined />}
                disabled={currentIndex === total - 1}
                onClick={() => setIndex(currentIndex + 1)}
              />
            </Space>
          </div>
        )}

        {/* Modal Main Content */}
        <div style={{ padding: '20px 22px 16px', backgroundColor: '#ffffff' }}>
          {/* Order Identity Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#0f172a',
                  fontFamily: 'monospace',
                }}
              >
                #{order.orderNumber}
              </span>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined style={{ color: '#64748b' }} />}
                onClick={() => {
                  void navigator.clipboard.writeText(order.orderNumber);
                  message.success('Order number copied');
                }}
              />
            </div>
            <Space>
              <Tag
                color={isB2B ? 'purple' : 'cyan'}
                style={{ fontWeight: 700, padding: '2px 10px', borderRadius: 6, fontSize: 12 }}
              >
                {isB2B ? 'B2B WHOLESALE' : 'B2C CONSUMER'}
              </Tag>
              {order.fulfillmentMethod && (
                <Tag
                  color={order.fulfillmentMethod === 'LOCAL' ? 'green' : 'blue'}
                  style={{ fontWeight: 600, borderRadius: 6 }}
                >
                  {order.fulfillmentMethod === 'LOCAL' ? '⚡ LOCAL DELIVERY' : '📦 SHIPROCKET'}
                </Tag>
              )}
            </Space>
          </div>

          {/* Customer & Location Details Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            <Row gutter={[16, 10]}>
              <Col span={14}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  Customer Name
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <UserOutlined style={{ color: '#16a34a' }} />
                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                    {order.customerName || 'Direct Customer'}
                  </Text>
                  {order.customerCode && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({order.customerCode})
                    </Text>
                  )}
                </div>
              </Col>
              <Col span={10}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  Fulfillment Node
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <ShopOutlined style={{ color: '#0284c7' }} />
                  <Text strong style={{ fontSize: 14, color: '#334155' }}>
                    {order.nodeName || 'Central Hub'}
                  </Text>
                </div>
              </Col>
            </Row>
          </div>

          {/* Amount & Payment Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: '1px solid #bbf7d0',
              borderRadius: 14,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                Total Payable Amount
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#14532d', lineHeight: 1.2 }}>
                {formatCurrency(order.total)}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: 4 }}>
                <Tag
                  color={isCod ? 'orange' : 'green'}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                  }}
                >
                  {order.paymentMode || (isCod ? 'CASH ON DELIVERY' : 'PREPAID ONLINE')}
                </Tag>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                Status: <Text strong style={{ color: order.paymentStatus === 'PAID' ? '#16a34a' : '#ea580c' }}>{order.paymentStatus}</Text>
              </div>
            </div>
          </div>

          {/* Action Buttons: Preview, Accept, Reject, Dismiss */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 10 }}>
            {/* Preview Button */}
            <Button
              size="large"
              icon={<EyeOutlined />}
              onClick={() => {
                silence();
                setPreviewOrderId(order.id);
              }}
              style={{
                borderRadius: 12,
                fontWeight: 600,
                height: 46,
                backgroundColor: '#f1f5f9',
                borderColor: '#cbd5e1',
                color: '#334155',
              }}
            >
              Preview
            </Button>

            {/* Accept (Confirm) Button */}
            <Button
              size="large"
              type="primary"
              icon={<CheckCircleOutlined style={{ fontSize: 18 }} />}
              loading={confirmOrderMutation.isPending}
              onClick={() => handleAccept(order.id, order.orderNumber)}
              style={{
                borderRadius: 12,
                fontWeight: 700,
                height: 46,
                fontSize: 15,
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                borderColor: '#15803d',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
              }}
            >
              Accept Order
            </Button>

            {/* Reject Button */}
            <Button
              size="large"
              danger
              icon={<CloseCircleOutlined />}
              loading={cancelOrderMutation.isPending}
              onClick={() => handleOpenReject(order.id)}
              style={{
                borderRadius: 12,
                fontWeight: 600,
                height: 46,
                borderColor: '#fca5a5',
                color: '#dc2626',
              }}
            >
              Reject
            </Button>
          </div>

          {/* Bottom Secondary Action: Dismiss */}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                silence();
                dismiss(order.id);
              }}
              style={{ color: '#94a3b8', fontSize: 12 }}
            >
              Review later in orders queue (Dismiss popup)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal / Drawer */}
      <OrderPreviewModal
        orderId={previewOrderId}
        onClose={handleClosePreview}
        onOpenOrderPage={handleOpenOrderPage}
        onAccept={(id, num) => handleAccept(id, num)}
        onReject={(id) => handleOpenReject(id)}
        isAccepting={confirmOrderMutation.isPending}
        isRejecting={cancelOrderMutation.isPending}
      />

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectingOrderId)}
        title={
          <Space>
            <WarningOutlined style={{ color: '#dc2626' }} />
            <span>Reject Order Reason</span>
          </Space>
        }
        onCancel={() => {
          setRejectingOrderId(null);
          setRejectReason('');
        }}
        onOk={handleConfirmReject}
        okText="Confirm Reject"
        okButtonProps={{ danger: true, loading: cancelOrderMutation.isPending }}
        centered
        destroyOnClose
      >
        <div style={{ marginTop: 8 }}>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            Select a common rejection reason or provide specific feedback to log against this order:
          </Paragraph>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {REJECT_REASONS.map((r) => (
              <Tag.CheckableTag
                key={r}
                checked={rejectReason === r}
                onChange={() => setRejectReason(r)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: rejectReason === r ? '#fee2e2' : '#f8fafc',
                  color: rejectReason === r ? '#b91c1c' : '#334155',
                  fontWeight: rejectReason === r ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {r}
              </Tag.CheckableTag>
            ))}
          </div>

          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Type specific reason for order rejection..."
            maxLength={300}
            showCount
          />
        </div>
      </Modal>
    </>
  );
}

/** Full Order Preview Modal for Admin inspection */
function OrderPreviewModal({
  orderId,
  onClose,
  onOpenOrderPage,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: {
  orderId: string | null;
  onClose: () => void;
  onOpenOrderPage: (orderId: string, channel: string) => void;
  onAccept: (orderId: string, orderNumber: string) => void;
  onReject: (orderId: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}) {
  const { data: order, isLoading } = useOrder(orderId ?? undefined);

  if (!orderId) return null;

  const itemsColumns: ColumnsType<OrderItem> = [
    {
      title: 'Item Details',
      key: 'product',
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {record.product?.name || 'Item'}
          </Text>
          {record.product?.sku && (
            <div style={{ fontSize: 11, color: '#64748b' }}>SKU: {record.product.sku}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 70,
      align: 'center',
      render: (qty: number) => <Tag color="blue">{qty}</Tag>,
    },
    {
      title: 'Rate',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 90,
      align: 'right',
      render: (val: string) => formatCurrency(Number(val) || 0),
    },
    {
      title: 'Total',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      width: 100,
      align: 'right',
      render: (val: string) => <Text strong>{formatCurrency(Number(val) || 0)}</Text>,
    },
  ];

  return (
    <Modal
      open={Boolean(orderId)}
      onCancel={onClose}
      width={720}
      styles={{
        content: {
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)',
        },
        mask: {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
        },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <EyeOutlined style={{ color: '#16a34a' }} />
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              Order Preview #{order?.orderNumber || '...'}
            </span>
          </Space>
          {order && (
            <Tag color={order.channel === 'B2B' ? 'purple' : 'cyan'}>
              {order.channel}
            </Tag>
          )}
        </div>
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Button onClick={onClose}>Close & Review Later</Button>
            {order && (
              <Button
                icon={<ExportOutlined />}
                onClick={() => onOpenOrderPage(order.id, order.channel)}
              >
                Go to Order Page
              </Button>
            )}
          </Space>
          <Space>
            <Button
              danger
              loading={isRejecting}
              onClick={() => {
                onClose();
                onReject(orderId);
              }}
            >
              Reject Order
            </Button>
            <Button
              type="primary"
              loading={isAccepting}
              icon={<CheckCircleOutlined />}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => {
                if (order) onAccept(order.id, order.orderNumber);
              }}
            >
              Accept & Confirm Order
            </Button>
          </Space>
        </div>
      }
      centered
      destroyOnClose
    >
      {isLoading || !order ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading complete order details..." />
        </div>
      ) : (
        <div style={{ maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
          {/* Quick Info Grid */}
          <Descriptions
            bordered
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
            labelStyle={{ background: '#f8fafc', fontWeight: 600, width: '28%' }}
          >
            <Descriptions.Item label="Customer">
              <Text strong>{order.customer?.name || order.customerId}</Text>
              {order.customer?.phone && (
                <div style={{ fontSize: 12, color: '#64748b' }}>📞 {order.customer.phone}</div>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Placed At">
              {formatDateTime(order.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Address" span={2}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <EnvironmentOutlined style={{ color: '#16a34a', marginTop: 3 }} />
                <span>{order.deliveryAddress || 'Standard Storefront Address'}</span>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Fulfillment">
              <Tag color={order.fulfillmentMethod === 'LOCAL' ? 'green' : 'blue'}>
                {order.fulfillmentMethod || 'LOCAL'}
              </Tag>
              {order.warehouse?.name && <Text type="secondary">({order.warehouse.name})</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Payment Details">
              <Space>
                <Tag color={order.paymentMode === 'COD' ? 'orange' : 'green'}>
                  {order.paymentMode || 'ONLINE'}
                </Tag>
                <Tag color={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                  {order.paymentStatus}
                </Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          {/* Items Table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b' }}>
              Ordered Items ({order.items?.length || 0})
            </div>
            <Table
              size="small"
              rowKey="id"
              dataSource={order.items || []}
              columns={itemsColumns}
              pagination={false}
              bordered
            />
          </div>

          {/* Financial Calculation Summary */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <Row justify="space-between" style={{ marginBottom: 4 }}>
              <Col><Text type="secondary">Subtotal</Text></Col>
              <Col><Text>{formatCurrency(Number(order.subtotal) || 0)}</Text></Col>
            </Row>
            {Number(order.discountTotal) > 0 && (
              <Row justify="space-between" style={{ marginBottom: 4 }}>
                <Col><Text type="secondary">Discount {order.couponCode ? `(${order.couponCode})` : ''}</Text></Col>
                <Col><Text type="danger">-{formatCurrency(Number(order.discountTotal))}</Text></Col>
              </Row>
            )}
            {Number(order.deliveryFee) > 0 && (
              <Row justify="space-between" style={{ marginBottom: 4 }}>
                <Col><Text type="secondary">Delivery Fee</Text></Col>
                <Col><Text>{formatCurrency(Number(order.deliveryFee))}</Text></Col>
              </Row>
            )}
            <Row justify="space-between" style={{ marginBottom: 6 }}>
              <Col><Text type="secondary">GST Taxes</Text></Col>
              <Col><Text>{formatCurrency(Number(order.taxTotal) || 0)}</Text></Col>
            </Row>
            <Divider style={{ margin: '8px 0' }} />
            <Row justify="space-between" align="middle">
              <Col><Text strong style={{ fontSize: 16 }}>Grand Total</Text></Col>
              <Col>
                <Text strong style={{ fontSize: 20, color: '#16a34a' }}>
                  {formatCurrency(Number(order.total) || 0)}
                </Text>
              </Col>
            </Row>
          </div>

          {order.notes && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7' }}>
              <Text strong style={{ fontSize: 12, color: '#b45309' }}>Order Notes / Instructions:</Text>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>{order.notes}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
