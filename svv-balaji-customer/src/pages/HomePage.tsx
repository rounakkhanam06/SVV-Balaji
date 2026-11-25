import {
  BarcodeOutlined,
  BellOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  EnvironmentOutlined,
  FireFilled,
  GiftFilled,
  MinusOutlined,
  PlusOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateFilled,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  ThunderboltFilled,
  TruckFilled,
  UserOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Badge, Button, Carousel, Input, InputNumber, Typography } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStorefrontBanners } from '@shared/hooks/useBanners';
import { useStorefrontSchemes } from '@shared/hooks/useSchemes';
import { useStorefrontHomeSections } from '@shared/hooks/useHomeSections';
import { api as storefrontApi } from '../api/client';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCart } from '../cart/useCart';
import { toShelfProduct, useCatalogueProducts, type ShelfProduct } from '../hooks/useCatalogue';
import type { StorefrontHomeSection } from '@shared/api/types';
import { useCategoryTreeQuery } from '../hooks/useCategoryTree';
// Order history is still mock (no storefront order backend yet). Only its
// "what and how much was last ordered" survives - names, prices and images are
// re-read from the live catalogue below, so an admin edit reaches this shelf too.
import { lastOrderedLabel, useBuyAgain } from '../hooks/useBuyAgain';
import { formatInr } from '../utils/money';
import { RatingBadge } from '../components/ProductReviews';
import { useUnreadNotifications } from '../notifications/useUnreadNotifications';
import { LocationPicker } from '../location/LocationPicker';
import { locationLine, useShopperLocation } from '../location/useShopperLocation';


interface HeroSlide {
  id: string;
  /** IMAGE_ONLY = finished artwork (1600x600), drawn as-is. */
  layout?: 'TEXT' | 'IMAGE_ONLY';
  badgeText?: string | null;
  title: string;
  description: string;
  imageUrl: string;
  ctaTextPrimary: string;
  ctaLinkPrimary: string;
  ctaTextSecondary?: string | null;
  ctaLinkSecondary?: string | null;
  background: string;
}

/** Shown only while no HOMEPAGE banner has been published from Admin > Banner Management yet. */
const FALLBACK_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'fallback-1',
    badgeText: '100% FARM-TRACEABLE STAPLES',
    title: 'Direct From Verified Mandis to Your Store',
    description: 'Staples milled from crops bought directly from farmers - every pack traceable by its batch QR.',
    imageUrl: '/images/welcome_3d.jpg',
    ctaTextPrimary: 'Explore Catalog',
    ctaLinkPrimary: '/categories',
    ctaTextSecondary: 'Trace A Batch',
    ctaLinkSecondary: '/trace',
    background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)',
  },
];

