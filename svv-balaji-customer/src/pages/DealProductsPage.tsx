import {
  ArrowLeftOutlined,
  MinusOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { Badge, Button, Empty, Skeleton, Typography } from 'antd';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCart } from '../cart/useCart';
import { RatingBadge } from '../components/ProductReviews';
import { useCatalogueProducts, type ShelfProduct } from '../hooks/useCatalogue';
import { DesktopPageHeader } from '../layout/DesktopPageHeader';
import { formatInr } from '../utils/money';

const PRICE_TILE_GRADIENTS: Record<string, string> = {
  purple: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  orange: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  green: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  blue: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
  red: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
  teal: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
};

export function DealProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useCustomerAuth();
  const isRetailer = role === 'RETAILER';
  const cart = useCart();

  const title = searchParams.get('title') || 'Featured Deals';
  const subtitle = searchParams.get('subtitle');
  const price = searchParams.get('price');
  const emoji = searchParams.get('emoji') || '🔥';
  const color = searchParams.get('color') || 'orange';

  const productIds = useMemo(() => {
    const raw = searchParams.get('ids');
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams]);

  const { products, isLoading, isError, refetch } = useCatalogueProducts(
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );

  const gradient = PRICE_TILE_GRADIENTS[color] ?? PRICE_TILE_GRADIENTS.orange;

  const inCartQty = (id: string) => cart.lines.find((l) => l.productId === id)?.quantity ?? 0;

  const handleAddToCart = (p: ShelfProduct) => {
    cart.add(
      {
        productId: p.id,
        productName: p.name,
        unit: p.variant || p.weight || p.unit,
        displayUnitPrice: p.price,
        imageUrl: p.image,
        mrp: p.mrp,
        moqB2B: p.moqB2B ?? 1,
        minOrderQuantity: p.minOrderQuantity ?? 1,
      },
      isRetailer ? (p.moqB2B ?? 1) : 1,
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 80 }}>
      {/* Desktop Header */}
      <div className="desktop-only">
        <DesktopPageHeader
          title={title}
          subtitle={subtitle || (price ? `Starting from ${formatInr(Number(price))}` : 'Hand-picked products for this offer')}
          crumbs={[{ label: 'Deals', to: '/' }, { label: title }]}
        />
      </div>

      {/* Mobile Sticky Header */}
      <div className="mobile-only">
        <header
          className="store-safe-top"
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
            >
              <ArrowLeftOutlined style={{ fontSize: 18, color: '#0f172a' }} />
            </button>
            <div>
              <Typography.Title level={5} style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700 }}>
                {title}
              </Typography.Title>
            </div>
          </div>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/cart')}>
            <Badge count={cart.count} size="small" offset={[-2, 2]} color="#ea580c">
              <ShoppingCartOutlined style={{ fontSize: 22, color: '#0f172a' }} />
            </Badge>
          </div>
        </header>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
        {/* Deal Hero Banner */}
        <div
          style={{
            background: gradient,
            borderRadius: 18,
            padding: '20px 24px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ position: 'absolute', bottom: -10, right: 10, fontSize: 80, opacity: 0.25, userSelect: 'none' }}>
            {emoji}
          </div>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '80%' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <TagOutlined />
              <span>SPECIAL OFFER DEALS</span>
            </div>
            <Typography.Title level={3} style={{ color: '#ffffff', margin: '0 0 4px', fontWeight: 800 }}>
              {emoji} {title}
            </Typography.Title>
            {subtitle ? (
              <Typography.Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 600, display: 'block' }}>
                {subtitle} {price ? `• Starting from ${formatInr(Number(price))}` : ''}
              </Typography.Text>
            ) : price ? (
              <Typography.Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: 600 }}>
                Hand-picked selection starting from <strong>{formatInr(Number(price))}</strong>
              </Typography.Text>
            ) : null}
          </div>
        </div>

        {/* Product Cards Container */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', padding: 12, borderRadius: 14 }}>
                <Skeleton.Image style={{ width: '100%', height: 110, borderRadius: 10 }} active />
                <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 12 }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', background: '#fff', borderRadius: 16 }}>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Failed to load deal products. Please check your connection.
            </Typography.Text>
            <Button onClick={() => void refetch()}>Try Again</Button>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', background: '#fff', borderRadius: 16 }}>
            <Empty
              description={
                <div>
                  <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>
                    No products assigned to this offer yet
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Please check back soon or browse our full catalogue.
                  </Typography.Text>
                </div>
              }
            >
              <Button type="primary" onClick={() => navigate('/categories')} style={{ background: '#ea580c', borderColor: '#ea580c' }}>
                Browse All Categories
              </Button>
            </Empty>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>
                Showing {products.length} deal product{products.length === 1 ? '' : 's'}
              </Typography.Text>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 14,
              }}
            >
              {products.map((p) => {
                const qty = inCartQty(p.id);
                return (
                  <div
                    key={p.id}
                    className="product-card-hover"
                    style={{
                      background: '#ffffff',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <Link
                      to={`/product-detail/${p.slug}`}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                    >
                      <div
                        style={{
                          height: 110,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                          background: '#f8fafc',
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={p.image}
                          alt={p.name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                        />
                      </div>
                      <Typography.Text
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0f172a',
                          lineHeight: 1.3,
                          height: 34,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {p.name}
                      </Typography.Text>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {p.weight && (
                          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                            {p.weight}
                          </Typography.Text>
                        )}
                        {p.rating && p.reviewCount ? (
                          <RatingBadge rating={p.rating} count={p.reviewCount} />
                        ) : null}
                      </div>
                    </Link>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                        <Typography.Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                          {p.price !== null ? formatInr(p.price) : 'N/A'}
                        </Typography.Text>
                        {p.mrp && (
                          <Typography.Text delete type="secondary" style={{ fontSize: 11.5 }}>
                            {formatInr(p.mrp)}
                          </Typography.Text>
                        )}
                      </div>

                      {p.purchasable ? (
                        qty > 0 ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#fff7ed',
                              border: '1.5px solid #ea580c',
                              borderRadius: 8,
                              height: 32,
                              padding: '0 4px',
                            }}
                          >
                            <button
                              onClick={() => cart.remove(p.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', color: '#ea580c' }}
                            >
                              <MinusOutlined style={{ fontSize: 11 }} />
                            </button>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#ea580c' }}>{qty}</span>
                            <button
                              onClick={() => handleAddToCart(p)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', color: '#ea580c' }}
                            >
                              <PlusOutlined style={{ fontSize: 11 }} />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="primary"
                            block
                            size="small"
                            onClick={() => handleAddToCart(p)}
                            style={{
                              background: '#ea580c',
                              borderColor: '#ea580c',
                              borderRadius: 8,
                              fontWeight: 700,
                              height: 32,
                              fontSize: 12,
                            }}
                          >
                            ADD
                          </Button>
                        )
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', height: 32, lineHeight: '32px' }}>
                          Out of stock
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
