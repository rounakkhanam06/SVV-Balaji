import {
  CloseOutlined,
  GoldOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MutedOutlined,
  SearchOutlined,
  ShopOutlined,
  SoundOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App as AntApp, Avatar, Badge, Button, Drawer, Dropdown, Grid, Input, Layout, Menu, Segmented, Spin, Tag, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { deliveryApi } from '@shared/api/delivery';
import { DELIVERY_KEYS } from '@shared/hooks/useDelivery';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../auth/types';
import { useCanFn } from '../auth/useCan';
import { useAuth } from '../auth/useAuth';
import { BellOutlined } from '@ant-design/icons';
import { enableOrderAlerts, orderAlertSupport } from '../live/orderAlerts';
import { useLiveOrders } from '../live/useLiveOrders';
import { installOrderSoundUnlock, playOrderSound, setOrderSoundMuted, useOrderSoundMuted } from '../live/orderSound';
import { installNotificationSoundUnlock } from '../live/notificationSound';
import { NotificationBell } from '../notifications/NotificationBell';
import { IncomingOrderBroadcastModal } from '../components/IncomingOrderBroadcastModal';
import { NAV_SECTIONS, findNavItem, type AdminZone, type NavItem } from './navigation';
import { useAdminZone } from './useAdminZone';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

type MenuEntry = Required<MenuProps>['items'][number];
const groupKey = (key: string) => `group:${key}`;

/**
 * A section's entries as menu items, with grouped entries gathered under one
 * sub-menu at the position of the first of them. Group keys are prefixed so a
 * click on the sub-menu title is never taken for a path.
 */
function nestGroups(items: NavItem[], counts: Record<NonNullable<NavItem['count']>, number>) {
  const out: Array<MenuEntry & { key: string }> = [];
  const groups = new Map<string, MenuEntry[]>();
  for (const item of items) {
    const n = item.count ? counts[item.count] : 0;
    const entry: MenuEntry = {
      key: item.path,
      label: n ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {item.label}
          <Badge count={n} size="small" style={{ background: '#ff8a00' }} />
        </span>
      ) : item.label,
    };
    if (!item.group) {
      out.push(entry as MenuEntry & { key: string });
      continue;
    }
    const existing = groups.get(item.group.key);
    if (existing) {
      existing.push(entry);
    } else {
      const children: MenuEntry[] = [entry];
      groups.set(item.group.key, children);
      out.push({ key: groupKey(item.group.key), label: item.group.label, children });
    }
  }
  return out;
}

