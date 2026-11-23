import { useQuery } from '@tanstack/react-query';
import { Alert, Descriptions, Drawer, Image, Space, Spin, Tag, Typography } from 'antd';
import { COLLECTION_PAYMENT_METHODS, collectionsApi, type CollectionPaymentMethod } from '../../../../shared/api/collections';
import { PAYMENT_STATUS_COLOUR } from '@shared/utils/paymentStatus';
import { transportSourceText } from '../../components/TransportSourceFields';
import { EM_DASH, formatCurrency, formatDate, formatQuantity } from '../../utils/format';

const cap = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const or = (v: unknown) => (v === null || v === undefined || v === '' ? EM_DASH : String(v));

/** Everything recorded for one collection, including the payment proof. */
export function CollectionDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['collections', 'detail', id],
    queryFn: () => collectionsApi.get(id!),
    enabled: !!id,
  });
  const c = q.data;
  const proof = c?.paymentProofUrl;
  const proofIsPdf = !!proof && /\.pdf($|\?)/i.test(proof);

  return (
    <Drawer open={!!id} onClose={onClose} width={640} title={c ? `Collection ${c.receiptNumber}` : 'Collection'}>
      {q.isLoading ? <Spin /> : null}
      {q.error ? <Alert type="error" message="Could not load this collection" /> : null}
      {c ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions title="Collection" column={2} bordered size="small">
            <Descriptions.Item label="Receipt">
              <Typography.Text code>{c.receiptNumber}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Raw batch">
              {c.batch ? <Typography.Text code>{c.batch.batchNumber}</Typography.Text> : EM_DASH}
            </Descriptions.Item>
            <Descriptions.Item label="Farmer" span={2}>
              {c.farmer?.fullName} {c.farmer?.farmerCode ? <Typography.Text type="secondary">({c.farmer.farmerCode})</Typography.Text> : null}
              {c.farmer?.village ? <Typography.Text type="secondary"> · {c.farmer.village}</Typography.Text> : null}
            </Descriptions.Item>
            <Descriptions.Item label="Crop">{c.cropName}</Descriptions.Item>
            <Descriptions.Item label="Branch">{or(c.branch?.name)}</Descriptions.Item>
            <Descriptions.Item label="Collected on">{formatDate(c.collectionDate)}</Descriptions.Item>
            <Descriptions.Item label="Collected by">{or(c.collectedBy?.fullName)}</Descriptions.Item>
            <Descriptions.Item label="Location / remarks" span={2}>{or(c.collectionLocation)}</Descriptions.Item>
          </Descriptions>

          <Descriptions title="Weight & amount" column={2} bordered size="small">
            <Descriptions.Item label="Gross weight">{formatQuantity(c.grossWeight, c.unit)}</Descriptions.Item>
            <Descriptions.Item label="Net weight">{formatQuantity(c.netWeight, c.unit)}</Descriptions.Item>
            <Descriptions.Item label="Rate">{formatCurrency(c.purchaseRate)} / {c.unit}</Descriptions.Item>
            <Descriptions.Item label="Total">
              <Typography.Text strong>{formatCurrency(c.totalAmount)}</Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          <Descriptions title="Payment" column={2} bordered size="small">
            <Descriptions.Item label="Status">
              <Tag color={PAYMENT_STATUS_COLOUR[c.paymentStatus]}>{cap(c.paymentStatus)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Method">
              {c.paymentMethod ? COLLECTION_PAYMENT_METHODS[c.paymentMethod as CollectionPaymentMethod] ?? c.paymentMethod : EM_DASH}
            </Descriptions.Item>
            <Descriptions.Item label="Amount paid">{c.paidAmount ? formatCurrency(c.paidAmount) : EM_DASH}</Descriptions.Item>
            <Descriptions.Item label="Payment date">{c.paymentDate ? formatDate(c.paymentDate) : EM_DASH}</Descriptions.Item>
            <Descriptions.Item label="UTR / Txn / Cheque" span={2}>{or(c.paymentReference)}</Descriptions.Item>
            <Descriptions.Item label="Remarks" span={2}>{or(c.paymentRemarks)}</Descriptions.Item>
            <Descriptions.Item label="Updated by" span={2}>
              {c.paymentUpdatedBy?.fullName ?? EM_DASH}
              {c.paymentUpdatedAt ? <Typography.Text type="secondary"> · {formatDate(c.paymentUpdatedAt)}</Typography.Text> : null}
            </Descriptions.Item>
            <Descriptions.Item label="Proof" span={2}>
              {!proof ? (
                <Typography.Text type="secondary">No proof uploaded</Typography.Text>
              ) : proofIsPdf ? (
                <Typography.Link href={proof} target="_blank" rel="noreferrer">Open proof (PDF)</Typography.Link>
              ) : (
                <Space direction="vertical">
                  <Image src={proof} width={220} alt="Payment proof" />
                  <Typography.Link href={proof} target="_blank" rel="noreferrer">Open full size</Typography.Link>
                </Space>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions title="Transport" column={2} bordered size="small">
            <Descriptions.Item label="Source" span={2}>{or(transportSourceText(c))}</Descriptions.Item>
            <Descriptions.Item label="Vehicle">{or(c.vehicleNumber)}</Descriptions.Item>
            <Descriptions.Item label="Driver">
              {or(c.driverName)}{c.driverPhone ? ` · ${c.driverPhone}` : ''}
            </Descriptions.Item>
          </Descriptions>

          {c.inspection ? (
            <Descriptions title="Harvest inspection" column={2} bordered size="small">
              <Descriptions.Item label="Result">{cap(c.inspection.result)}</Descriptions.Item>
              <Descriptions.Item label="Inspected on">{formatDate(c.inspection.inspectionDate)}</Descriptions.Item>
              <Descriptions.Item label="Moisture">{c.inspection.moistureLevel ? `${c.inspection.moistureLevel}%` : EM_DASH}</Descriptions.Item>
              <Descriptions.Item label="Foreign matter">{c.inspection.foreignMatter ? `${c.inspection.foreignMatter}%` : EM_DASH}</Descriptions.Item>
              <Descriptions.Item label="Grain size">{or(c.inspection.grainSize)}</Descriptions.Item>
              <Descriptions.Item label="Grain colour">{or(c.inspection.grainColor)}</Descriptions.Item>
            </Descriptions>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  );
}
