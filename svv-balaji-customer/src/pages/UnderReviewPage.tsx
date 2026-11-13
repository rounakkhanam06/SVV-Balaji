import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Alert, Button, Result, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useStorefrontSupport } from '@shared/hooks/useSupportSettings';

const { Title, Text, Paragraph } = Typography;

export function UnderReviewPage() {
  const navigate = useNavigate();
  const { role, retailerProfile, logout, checkRegistration } = useCustomerAuth();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const rejected = retailerProfile?.kycStatus === 'REJECTED';
  const support = useStorefrontSupport('RETAILER');

  // Auto-redirect if profile becomes VERIFIED (show toast only once upon approval)
  useEffect(() => {
    if (retailerProfile?.kycStatus === 'VERIFIED') {
      const retailerKey = retailerProfile.phone || retailerProfile.gstin || 'retailer';
      const notifiedKey = `svv.retailer.approval_notified.${retailerKey}`;
      try {
        if (!localStorage.getItem(notifiedKey)) {
          localStorage.setItem(notifiedKey, '1');
          message.success('🎉 Your retailer account has been approved by Super Admin!');
        }
      } catch {
        // ignore storage error
      }
      navigate('/', { replace: true });
    }
  }, [retailerProfile?.kycStatus, retailerProfile?.phone, retailerProfile?.gstin, navigate]);

  // The auth context checks every 30 s while pending; this only records when, for the label.
  useEffect(() => {
    if (retailerProfile?.kycStatus !== 'PENDING') return;
    setLastChecked(new Date());
    const timer = setInterval(() => setLastChecked(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [retailerProfile?.kycStatus]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const result = await checkRegistration();
      if (!result) {
        message.error('Could not check your registration. Please try again.');
        return;
      }
      setLastChecked(new Date());
      // Approval redirects via the effect above; rejection re-renders this page.
      if (result.status === 'PENDING_APPROVAL') message.info('Still under review - this page updates by itself.');
    } finally {
      setChecking(false);
    }
  };

  const signOut = () => {
    logout();
    navigate('/retailers/login', { replace: true });
  };

  // Reached by URL while signed out: there is nothing to show without a session.
  if (role !== 'RETAILER' || !retailerProfile) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#fffbeb' }}>
        <Result
          icon={<ClockCircleOutlined style={{ color: '#d97706' }} />}
          title="Check your retailer registration"
          subTitle="Sign in with the mobile number you registered with to see whether your store has been approved."
          extra={
            <Button
              type="primary"
              onClick={() => navigate('/retailers/login', { replace: true })}
              style={{ background: '#d97706', borderColor: '#d97706' }}
            >
              Sign in
            </Button>
          }
        />
      </div>
    );
  }

  const accent = rejected ? '#dc2626' : '#d97706';
  const tint = rejected ? '#fef2f2' : '#fffbeb';
  const details: Array<[string, React.ReactNode]> = [
    ['Store / Business', retailerProfile.storeName || '—'],
    ['Proprietor', retailerProfile.ownerName || '—'],
    ['Mobile', retailerProfile.phone || '—'],
    ['Email', retailerProfile.email || <Text type="secondary">Not provided</Text>],
    ['GSTIN', <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 0.5 }}>{retailerProfile.gstin || '—'}</span>],
    ['Location', [retailerProfile.address, retailerProfile.pincode].filter(Boolean).join(' - ') || '—'],
  ];
  type StepState = 'done' | 'current' | 'failed' | 'todo';
  const steps: Array<{ label: string; state: StepState }> = [
    { label: 'Submitted', state: 'done' },
    { label: rejected ? 'Reviewed' : 'Under review', state: rejected ? 'failed' : 'current' },
    { label: rejected ? 'Not approved' : 'Approved', state: rejected ? 'failed' : 'todo' },
  ];
  const stepColor: Record<StepState, string> = { done: '#16a34a', current: '#d97706', failed: '#dc2626', todo: '#cbd5e1' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: accent }} />

          {/* Status */}
          <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: tint, color: accent, fontSize: 24 }}>
              {rejected ? <CloseCircleOutlined /> : <ClockCircleOutlined />}
            </div>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: accent, background: tint, border: `1px solid ${rejected ? '#fecaca' : '#fde68a'}`, borderRadius: 999, padding: '3px 10px', marginBottom: 10 }}>
              {rejected ? 'NOT APPROVED' : 'PENDING APPROVAL'}
            </span>
            <Title level={4} style={{ margin: '0 0 6px', color: '#0f172a' }}>
              {rejected ? 'Registration not approved' : `Thanks, ${retailerProfile.ownerName || 'Partner'}`}
            </Title>
            <Paragraph style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
              {rejected ? (
                <>The registration for <b style={{ color: '#0f172a' }}>{retailerProfile.storeName || 'your store'}</b> was not approved. Contact us if you think this is a mistake or want to correct your details.</>
              ) : (
                <>We are verifying the store details for <b style={{ color: '#0f172a' }}>{retailerProfile.storeName || 'your store'}</b>. You can start ordering as soon as it is approved.</>
              )}
            </Paragraph>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0 20px 18px' }}>
            {steps.map((st, i) => {
              const color = stepColor[st.state];
              return (
                <div key={st.label} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  {i > 0 ? <div style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2, background: st.state === 'todo' ? '#e2e8f0' : color }} /> : null}
                  <div style={{ position: 'relative', width: 24, height: 24, margin: '0 auto 6px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, color: '#fff', background: st.state === 'todo' ? '#fff' : color, border: `2px solid ${color}` }}>
                    {st.state === 'done' ? <CheckCircleOutlined /> : st.state === 'current' ? <LoadingOutlined spin /> : st.state === 'failed' ? <CloseCircleOutlined /> : null}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: st.state === 'todo' ? 500 : 600, color: st.state === 'todo' ? '#94a3b8' : '#334155' }}>{st.label}</div>
                </div>
              );
            })}
          </div>

          {rejected ? (
            <div style={{ padding: '0 20px 16px' }}>
              <Alert type="error" showIcon message="Reason" description={retailerProfile.rejectionReason || 'No reason was given.'} />
              {support.data ? (
                <Space direction="vertical" size={4} style={{ marginTop: 10, fontSize: 13 }}>
                  {support.data.isPhoneSupportActive && support.data.tollFreeNumber ? <span><PhoneOutlined /> {support.data.tollFreeNumber}</span> : null}
                  {support.data.isEmailSupportActive && support.data.supportEmail ? <a href={`mailto:${support.data.supportEmail}`}><MailOutlined /> {support.data.supportEmail}</a> : null}
                </Space>
              ) : null}
            </div>
          ) : (
            <div style={{ margin: '0 20px 16px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
              This page updates by itself every 30 seconds
              {lastChecked ? ` · last checked ${lastChecked.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
          )}

          {/* Submitted details */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px 4px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShopOutlined /> SUBMITTED DETAILS
            </div>
            {details.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: i < details.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14 }}>
                <span style={{ color: '#64748b', flexShrink: 0 }}>{k}</span>
                <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, padding: '14px 20px 20px', flexWrap: 'wrap' }}>
            {rejected ? null : (
              <Button type="primary" size="large" icon={<ReloadOutlined />} loading={checking} onClick={handleManualCheck}
                style={{ flex: '1 1 200px', background: '#d97706', borderColor: '#d97706', borderRadius: 10, fontWeight: 600 }}>
                Check status
              </Button>
            )}
            <Button size="large" icon={<DisconnectOutlined />} onClick={signOut} style={{ flex: '1 1 140px', borderRadius: 10 }}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