export function HomePage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { role, customerProfile, retailerProfile, isLoggedIn } = useCustomerAuth();
  const unreadNotifications = useUnreadNotifications();
  const isRetailer = role === 'RETAILER';
  const [traceInput, setTraceInput] = useState('');
  const shopperLocation = useShopperLocation();
  const [pickingLocation, setPickingLocation] = useState(false);
  // A retailer with no location yet is asked once per visit; the browser's own
  // permission prompt only appears if they tap "Use my current location".
  useEffect(() => {
    if (!isRetailer || shopperLocation) return;
    try {
      if (sessionStorage.getItem('svv.locationAsked')) return;
      sessionStorage.setItem('svv.locationAsked', '1');
    } catch {
      // storage blocked: still ask, just not remembered
    }
    setPickingLocation(true);
  }, [isRetailer, shopperLocation]);
  const { categories, isLoading: categoriesLoading } = useCategoryTreeQuery();

  // Product shelves come from Admin > Homepage Sections (below). Buy Again is
  // this shopper's own order history, priced live; nothing for a guest.
  const { items: buyAgain } = useBuyAgain();

  // While the request is in flight show a placeholder, not the built-in
  // fallback slides - those flashed for a moment before the real banners.
  const { data: publishedBanners, isLoading: bannersLoading } = useStorefrontBanners(
    'HOMEPAGE',
    isRetailer ? 'B2B' : 'B2C',
    storefrontApi,
  );
  // Deliberately no mock fallback here: an empty result is Super Admin
  // choosing to hide the "Today's Schemes & Offers" section, not a loading
  // gap, so the section renders nothing rather than substituting placeholder
  // content. See shared/hooks/useSchemes.ts.
  const { data: schemes = [] } = useStorefrontSchemes(isRetailer ? 'B2B' : 'B2C', storefrontApi);
  const { data: managedSections = [] } = useStorefrontHomeSections(isRetailer ? 'B2B' : 'B2C', storefrontApi);
  const heroSlides: HeroSlide[] =
    publishedBanners && publishedBanners.length > 0
      ? publishedBanners.map((banner) => ({
          id: banner.id,
          layout: banner.layout,
          badgeText: banner.badgeText,
          title: banner.title,
          description: banner.description,
          imageUrl: banner.imageUrl,
          ctaTextPrimary: banner.ctaTextPrimary,
          ctaLinkPrimary: banner.ctaLinkPrimary,
          ctaTextSecondary: banner.ctaTextSecondary,
          ctaLinkSecondary: banner.ctaLinkSecondary,
          background: banner.backgroundColor,
        }))
      : FALLBACK_HERO_SLIDES;

  const handleTraceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (traceInput.trim()) {
      navigate(`/trace/${traceInput.trim()}`);
    } else {
      navigate('/trace');
    }
  };

  return (
    <div>
      {/* ========================================================================= */}
      {/* 1. MOBILE-ONLY GREETING & SEARCH HEADER (PREMIUM FLIPKART/BLINKIT STYLE) */}
      {/* ========================================================================= */}
      <header
        className="store-safe-top mobile-only"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #eeece9',
        }}
      >
        {/* Three clear zones: logo | who + where (two lines) | trace. */}
        <div className="store-container home-mobile-header">
          <Link to="/" className="home-logo-box" aria-label="Desi Tokri home">
            <img src="/images/desi-tokri-cropped.png" alt="Desi Tokri" className="home-logo-img" />
          </Link>

          <button
            type="button"
            className="home-hdr-who"
            onClick={() => setPickingLocation(true)}
            aria-label="Change delivery location"
          >
            <span className="home-hdr-title">
              {isRetailer ? retailerProfile?.storeName || 'My Store' : 'Deliver to'}
            </span>
            <span className={`home-hdr-loc${shopperLocation ? '' : ' is-unset'}`}>
              <EnvironmentOutlined />
              <span className="home-hdr-loc-text">
                {shopperLocation ? locationLine(shopperLocation) : 'Set your location'}
              </span>
              <DownOutlined className="home-hdr-caret" />
            </span>
          </button>

          <Link to="/trace" className="home-trace-btn" title="Trace a pack" aria-label="Trace a pack">
            <QrcodeOutlined />
          </Link>
        </div>

        <LocationPicker open={pickingLocation} onClose={() => setPickingLocation(false)} />

        {/* Mobile Search input */}
        <div className="store-container home-search-container" style={{ paddingTop: 2, paddingBottom: 12 }}>
          <Input
            size="middle"
            placeholder="Search atta, dal, rice, spices..."
            prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 16, marginRight: 6 }} />}
            className="home-search-input"
            style={{
              borderRadius: 12,
              height: 44,
              fontSize: 13,
              border: '1px solid #e7e5e4',
              background: '#fafaf9',
            }}
            readOnly
            onClick={() => navigate('/search')}
            onFocus={() => navigate('/search')}
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTAINER (ADAPTS FOR BOTH MOBILE AND DESKTOP)                     */}
      {/* ========================================================================= */}
      <div className="store-container" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* ======================================================================= */}
        {/* DESKTOP HERO SECTION: BANNER SLIDER (LEFT) + QUICK WIDGETS (RIGHT)      */}
        {/* ======================================================================= */}
        <div className="desktop-only">
          <div style={{ display: 'grid', gridTemplateColumns: '2.1fr 1fr', gap: 20, alignItems: 'stretch' }}>
            {/* Left: Large Desktop Promo Carousel */}
            <div className="hero-slot">
              {bannersLoading ? (
<div className="banner-skeleton" />
) : (
<Carousel autoplay autoplaySpeed={2500} effect="fade" dotPosition="bottom">
                {heroSlides.map((slide) => (
                  <div key={slide.id}>
                    {slide.layout === 'IMAGE_ONLY' ? (
                      <BannerArtwork slide={slide} onOpen={(to) => navigate(to)} />
                    ) : (
                    <div
                      style={{
                        height: '100%',
                        aspectRatio: '8 / 3',
                        background: slide.background,
                        color: '#fff',
                        padding: '36px 44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                    >
                      <div style={{ maxWidth: '60%', zIndex: 2 }}>
                        {slide.badgeText && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'rgba(255,255,255,0.16)',
                              padding: '4px 12px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#ffffff',
                              marginBottom: 12,
                            }}
                          >
                            <SafetyCertificateFilled /> {slide.badgeText}
                          </div>
                        )}
                        <Typography.Title level={2} style={{ color: '#fff', margin: '0 0 10px', fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
                          {slide.title}
                        </Typography.Title>
                        <Typography.Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, display: 'block', marginBottom: 24, lineHeight: 1.5 }}>
                          {slide.description}
                        </Typography.Text>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <Button
                            type="primary"
                            size="large"
                            style={{ background: '#ffffff', borderColor: '#ffffff', color: '#065f46', fontWeight: 600, borderRadius: 10 }}
                            onClick={() => navigate(slide.ctaLinkPrimary)}
                          >
                            {slide.ctaTextPrimary}
                          </Button>
                          {slide.ctaTextSecondary && slide.ctaLinkSecondary && (
                            <Button
                              size="large"
                              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.55)', color: '#fff', fontWeight: 600, borderRadius: 10 }}
                              onClick={() => navigate(slide.ctaLinkSecondary as string)}
                            >
                              {slide.ctaTextSecondary}
                            </Button>
                          )}
                        </div>
                      </div>
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        style={{
                          height: 240,
                          width: 240,
                          objectFit: 'cover',
                          borderRadius: 16,
                        }}
                      />
                    </div>
                    )}
                  </div>
                ))}
              </Carousel>
)}
            </div>

            {/* Right: Dual Interactive Quick Widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Widget 1: Instant QR Batch Trace */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: '18px 20px',
                  border: '1px solid #e7e5e4',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: '#ecfdf5',
                          color: '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                        }}
                      >
                        <QrcodeOutlined />
                      </div>
                      <Typography.Text strong style={{ fontSize: 15, color: '#1c1917' }}>
                        Trace your pack
                      </Typography.Text>
                    </div>
                  </div>

                </div>

                <form onSubmit={handleTraceSubmit}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                      placeholder="e.g. FG-20260807-001"
                      value={traceInput}
                      onChange={(e) => setTraceInput(e.target.value)}
                      prefix={<BarcodeOutlined style={{ color: '#9ca3af' }} />}
                      style={{ borderRadius: 8 }}
                    />
                    <Button
                      type="primary"
                      htmlType="submit"
                      style={{ background: '#059669', borderColor: '#059669', borderRadius: 8, fontWeight: 600 }}
                    >
                      Verify
                    </Button>
                  </div>
                </form>
              </div>

              {/* Widget 2: Role-Aware Quick Card */}
              {isRetailer ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    color: '#1c1917',
                    borderRadius: 16,
                    padding: '18px 20px',
                    border: '1px solid #d1fae5',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                          Your store
                        </span>
                        <Typography.Text strong style={{ color: '#1c1917', display: 'block', fontSize: 16 }}>
                          {retailerProfile?.storeName || 'My Store'}
                        </Typography.Text>
                      </div>
                      <ShopOutlined style={{ color: '#059669', fontSize: 20 }} />
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: '#57534e', display: 'block' }}>
                        {retailerProfile?.gstin ? `GSTIN ${retailerProfile.gstin} · ` : ''}Pay online or cash on delivery
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <Button
                      block
                      type="primary"
                      style={{ fontWeight: 600, borderRadius: 8 }}
                      onClick={() => navigate('/orders')}
                    >
                      Repeat an order
                    </Button>
                    <Button
                      style={{ borderRadius: 8, fontWeight: 600 }}
                      onClick={() => navigate('/loyalty')}
                    >
                      Rewards
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#fffbf5',
                    color: '#1c1917',
                    borderRadius: 16,
                    padding: '18px 20px',
                    border: '1px solid #fde7cf',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        For shops &amp; retailers
                      </span>
                      <ShopOutlined style={{ color: '#ea580c', fontSize: 20 }} />
                    </div>
                    <Typography.Title level={4} style={{ color: '#1c1917', margin: '2px 0 6px 0', fontSize: 16, fontWeight: 700 }}>
                      Buy wholesale, direct from the mill
                    </Typography.Title>

                  </div>

                  <div style={{ marginTop: 14 }}>
                    <Button
                      block
                      type="primary"
                      style={{ background: '#f97316', borderColor: '#f97316', color: '#ffffff', fontWeight: 600, borderRadius: 8, height: 38 }}
                      onClick={() => navigate('/retailers/register')}
                    >
                      Register your business
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Trust Pillars Banner */}
          <div
            style={{
              marginTop: 20,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e7e5e4',
              padding: '14px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="trust-ico"><CheckCircleFilled /></span>
              <div>
                <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>100% Farm-Traceable</strong>
                <span style={{ fontSize: 11, color: '#78716c' }}>QR on every pack</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="trust-ico"><TruckFilled /></span>
              <div>
                <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>Same-Day Delivery</strong>
                <span style={{ fontSize: 11, color: '#78716c' }}>Direct mill dispatch</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="trust-ico"><ThunderboltFilled /></span>
              <div>
                <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>Wholesale Margins</strong>
                <span style={{ fontSize: 11, color: '#78716c' }}>Special schemes &amp; slabs</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="trust-ico"><SafetyCertificateFilled /></span>
              <div>
                <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>Certified Standards</strong>
                <span style={{ fontSize: 11, color: '#78716c' }}>FSSAI &amp; Agmark tested</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* MOBILE HERO CAROUSEL                                                    */}
        {/* ======================================================================= */}
        <div className="mobile-only home-mobile-carousel" style={{ borderRadius: 14, overflow: 'hidden' }}>
          {bannersLoading ? (
<div className="banner-skeleton" />
) : (
<Carousel autoplay autoplaySpeed={2500} dotPosition="bottom">
            {heroSlides.map((slide) => (
              <div key={slide.id}>
                {slide.layout === 'IMAGE_ONLY' ? (
                  <BannerArtwork slide={slide} onOpen={(to) => navigate(to)} />
                ) : (
                <div
                  onClick={() => navigate(slide.ctaLinkPrimary)}
                  className="home-carousel-slide"
                  style={{ background: slide.background, color: '#fff' }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Typography.Title
                      level={4}
                      className="home-carousel-title"
                      style={{ color: '#fff', margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}
                    >
                      {slide.title}
                    </Typography.Title>
                    <Typography.Text
                      className="home-carousel-desc"
                      style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: 11,
                        marginTop: 4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3,
                      }}
                    >
                      {slide.description}
                    </Typography.Text>
                  </div>
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="home-carousel-img"
                  />
                </div>
                )}
              </div>
            ))}
          </Carousel>
)}
        </div>

        {/* ======================================================================= */}
        {/* 3. SHOP BY CATEGORY (MOBILE SLIDER + DESKTOP WIDE GRID)                 */}
        {/* ======================================================================= */}
        {categoriesLoading || categories.length > 0 ? (
        <section>
          <SectionHeader title="Shop by Category" to="/categories" subtitle="Fresh & unadulterated directly from mandis" />

          {/* Mobile horizontal slider */}
          <div className="mobile-only">
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/products/${category.id}`}
                  style={{
                    flex: '0 0 auto',
                    width: 84,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 18,
                      background: category.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <img src={category.image} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <Typography.Text style={{ fontSize: 12, fontWeight: 500, color: '#44403c', textAlign: 'center' }}>
                    {category.name}
                  </Typography.Text>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop wide category grid */}
          <div className="desktop-only">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/products/${category.id}`}
                  className="product-card-hover"
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #e7e5e4',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 10,
                      background: category.color,
                      marginBottom: 10,
                      overflow: 'hidden',
                    }}
                  >
                    <img src={category.image} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <Typography.Text strong style={{ fontSize: 14, color: '#1c1917', marginBottom: 2 }}>
                    {category.name}
                  </Typography.Text>
                  <span style={{ fontSize: 12, color: '#78716c' }}>
                    {category.subcategories.length > 0
                      ? `${category.subcategories.length} ${category.subcategories.length === 1 ? 'variety' : 'varieties'}`
                      : 'Shop now'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {/* ======================================================================= */}
        {/* 4. TODAY'S SCHEMES & WHOLESALE OFFERS                                   */}
        {/* Managed via Admin > Schemes & Offers. Hidden entirely (no fallback)     */}
        {/* when Super Admin has unpublished every scheme.                         */}
        {/* ======================================================================= */}
        {schemes.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FireFilled style={{ color: '#f97316', fontSize: 20 }} />
                <Typography.Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Today&apos;s Active Schemes &amp; Offers
                </Typography.Title>
              </div>
            </div>

            {/* Mobile horizontal scroller */}
            <div className="mobile-only">
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
                {schemes.map((scheme) => {
                  const targetUrl =
                    Array.isArray(scheme.productIds) && scheme.productIds.length > 0
                      ? `/deals?title=${encodeURIComponent(scheme.title)}&subtitle=${encodeURIComponent(scheme.subtitle || '')}&ids=${scheme.productIds.join(',')}`
                      : scheme.ctaLink || '/categories';

                  return (
                    <div
                      key={scheme.id}
                      onClick={() => navigate(targetUrl)}
                      style={{
                        flex: '0 0 auto',
                        width: 270,
                        borderRadius: 14,
                        padding: 18,
                        background: scheme.backgroundColor,
                        color: scheme.textColor,
                        cursor: 'pointer',
                      }}
                    >
                      <Typography.Text
                        style={{
                          color: scheme.badgeTextColor,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          background: scheme.badgeColor,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {scheme.tag}
                      </Typography.Text>
                      <Typography.Title level={4} style={{ color: scheme.textColor, margin: '10px 0 2px', fontWeight: 700, fontSize: 17 }}>
                        {scheme.title}
                      </Typography.Title>
                      <Typography.Text style={{ color: scheme.textColor, fontSize: 13, fontWeight: 500 }}>
                        {scheme.subtitle}
                      </Typography.Text>
                      <div style={{ marginTop: 14 }}>
                        <Button
                          block
                          style={{
                            background: scheme.buttonColor,
                            color: scheme.buttonTextColor,
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: 8,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(targetUrl);
                          }}
                        >
                          {scheme.ctaText}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop 3-column schemes grid */}
            <div className="desktop-only">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {schemes.map((scheme) => {
                  const targetUrl =
                    Array.isArray(scheme.productIds) && scheme.productIds.length > 0
                      ? `/deals?title=${encodeURIComponent(scheme.title)}&subtitle=${encodeURIComponent(scheme.subtitle || '')}&ids=${scheme.productIds.join(',')}`
                      : scheme.ctaLink || '/categories';

                  return (
                    <div
                      key={scheme.id}
                      className="product-card-hover"
                      onClick={() => navigate(targetUrl)}
                      style={{
                        borderRadius: 16,
                        padding: '24px 22px',
                        background: scheme.backgroundColor,
                        color: scheme.textColor,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              color: scheme.badgeTextColor,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              background: scheme.badgeColor,
                              padding: '3px 8px',
                              borderRadius: 6,
                              textTransform: 'uppercase',
                            }}
                          >
                            {scheme.tag}
                          </span>
                        </div>
                        <Typography.Title level={4} style={{ color: scheme.textColor, margin: '14px 0 6px', fontWeight: 800, fontSize: 20 }}>
                          {scheme.title}
                        </Typography.Title>
                        <Typography.Text style={{ color: scheme.textColor, fontSize: 14, fontWeight: 500, lineHeight: 1.4, display: 'block' }}>
                          {scheme.subtitle}
                        </Typography.Text>
                      </div>

                      <div style={{ marginTop: 20 }}>
                        <Button
                          block
                          size="large"
                          style={{
                            background: scheme.buttonColor,
                            color: scheme.buttonTextColor,
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: 10,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(targetUrl);
                          }}
                        >
                          {scheme.ctaText} &rarr;
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ======================================================================= */}
        {/* SUPER ADMIN MANAGED SECTIONS (Admin > Homepage Sections)                */}
        {/* "Best of the Basics", the price strip and "Popular Products" used to be */}
        {/* hard-coded here; they are seeded rows now, so admin can edit, reorder  */}
        {/* or hide them. The API drops empty sections, so there is no fallback.   */}
        {/* ======================================================================= */}
        {managedSections.map((sec) => (
          <ManagedSection key={sec.id} section={sec} isRetailer={isRetailer} />
        ))}

        {/* ======================================================================= */}
        {/* 8. BUY AGAIN / REPEAT ORDERS                                            */}
        {/* ======================================================================= */}
        {buyAgain.length > 0 && (
        <section>
          <SectionHeader title="Buy Again / Reorder" to="/orders" subtitle="Previously ordered staples ready for one-click replenishment" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {buyAgain.map((product) => {
              const cartLine = cart.lines.find((line) => line.productId === product.id);
              return (
                <div
                  key={product.id}
                  className="product-card-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    border: '1px solid #e7e5e4',
                    borderRadius: 16,
                    background: '#ffffff',
                  }}
                >
                  <Link to={`/product-detail/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    <ProductThumb image={product.image} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text strong style={{ display: 'block', fontSize: 13, color: '#1c1917' }} ellipsis>
                        {product.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Last ordered {lastOrderedLabel(product.lastOrderedAt)}
                        {product.timesOrdered > 1 ? ` · ordered ${product.timesOrdered} times` : ''}
                      </Typography.Text>
                      <div style={{ marginTop: 2 }}>
                        <Typography.Text strong style={{ fontSize: 15, color: '#1c1917' }}>
                          {product.price !== null ? formatInr(product.price) : 'N/A'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {' '}
                          / {product.unit}
                        </Typography.Text>
                      </div>
                    </div>
                  </Link>
                  <Button
                    type="primary"
                    style={{ background: '#f97316', borderColor: '#f97316', borderRadius: 8, fontWeight: 600 }}
                    onClick={() => {
                      // Same quantity as last time, never under this channel's minimum.
                      const min = isRetailer ? (product.moqB2B ?? 1) : (product.minOrderQuantity ?? 1);
                      cart.add(
                        {
                          productId: product.id,
                          productName: product.name,
                          unit: product.unit,
                          displayUnitPrice: product.price,
                          imageUrl: product.image,
                          mrp: product.mrp,
                          moqB2B: product.moqB2B ?? 1,
                          minOrderQuantity: product.minOrderQuantity ?? 1,
                        },
                        cartLine ? 0 : Math.max(min, product.lastQuantity),
                      );
                    }}
                    disabled={Boolean(cartLine) || !product.purchasable}
                  >
                    {cartLine ? 'Added' : !product.purchasable ? 'Out of stock' : `Reorder ×${Math.max(isRetailer ? (product.moqB2B ?? 1) : (product.minOrderQuantity ?? 1), product.lastQuantity)}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* ======================================================================= */}
        {/* 9. BOTTOM ACCOUNT / PARTNER SUMMARY                                     */}
        {/* ======================================================================= */}
        {isRetailer ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e7e5e4',
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Retailer account
                </span>
                <Typography.Title level={4} style={{ margin: '2px 0 0', color: '#1c1917', fontSize: 18 }}>
                  {retailerProfile?.storeName || 'My Store'}
                </Typography.Title>
                <Typography.Text style={{ fontSize: 13, color: '#78716c' }}>
                  GSTIN {retailerProfile?.gstin || '—'} · Orders are paid online or by cash on delivery
                </Typography.Text>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button style={{ fontWeight: 600, borderRadius: 8 }} onClick={() => navigate('/profile')}>
                  Store profile
                </Button>
                <Button style={{ fontWeight: 600, borderRadius: 8 }} onClick={() => navigate('/loyalty')}>
                  Rewards
                </Button>
                <Button type="primary" style={{ fontWeight: 600, borderRadius: 8 }} onClick={() => navigate('/orders')}>
                  Orders &amp; invoices
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e7e5e4',
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                For shops &amp; retailers
              </span>
              <Typography.Title level={4} style={{ margin: '4px 0 2px', color: '#1c1917', fontSize: 18 }}>
                Own a Grocery Store or Supermarket?
              </Typography.Title>
              <Typography.Text style={{ fontSize: 13, color: '#78716c' }}>
                Get direct mill supply at wholesale tier prices once your store is approved.
              </Typography.Text>
            </div>
            <Button
              type="primary"
              style={{ background: '#f97316', borderColor: '#f97316', fontWeight: 600, borderRadius: 8, height: 40 }}
              onClick={() => navigate('/retailers/register')}
            >
              Become a partner
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

/** One admin-managed homepage section, drawn by its kind and layout. */
function ManagedSection({ section, isRetailer }: { section: StorefrontHomeSection; isRetailer: boolean }) {
  const navigate = useNavigate();
  const subtitle = section.subtitle ?? undefined;

  if (section.kind === 'PRICE_DEALS') {
    return (
      <section>
        <SectionHeader title={section.title} subtitle={subtitle} />
        <div className="price-deals-scroll hide-scrollbar">
          {section.tiles.map((tile, i) => {
            const hasCustomProducts = Array.isArray(tile.productIds) && tile.productIds.length > 0;
            const to = hasCustomProducts
              ? `/deals?title=${encodeURIComponent(tile.subtitle || tile.label)}&price=${tile.price}&color=${tile.color}&emoji=${encodeURIComponent(tile.emoji || '')}&ids=${tile.productIds!.join(',')}`
              : tile.categorySlug
                ? tile.parentCategorySlug
                  ? `/products/${tile.parentCategorySlug}?sub=${tile.categorySlug}`
                  : `/products/${tile.categorySlug}`
                : '/categories';
            return (
              <div
                key={i}
                role="link"
                tabIndex={0}
                onClick={() => navigate(to)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(to)}
                className="price-deal-card category-pill-hover"
                style={{
                  background: PRICE_TILE_GRADIENTS[tile.color] ?? PRICE_TILE_GRADIENTS.orange,
                  borderRadius: 16,
                  padding: '16px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  color: '#ffffff',
                }}
              >
                
                <Typography.Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', display: 'block', marginBottom: 2 }}>{tile.label}</Typography.Text>
                <Typography.Text strong style={{ fontSize: 24, color: '#fff', display: 'block', lineHeight: 1.1 }}>{formatInr(tile.price)}</Typography.Text>
                <Typography.Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', display: 'block', marginTop: 6, lineHeight: 1.25 }}>{tile.subtitle}</Typography.Text>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const products = section.products.map(toShelfProduct);
  return (
    <section>
      <SectionHeader title={section.title} subtitle={subtitle} />
      {section.layout === 'GRID' ? (
        <GridCards products={products} isRetailer={isRetailer} />
      ) : (
        <ShelfCards products={products} isRetailer={isRetailer} />
      )}
    </section>
  );
}

const PRICE_TILE_GRADIENTS: Record<string, string> = {
  purple: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  orange: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  green: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  blue: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
  red: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
  teal: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
};

/** Compact cards: horizontal scroll on mobile, 6 across on desktop. */
function ShelfCards({ products, isRetailer }: { products: ShelfProduct[]; isRetailer: boolean }) {
  const cart = useCart();
  return (
    <>
    {/* Mobile horizontal scroll */}
    <div className="mobile-only">
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
        {products.map((product) => (
          <div
            key={product.id}
            style={{
              flex: '0 0 auto',
              width: 140,
              borderRadius: 14,
              padding: 10,
              background: '#ffffff',
              border: '1px solid #e7e5e4',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Link to={`/product-detail/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
              <div className="pc-media pc-media--sm" style={{ marginBottom: 8, borderRadius: 8 }}>
                <img src={product.image} alt={product.name} loading="lazy" />
              </div>
              <Typography.Text style={{ fontSize: 12, fontWeight: 700, color: '#292524', lineHeight: 1.2, height: 28, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {product.name}
              </Typography.Text>
              {product.rating && product.reviewCount ? (
                <div style={{ marginTop: 3 }}>
                  <RatingBadge rating={product.rating} count={product.reviewCount} />
                </div>
              ) : null}
              <Typography.Text style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>
                {product.weight}
              </Typography.Text>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Typography.Text style={{ fontSize: 14, fontWeight: 800, color: '#1c1917' }}>
                {product.price !== null ? formatInr(product.price) : 'N/A'}
              </Typography.Text>
              <button
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  cart.add({
                    productId: product.id,
                    productName: product.name,
                    unit: product.weight,
                    displayUnitPrice: product.price,
                    imageUrl: product.image,
                    mrp: product.mrp,
                  }, isRetailer ? ((product as any).moqB2B ?? 1) : 1)
                }
              >
                <PlusOutlined style={{ fontSize: 13, fontWeight: 'bold' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Desktop 6-column product grid */}
    <div className="desktop-only">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20 }}>
        {products.map((product) => {
          const cartLine = cart.lines.find((line) => line.productId === product.id);
          return (
            <div
              key={product.id}
              className="product-card-hover"
              style={{
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #e7e5e4',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Link to={`/product-detail/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                <div className="pc-media">
                  <img src={product.image} alt={product.name} loading="lazy" />
                </div>
                <div className="pc-body">
                <span className="pc-name">{product.name}</span>
                {product.rating && product.reviewCount ? (
                  <div style={{ marginTop: 3 }}>
                    <RatingBadge rating={product.rating} count={product.reviewCount} />
                  </div>
                ) : null}
                <span className="pc-meta">{product.weight}</span>
                <div className="pc-price-row">
  <span className="pc-price">{product.price !== null ? formatInr(product.price) : 'N/A'}</span>
  {product.mrp && product.price !== null && Number(product.mrp) > product.price ? (
    <>
      <span className="pc-mrp">{formatInr(product.mrp)}</span>
      <span className="pc-off">{Math.round((1 - product.price / Number(product.mrp)) * 100)}% off</span>
    </>
  ) : null}
</div>
                </div>
              </Link>
              <div className="pc-action">
                {cartLine ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fff7ed',
                      borderRadius: 8,
                      padding: '2px 4px',
                      border: '1px solid #fed7aa',
                    }}
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<MinusOutlined />}
                      onClick={() => {
                        const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                        if (cartLine.quantity <= moq) {
                          cart.remove(product.id);
                        } else {
                          cart.setQuantity(product.id, cartLine.quantity - 1);
                        }
                      }}
                    />
                    <InputNumber
                      size="small"
                      min={isRetailer ? ((product as any).moqB2B ?? 1) : 1}
                      value={cartLine.quantity}
                      controls={false}
                      onChange={(value) => {
                        const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                        cart.setQuantity(product.id, Math.max(moq, value ?? moq));
                      }}
                      style={{ width: 36, textAlign: 'center' }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => cart.setQuantity(product.id, cartLine.quantity + 1)}
                    />
                  </div>
                ) : (
                  <Button
                    block
                    style={{ background: '#f97316', borderColor: '#f97316', color: '#fff', fontWeight: 600, borderRadius: 8 }}
                    onClick={() => {
                      const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                      cart.add({
                        productId: product.id,
                        productName: product.name,
                        unit: product.weight,
                        displayUnitPrice: product.price,
                        imageUrl: product.image,
                        mrp: product.mrp,
                        moqB2B: (product as any).moqB2B ?? 1,
                        minOrderQuantity: (product as any).minOrderQuantity ?? 1,
                      }, moq);
                    }}
                  >
                    Add to Cart
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

/** Large cards: 2 across on mobile, 4 across on desktop. */
function GridCards({ products, isRetailer }: { products: ShelfProduct[]; isRetailer: boolean }) {
  const cart = useCart();
  return (
    <div className="home-products-grid">
      {products.map((product) => {
        const cartLine = cart.lines.find((line) => line.productId === product.id);
        return (
          <div
            key={product.id}
            className="product-card-hover"
            style={{
              border: '1px solid #e7e5e4',
              borderRadius: 16,
              background: '#ffffff',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Link to={`/product-detail/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative' }}>
                <div className="pc-media"><img src={product.image} alt={product.name} loading="lazy" /></div>
                {product.badge && (
                  <Typography.Text
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      background: '#dcfce7',
                      color: '#166534',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}
                  >
                    {product.badge}
                  </Typography.Text>
                )}
              </div>
              <div className="pc-body">
                <span className="pc-name">{product.name}</span>
                {product.rating && product.reviewCount ? (
                  <div style={{ marginTop: 3 }}>
                    <RatingBadge rating={product.rating} count={product.reviewCount} />
                  </div>
                ) : null}
                <span className="pc-meta">{product.variant}</span>
                <div className="pc-price-row">
  <span className="pc-price">{product.price !== null ? formatInr(product.price) : 'N/A'}</span>
  {product.mrp && product.price !== null && Number(product.mrp) > product.price ? (
    <>
      <span className="pc-mrp">{formatInr(product.mrp)}</span>
      <span className="pc-off">{Math.round((1 - product.price / Number(product.mrp)) * 100)}% off</span>
    </>
  ) : null}
</div>
              </div>
            </Link>
            <div className="pc-action">
              {cartLine ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff7ed',
                    borderRadius: 10,
                    padding: '3px 6px',
                    border: '1px solid #fed7aa',
                  }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<MinusOutlined />}
                    onClick={() => {
                      const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                      if (cartLine.quantity <= moq) {
                        cart.remove(product.id);
                      } else {
                        cart.setQuantity(product.id, cartLine.quantity - 1);
                      }
                    }}
                  />
                  <InputNumber
                    size="small"
                    min={isRetailer ? ((product as any).moqB2B ?? 1) : 1}
                    value={cartLine.quantity}
                    controls={false}
                    onChange={(value) => {
                      const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                      cart.setQuantity(product.id, Math.max(moq, value ?? moq));
                    }}
                    style={{ width: 44, textAlign: 'center' }}
                  />
                  <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => cart.setQuantity(product.id, cartLine.quantity + 1)}
                  />
                </div>
              ) : (
                <Button
                  block
                  style={{ background: '#f97316', borderColor: '#f97316', color: '#fff', fontWeight: 600, borderRadius: 10, height: 40 }}
                  onClick={() => {
                    const moq = isRetailer ? ((product as any).moqB2B ?? 1) : 1;
                    cart.add({
                      productId: product.id,
                      productName: product.name,
                      unit: product.variant,
                      displayUnitPrice: product.price,
                      imageUrl: product.image,
                      mrp: product.mrp,
                      moqB2B: (product as any).moqB2B ?? 1,
                      minOrderQuantity: (product as any).minOrderQuantity ?? 1,
                    }, moq);
                  }}
                >
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, to, subtitle }: { title: string; to?: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 8,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography.Title
          level={4}
          className="home-section-title"
          style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text
            type="secondary"
            className="home-section-subtitle"
            style={{ fontSize: 11.5, display: 'block', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {to && (
        <Link to={to} style={{ fontSize: 12, color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          View All <RightOutlined style={{ fontSize: 10 }} />
        </Link>
      )}
    </div>
  );
}

/**
 * A finished banner uploaded from Admin > Banner Management ("Full image"):
 * the artwork is the whole slide, 8:3 on web and phone. A tap opens its link
 * when one is set.
 */
function BannerArtwork({ slide, onOpen }: { slide: HeroSlide; onOpen: (to: string) => void }) {
  const link = slide.ctaLinkPrimary?.trim();
  return (
    <div
      className="banner-artwork"
      role={link ? 'link' : undefined}
      tabIndex={link ? 0 : undefined}
      onClick={link ? () => onOpen(link) : undefined}
      onKeyDown={link ? (e) => e.key === 'Enter' && onOpen(link) : undefined}
      style={{ cursor: link ? 'pointer' : 'default' }}
    >
      <img src={slide.imageUrl} alt={slide.title} />
    </div>
  );
}

function ProductThumb({ image, square }: { image: string; square?: boolean }) {
  return (
    <div
      style={{
        width: square ? '100%' : 64,
        height: square ? 150 : 64,
        borderRadius: square ? 0 : 12,
        background: '#f8f7f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        padding: square ? 12 : 6,
      }}
    >
      <img src={image} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
    </div>
  );
}
