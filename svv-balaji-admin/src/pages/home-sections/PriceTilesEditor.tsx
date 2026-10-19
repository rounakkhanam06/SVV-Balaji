import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, InputNumber, Modal, Radio, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { Category, HomePriceTile, PriceTileColor, Product } from '@shared/api/types';
import { ProductPicker } from './ProductPicker';

const { Text } = Typography;

/** Same gradients the storefront draws, so the preview here matches the homepage. */
export const PRICE_TILE_GRADIENTS: Record<PriceTileColor, string> = {
  purple: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  orange: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  green: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  blue: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
  red: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
  teal: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
};
const COLORS = Object.keys(PRICE_TILE_GRADIENTS) as PriceTileColor[];

interface PriceTilesEditorProps {
  value?: HomePriceTile[];
  onChange?: (tiles: HomePriceTile[]) => void;
  categories: Category[];
  products?: Product[];
}

export function PriceTilesEditor({ value, onChange, categories, products = [] }: PriceTilesEditorProps) {
  const tiles = value ?? [];
  const [productModalTileIndex, setProductModalTileIndex] = useState<number | null>(null);

  const categoryOptions = useMemo(() => {
    const mains = categories.filter((c) => !c.parentId).sort((a, b) => a.displayOrder - b.displayOrder);
    return mains.map((m) => ({
      label: m.name,
      options: [
        { value: m.id, label: `${m.name} (all)` },
        ...categories
          .filter((c) => c.parentId === m.id)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((c) => ({ value: c.id, label: `${m.name} › ${c.name}` })),
      ],
    }));
  }, [categories]);

  const patch = (i: number, p: Partial<HomePriceTile>) =>
    onChange?.(tiles.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...tiles];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange?.(next);
  };
  const add = () =>
    onChange?.([
      ...tiles,
      { label: 'Starting from', price: 99, subtitle: '', emoji: '🛒', color: COLORS[tiles.length % COLORS.length], categoryId: null, productIds: [] },
    ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tiles.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tiles yet - add one below" style={{ margin: 8 }} />
      )}
      {tiles.map((t, i) => {
        const hasProducts = Array.isArray(t.productIds) && t.productIds.length > 0;
        const targetMode = hasProducts ? 'products' : 'category';

        return (
          <div key={i} style={{ display: 'flex', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fafafa' }}>
            {/* Live preview */}
            <div
              style={{
                width: 130,
                flexShrink: 0,
                borderRadius: 12,
                padding: 12,
                color: '#fff',
                background: PRICE_TILE_GRADIENTS[t.color] ?? PRICE_TILE_GRADIENTS.orange,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 110,
              }}
            >
              <div style={{ position: 'absolute', bottom: -8, right: -6, fontSize: 40, opacity: 0.2 }}>{t.emoji}</div>
              <div>
                <div style={{ fontSize: 10, opacity: 0.9 }}>{t.label || 'Starting from'}</div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>₹{t.price ?? 0}</div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4, lineHeight: 1.2 }}>{t.subtitle || 'Subtitle'}</div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  style={{ width: '40%' }}
                  value={t.label}
                  maxLength={40}
                  placeholder="Starting from"
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
                <InputNumber
                  style={{ width: '30%' }}
                  prefix="₹"
                  min={0}
                  value={t.price}
                  onChange={(v) => patch(i, { price: v ?? 0 })}
                />
                <Input
                  style={{ width: '30%' }}
                  value={t.emoji}
                  maxLength={8}
                  placeholder="Emoji"
                  onChange={(e) => patch(i, { emoji: e.target.value })}
                />
              </Space.Compact>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  style={{ flex: 1 }}
                  value={t.subtitle}
                  maxLength={60}
                  placeholder="e.g. Namkeens & snacks"
                  onChange={(e) => patch(i, { subtitle: e.target.value })}
                  status={t.subtitle?.trim() ? undefined : 'warning'}
                />
                <Space size={4}>
                  {COLORS.map((c) => (
                    <Tooltip key={c} title={c}>
                      <button
                        type="button"
                        aria-label={c}
                        onClick={() => patch(i, { color: c })}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          background: PRICE_TILE_GRADIENTS[c],
                          border: t.color === c ? '2px solid #0f172a' : '2px solid transparent',
                          outline: t.color === c ? '1px solid #fff' : 'none',
                          outlineOffset: -3,
                        }}
                      />
                    </Tooltip>
                  ))}
                </Space>
              </div>

              {/* Click Target / Product Selection Mode */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                    ON CLICK DESTINATION:
                  </Text>
                  <Radio.Group
                    size="small"
                    value={targetMode}
                    onChange={(e) => {
                      if (e.target.value === 'products') {
                        patch(i, { categoryId: null, productIds: t.productIds ?? [] });
                        setProductModalTileIndex(i);
                      } else {
                        patch(i, { productIds: [] });
                      }
                    }}
                  >
                    <Radio.Button value="category">
                      <Space size={4}>
                        <AppstoreOutlined />
                        <span>Category</span>
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="products">
                      <Space size={4}>
                        <ShoppingOutlined />
                        <span>Specific Products</span>
                      </Space>
                    </Radio.Button>
                  </Radio.Group>
                </div>

                {targetMode === 'category' ? (
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Opens: all products in category"
                    style={{ width: '100%' }}
                    options={categoryOptions}
                    value={t.categoryId ?? undefined}
                    onChange={(v) => patch(i, { categoryId: v ?? null, productIds: [] })}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Space size={6}>
                      <Tag color={t.productIds && t.productIds.length > 0 ? 'blue' : 'warning'} style={{ margin: 0, fontWeight: 600 }}>
                        {t.productIds && t.productIds.length > 0
                          ? `🛍️ ${t.productIds.length} custom product${t.productIds.length === 1 ? '' : 's'} selected`
                          : '⚠️ No products selected yet'}
                      </Tag>
                    </Space>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<ShoppingOutlined />}
                      onClick={() => setProductModalTileIndex(i)}
                    >
                      {t.productIds && t.productIds.length > 0 ? 'Change Products' : 'Select Products'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === tiles.length - 1} onClick={() => move(i, 1)} />
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange?.(tiles.filter((_, idx) => idx !== i))} />
            </div>
          </div>
        );
      })}

      <Button icon={<PlusOutlined />} onClick={add} disabled={tiles.length >= 12} block type="dashed">
        Add tile
      </Button>

      <Text type="secondary" style={{ fontSize: 12 }}>
        Configure each tile with an attractive starting price and choose whether clicking it opens a <strong>Category</strong> or displays <strong>Specific Products</strong>.
      </Text>

      {/* Modal for Selecting Specific Products */}
      <Modal
        title={
          <Space>
            <ShoppingOutlined style={{ color: '#ea580c' }} />
            <span>
              Select Products for &ldquo;{productModalTileIndex !== null ? tiles[productModalTileIndex]?.subtitle || tiles[productModalTileIndex]?.label : ''}&rdquo;
            </span>
          </Space>
        }
        open={productModalTileIndex !== null}
        onOk={() => setProductModalTileIndex(null)}
        onCancel={() => setProductModalTileIndex(null)}
        width={850}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnClose
      >
        {productModalTileIndex !== null && (
          <div style={{ marginTop: 12 }}>
            <ProductPicker
              products={products}
              categories={categories}
              value={tiles[productModalTileIndex]?.productIds ?? []}
              onChange={(ids) => patch(productModalTileIndex, { productIds: ids })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
