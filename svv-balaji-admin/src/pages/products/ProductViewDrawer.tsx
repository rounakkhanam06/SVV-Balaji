import { Alert, Badge, Descriptions, Drawer, Empty, Image, Space, Spin, Table, Tag, Typography } from 'antd';
import { apiErrorMessage } from '../../api/client';
import type { LivePriceRule } from '../../api/types';
import { useProduct } from '../../hooks/useProduction';
import { EM_DASH, formatCurrency } from '../../utils/format';

const { Text, Title, Paragraph } = Typography;

const show = (v: unknown) => (v === null || v === undefined || v === '' ? EM_DASH : String(v));

function PriceTable({ rules, unit }: { rules: LivePriceRule[]; unit: string }) {
  if (!rules.length) return <Text type="secondary">No price set</Text>;
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={rules}
      columns={[
        { title: 'From qty', dataIndex: 'minQuantity', render: (q: number) => `${q} ${unit}` },
        { title: 'Price / unit (excl. GST)', dataIndex: 'unitPrice', render: (p: number) => formatCurrency(p) },
        { title: 'GST', dataIndex: 'gstRatePercent', render: (g: number) => `${g}%` },
        { title: 'Customer type', dataIndex: 'customerType', render: (c: string | null) => c ?? 'All' },
      ]}
    />
  );
}