const ZONE_OPTIONS: { label: string; value: AdminZone; icon: React.ReactNode }[] = [
  { label: 'Supply Chain', value: 'supply', icon: <GoldOutlined /> },
  { label: 'Customer & Retail', value: 'commerce', icon: <ShopOutlined /> },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [zone, setZone] = useAdminZone();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Responsive screen detection
  const screens = useBreakpoint();
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screens.md !== undefined ? !screens.md : windowWidth < 768;
  const isTablet = screens.lg !== undefined ? Boolean(screens.md && !screens.lg) : Boolean(windowWidth >= 768 && windowWidth < 992);
  const isDesktop = screens.lg !== undefined ? Boolean(screens.lg) : windowWidth >= 992;

  // Auto-close drawer whenever route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const can = useCanFn();

  // The whole panel listens for orders and support messages: any screen gets notified, and views refresh live.
  const live = useLiveOrders(can('ORDER_VIEW') || can('SUPPORT_TICKETS_VIEW') || can('SUPPORT_TICKETS_REPLY'), (path) => navigate(path));

  const soundMuted = useOrderSoundMuted();
  useEffect(() => {
    installOrderSoundUnlock();
    installNotificationSoundUnlock();
  }, []);
  // Browser alerts (new orders, rider sign-ups, returns, approvals...) for every staff member.
  // Already allowed on this browser -> (re)register silently; not decided yet -> offer the button.
  const [alertsReady, setAlertsReady] = useState(false);
  // The panel raises system notifications itself (src/live/systemNotify.ts), so the button is
  // offered whenever this browser has not decided yet - even if server web push is not configured.
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') setAlertsReady(true);
    void orderAlertSupport()
      .then(async (s) => {
        if (s === 'ready' && Notification.permission === 'granted') await enableOrderAlerts();
      })
      .catch(() => undefined);
  }, [user?.id]);
  const turnOnAlerts = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        message.warning('Notifications are blocked - allow them for this site in the browser (lock icon in the address bar)');
        return;
      }
      setAlertsReady(false);
      // Server push as well (alerts with the tab closed), when configured; the open panel works without it.
      const push = await orderAlertSupport().catch(() => 'unsupported' as const);
      if (push === 'ready') await enableOrderAlerts().catch(() => undefined);
      message.success('Alerts are on for this browser');
    } catch {
      message.error('Could not enable alerts');
    }
  };

  /**
   * The menu is filtered by permission, not merely disabled. Someone with no
   * access to Price Lists has no business seeing the entry — an empty section
   * is removed entirely rather than left hanging.
   *
   * Search term matches against label, path, parent section, or description.
   */
  // Riders awaiting approval, shown as a count on their menu entry. Same query
  // key as the Pending Approval page, so approving there updates the badge.
  const pendingRiders = useQuery({
    queryKey: DELIVERY_KEYS.riders({ status: 'PENDING_APPROVAL' }),
    queryFn: () => deliveryApi.riders({ status: 'PENDING_APPROVAL' }),
    enabled: can('RIDERS_VIEW'),
    refetchInterval: 60_000,
  });
  const counts: Record<NonNullable<NavItem['count']>, number> = { pendingRiders: pendingRiders.data?.length ?? 0 };

  const menuItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return NAV_SECTIONS.flatMap((section) => {
      const visible = section.items.filter((item) => {
        if (!can(item.permission) || (item.zone && item.zone !== zone)) {
          return false;
        }
        if (!query) return true;
        return (
          item.label.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query) ||
          section.label.toLowerCase().includes(query) ||
          (item.group && item.group.label.toLowerCase().includes(query)) ||
          (item.description && item.description.toLowerCase().includes(query))
        );
      });

      if (visible.length === 0) return [];

      return [
        {
          key: section.key,
          icon: section.icon,
          label: section.label,
          children: nestGroups(visible, counts),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, zone, searchTerm, counts.pendingRiders]);

  /**
   * The menu entry a URL belongs to. A detail page such as /seed-stock/:id has
   * no entry of its own, so the longest nav path it sits under stays lit.
   */
  const activeNavPath = useMemo(() => {
    const path = location.pathname;
    return (
      NAV_SECTIONS.flatMap((section) => section.items)
        .filter((item) => item.path === path || (item.path !== '/' && path.startsWith(`${item.path}/`)))
        .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? path
    );
  }, [location.pathname]);

  /** The section (and sub-menu, if any) holding the current screen. */
  const openKeysFor = (path: string) => {
    const section = NAV_SECTIONS.find((sec) => sec.items.some((item) => item.path === path));
    const item = section?.items.find((i) => i.path === path);
    return section ? [section.key, ...(item?.group ? [groupKey(item.group.key)] : [])] : [];
  };

  const [userOpenKeys, setUserOpenKeys] = useState<string[]>(() => openKeysFor(activeNavPath));

  useEffect(() => {
    const keys = openKeysFor(activeNavPath);
    if (keys.length) {
      setUserOpenKeys((prev) => (keys.every((k) => prev.includes(k)) ? prev : [...new Set([...prev, ...keys])]));
    }
  }, [activeNavPath]);

  const activeOpenKeys = useMemo(() => {
    if (searchTerm.trim()) {
      // Searching opens every section and sub-menu that has a match.
      return menuItems.flatMap((s) => [s.key, ...s.children.flatMap((c) => ('children' in c ? [String(c.key)] : []))]);
    }
    return userOpenKeys;
  }, [searchTerm, menuItems, userOpenKeys]);

  /**
   * Switching zones can hide the screen the user is currently on — e.g.
   * viewing Orders and flipping to Supply Chain. Rather than leave them on a
   * page with no matching menu entry (or let RequirePermission's normal
   * guard handle it, which it would, but with a jarring "forbidden" flash for
   * a screen they DO have access to), send them to the dashboard, which is
   * always visible in both zones.
   */
  const handleZoneChange = (next: AdminZone) => {
    setZone(next);
    const current = findNavItem(location.pathname);
    if (current?.zone && current.zone !== next) {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
    message.success('Signed out');
    navigate('/login', { replace: true });
  };

  const renderSidebarContent = (isDrawer = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sidebar-bg-gradient)' }}>
      <div
        style={{
          flexShrink: 0,
          height: 62,
          display: 'flex',
          alignItems: 'center',
          justifyContent: !isDrawer && collapsed ? 'center' : 'space-between',
          padding: !isDrawer && collapsed ? '0 8px' : '0 16px',
          borderBottom: '1px solid #f0fdf4',
          background: '#ffffff',
          gap: 10,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'pointer' }}
          onClick={() => {
            navigate('/');
            if (isDrawer) setMobileDrawerOpen(false);
          }}
        >
          <img
            src="/svv-balaji.png"
            alt="SVV Balaji Logo"
            style={{
              height: !isDrawer && collapsed ? 34 : 38,
              width: 'auto',
              maxHeight: 40,
              objectFit: 'contain',
              borderRadius: 6,
            }}
          />
          {(isDrawer || !collapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Typography.Text strong style={{ fontSize: 15, lineHeight: 1.2, whiteSpace: 'nowrap', color: '#166534' }}>
                SVV Balaji
              </Typography.Text>
              <Typography.Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#e86a17' }}>
                Enterprise Portal
              </Typography.Text>
            </div>
          )}
        </div>
        {isDrawer && (
          <Button
            type="text"
            icon={<CloseOutlined style={{ fontSize: 16, color: '#64748b' }} />}
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close menu"
          />
        )}
      </div>

      {(isDrawer || !collapsed) && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 12px 6px 12px',
            background: '#ffffff',
            borderBottom: '1px solid #f0fdf4',
          }}
        >
          <Input
            prefix={<SearchOutlined style={{ color: '#16a34a' }} />}
            placeholder="Search menus..."
            size="small"
            allowClear
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              borderRadius: 8,
              backgroundColor: '#f0fdf4',
              borderColor: '#bbf7d0',
            }}
          />
        </div>
      )}

      <div className="sidebar-menu-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={[activeNavPath]}
          openKeys={activeOpenKeys}
          onOpenChange={(keys) => {
            if (!searchTerm.trim()) {
              setUserOpenKeys(keys);
            }
          }}
          onClick={({ key }) => {
            navigate(key);
            if (isDrawer) {
              setMobileDrawerOpen(false);
            }
          }}
          style={{ borderInlineEnd: 'none' }}
        />

        {(isDrawer || !collapsed) && searchTerm.trim() && menuItems.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            No matching menus found
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {isDesktop ? (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={240}
          collapsedWidth={70}
          theme="light"
          className="admin-sidebar"
          style={{
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
            zIndex: 10,
            borderRight: '1px solid #e5e7eb',
          }}
        >
          {renderSidebarContent(false)}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={Math.min(300, Math.floor(windowWidth * 0.82))}
          closable={false}
          styles={{ body: { padding: 0, overflow: 'hidden' } }}
        >
          {renderSidebarContent(true)}
        </Drawer>
      )}

      <Layout style={{ overflow: 'hidden', minWidth: 0 }}>
        <Header
          style={{
            padding: isMobile ? '0 8px' : '0 16px 0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: isMobile ? 52 : 56,
            lineHeight: isMobile ? '52px' : '56px',
            background: '#fff',
            zIndex: 9,
            gap: isMobile ? 6 : 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Button
              type="text"
              aria-label={!isDesktop ? 'Open navigation menu' : (collapsed ? 'Expand navigation' : 'Collapse navigation')}
              icon={!isDesktop ? <MenuOutlined style={{ fontSize: 18, color: '#166534' }} /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
              onClick={() => {
                if (!isDesktop) {
                  setMobileDrawerOpen(true);
                } else {
                  setCollapsed((value) => !value);
                }
              }}
            />
            {!isDesktop && (
              <img
                src="/svv-balaji.png"
                alt="SVV Balaji Logo"
                style={{ height: 28, width: 'auto', borderRadius: 4, cursor: 'pointer' }}
                onClick={() => navigate('/')}
              />
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
            <Segmented<AdminZone>
              value={zone}
              onChange={handleZoneChange}
              size={isMobile ? 'small' : 'middle'}
              options={ZONE_OPTIONS.map((option) => ({
                label: (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? 4 : 8,
                      padding: isMobile ? '0 4px' : isTablet ? '0 8px' : '0 14px',
                      fontSize: isMobile ? 12 : 13,
                    }}
                  >
                    {option.icon}
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {isMobile ? (option.value === 'supply' ? 'Supply' : 'Retail') : option.label}
                    </span>
                  </span>
                ),
                value: option.value,
              }))}
              style={{ padding: 3, backgroundColor: '#f1f5f9', maxWidth: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, flexShrink: 0 }}>
            {can('ORDER_VIEW') ? (
              isMobile ? (
                <Tooltip title={`Live order feed: ${live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline'}`}>
                  <Tag
                    color={live === 'live' ? 'green' : live === 'connecting' ? 'default' : 'red'}
                    style={{ margin: 0, padding: '0 5px', fontSize: 11, cursor: 'pointer', lineHeight: '20px' }}
                  >
                    ●
                  </Tag>
                </Tooltip>
              ) : (
                <Tag color={live === 'live' ? 'green' : live === 'connecting' ? 'default' : 'red'} title="Live order feed" style={{ margin: 0 }}>
                  ● {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline (catching up on reconnect)'}
                </Tag>
              )
            ) : null}

            {can('ORDER_VIEW') ? (
              <Tooltip title={soundMuted ? 'New-order sound is off - click to turn on' : 'New-order sound is on - click to mute'}>
                <Button
                  size="small"
                  type="text"
                  aria-label={soundMuted ? 'Turn new-order sound on' : 'Mute new-order sound'}
                  icon={soundMuted ? <MutedOutlined /> : <SoundOutlined style={{ color: '#059669' }} />}
                  onClick={() => {
                    setOrderSoundMuted(!soundMuted);
                    if (soundMuted) playOrderSound(true); // a preview, and it unlocks audio in this browser
                  }}
                />
              </Tooltip>
            ) : null}

            {alertsReady ? (
              isMobile ? (
                <Tooltip title="Turn on alerts">
                  <Button size="small" icon={<BellOutlined />} onClick={() => void turnOnAlerts()} />
                </Tooltip>
              ) : (
                <Button size="small" icon={<BellOutlined />} onClick={() => void turnOnAlerts()}>Turn on alerts</Button>
              )
            ) : null}

            <NotificationBell />

            {!isMobile && user?.branch ? <Tag style={{ margin: 0 }}>{user.branch.name}</Tag> : null}
            {!isMobile && user && user.fullName?.trim().toLowerCase() !== ROLE_LABELS[user.role]?.trim().toLowerCase() ? (
              <Tag color="blue" style={{ margin: 0 }}>{ROLE_LABELS[user.role]}</Tag>
            ) : null}

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user-header',
                    disabled: true,
                    label: (
                      <div style={{ padding: '4px 2px', borderBottom: '1px solid #f1f5f9' }}>
                        <Typography.Text strong style={{ display: 'block', color: '#0f172a', fontSize: 13 }}>
                          {user?.fullName}
                        </Typography.Text>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                            {ROLE_LABELS[user?.role || ''] || user?.role}
                          </Tag>
                          {user?.branch && (
                            <Tag style={{ fontSize: 10, margin: 0 }}>
                              {user.branch.name}
                            </Tag>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: 'Profile & Security',
                    onClick: () => navigate('/profile'),
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Sign out',
                    onClick: handleLogout,
                  },
                ],
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>
                <Avatar size="small" style={{ background: '#166534' }}>
                  {user?.fullName?.charAt(0).toUpperCase()}
                </Avatar>
                {!isMobile && !isTablet && (
                  <Typography.Text ellipsis style={{ maxWidth: 110, fontSize: 13 }}>
                    {user?.fullName}
                  </Typography.Text>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: isMobile ? '8px 8px 12px 8px' : isTablet ? '12px 12px 16px 12px' : 16,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: isMobile ? 0 : 4,
            WebkitOverflowScrolling: 'touch',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {/* Screens are code-split (see App.tsx). The boundary sits here rather
              than around the whole app so the sider and header stay on screen
              while a chunk loads — the page swaps, the shell does not blink. */}
          <Suspense
            fallback={
              <div style={{ display: 'grid', placeItems: 'center', padding: 64 }}>
                <Spin size="large" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <IncomingOrderBroadcastModal />
    </Layout>
  );
}