/** Read-only view of everything saved on a product. Editing stays on the edit page. */
export function ProductViewDrawer({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const q = useProduct(productId ?? undefined);
  const p = q.data;

  return (
    <Drawer open={Boolean(productId)} onClose={onClose} width={820} title={p ? p.name : 'Product'}>
      {q.isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : q.error ? (
        <Alert type="error" showIcon message={apiErrorMessage(q.error)} />
      ) : !p ? (
        <Empty />
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {p.images?.length ? (
            <Image.PreviewGroup>
              <Space wrap>
                {p.images.map((src) => (
                  <Image key={src} src={src} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </Space>
            </Image.PreviewGroup>
          ) : null}

          <Descriptions bordered size="small" column={2} title="Basics">
            <Descriptions.Item label="SKU">{p.sku}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {p.isActive ? <Badge status="success" text="Active" /> : <Badge status="error" text="Discontinued" />}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              {p.category ? `${p.category.parent ? `${p.category.parent.name} › ` : ''}${p.category.name}` : 'Uncategorised'}
            </Descriptions.Item>
            <Descriptions.Item label="Storefront">{p.showOnStorefront ? <Tag color="green">Live</Tag> : <Tag>Hidden</Tag>}</Descriptions.Item>
            <Descriptions.Item label="Brand">{show(p.brand)}</Descriptions.Item>
            <Descriptions.Item label="Pack">{show(p.packLabel)}</Descriptions.Item>
            <Descriptions.Item label="Unit">{p.unit}</Descriptions.Item>
            <Descriptions.Item label="Pack weight">{p.packWeightKg ? `${p.packWeightKg} kg` : EM_DASH}</Descriptions.Item>
            <Descriptions.Item label="MRP">{p.mrp ? formatCurrency(p.mrp) : EM_DASH}</Descriptions.Item>
            <Descriptions.Item label="HSN code">{show(p.hsnCode)}</Descriptions.Item>
            <Descriptions.Item label="Badge">{show(p.badge)}</Descriptions.Item>
            <Descriptions.Item label="Flags">
              <Space size={4} wrap>
                {p.isTopPick ? <Tag color="gold">Top pick</Tag> : null}
                {p.isDailyStaple ? <Tag color="blue">Daily staple</Tag> : null}
                {p.allowBackorder ? <Tag>Backorder OK</Tag> : null}
                {p.bulkAvailable ? <Tag>Bulk available</Tag> : null}
                {p.gstInvoiceAvailable ? <Tag>GST invoice</Tag> : null}
              </Space>
            </Descriptions.Item>
          </Descriptions>

          {p.description ? (
            <div>
              <Title level={5}>Description</Title>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{p.description}</Paragraph>
            </div>
          ) : null}

          {p.highlights?.length ? (
            <div>
              <Title level={5}>Highlights</Title>
              <ul style={{ margin: 0 }}>{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          ) : null}

          <div>
            <Title level={5}>Prices today</Title>
            <Text strong>Consumer (B2C)</Text>
            <PriceTable rules={p.pricing?.B2C ?? []} unit={p.unit} />
            <div style={{ height: 12 }} />
            <Text strong>Wholesale (B2B)</Text>
            <PriceTable rules={p.pricing?.B2B ?? []} unit={p.unit} />
          </div>

          {p.variants?.length ? (
            <div>
              <Title level={5}>Pack sizes</Title>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={p.variants}
                columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'SKU', dataIndex: 'sku' },
                  { title: 'MRP', dataIndex: 'mrp', render: (m: string | null) => (m ? formatCurrency(m) : EM_DASH) },
                  {
                    title: 'B2C price',
                    key: 'b2c',
                    render: (_, v) => {
                      const r = p.pricing?.variants.find((x) => x.id === v.id)?.B2C[0];
                      return r ? formatCurrency(r.unitPrice) : EM_DASH;
                    },
                  },
                  { title: 'Status', dataIndex: 'isActive', render: (a: boolean) => (a ? 'Active' : 'Inactive') },
                ]}
              />
            </div>
          ) : null}

          <Descriptions bordered size="small" column={2} title="Ordering & stock">
            <Descriptions.Item label="Min order (B2C)">{show(p.minOrderQuantity)}</Descriptions.Item>
            <Descriptions.Item label="Max order (B2C)">{show(p.maxOrderQuantity)}</Descriptions.Item>
            <Descriptions.Item label="MOQ (B2B)">{show(p.moqB2B)}</Descriptions.Item>
            <Descriptions.Item label="Max order (B2B)">{show(p.maxOrderQuantityB2B)}</Descriptions.Item>
            <Descriptions.Item label="Box size">{show(p.packBoxSize)}</Descriptions.Item>
            <Descriptions.Item label="Return window">{p.returnWindowDays != null ? `${p.returnWindowDays} days` : EM_DASH}</Descriptions.Item>
            <Descriptions.Item label="Reorder point">{show(p.reorderPoint)}</Descriptions.Item>
            <Descriptions.Item label="Safety stock">{show(p.safetyStock)}</Descriptions.Item>
          </Descriptions>

          {p.specifications?.length ? (
            <Descriptions bordered size="small" column={1} title="Specifications">
              {p.specifications.map((s, i) => (
                <Descriptions.Item key={s.id ?? i} label={s.label}>{s.value}</Descriptions.Item>
              ))}
            </Descriptions>
          ) : null}

          <Descriptions bordered size="small" column={1} title="More details">
            <Descriptions.Item label="Manufacturer">{show(p.manufacturer)}</Descriptions.Item>
            <Descriptions.Item label="Country of origin">{show(p.countryOfOrigin)}</Descriptions.Item>
            <Descriptions.Item label="Shelf life">{show(p.shelfLife)}</Descriptions.Item>
            <Descriptions.Item label="Return policy">{show(p.returnPolicy)}</Descriptions.Item>
            <Descriptions.Item label="Disclaimer">{show(p.disclaimer)}</Descriptions.Item>
            <Descriptions.Item label="How it's made">
              {p.howItsMadeUrl ? <a href={p.howItsMadeUrl} target="_blank" rel="noreferrer">{p.howItsMadeUrl}</a> : EM_DASH}
            </Descriptions.Item>
            <Descriptions.Item label="Recipes">
              {p.recipes?.length ? p.recipes.map((r) => <Tag key={r.id}>{r.recipeCode} v{r.version} · {r.status}</Tag>) : EM_DASH}
            </Descriptions.Item>
          </Descriptions>

          {p.faqs?.length ? (
            <div>
              <Title level={5}>FAQs</Title>
              {p.faqs.map((f, i) => (
                <div key={f.id ?? i} style={{ marginBottom: 8 }}>
                  <Text strong>{f.question}</Text>
                  <Paragraph type="secondary" style={{ margin: 0 }}>{f.answer}</Paragraph>
                </div>
              ))}
            </div>
          ) : null}
        </Space>
      )}
    </Drawer>
  );
}
