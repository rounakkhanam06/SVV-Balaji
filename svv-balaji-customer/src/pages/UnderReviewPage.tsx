import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClockCircleFilled,
  CloseCircleFilled,
  CloseCircleOutlined,
  DisconnectOutlined,
  IdcardOutlined,
  LoadingOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Result, Row, Space, Tag, Typography, message } from 'antd';
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 50%, #f0fdf4 100%)',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 680, width: '100%' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/images/desi-tokri-cropped.png" alt="Desi Tokri" style={{ height: 48, marginBottom: 16 }} />
        </div>

        {/* Main Status Hero Card */}
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #fde68a',
            overflow: 'hidden',
          }}
        >
          {/* Top Banner */}
          <div
            style={{
              background: rejected
                ? 'linear-gradient(90deg, #b91c1c 0%, #dc2626 100%)'
                : 'linear-gradient(90deg, #d97706 0%, #ea580c 100%)',
              padding: '20px 24px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '-24px -24px 24px -24px',
            }}
          >
            <Space align="center" size={12}>
              {rejected ? (
                <CloseCircleFilled style={{ fontSize: 24, color: '#fecaca' }} />
              ) : (
                <ClockCircleFilled style={{ fontSize: 24, color: '#fef08a' }} />
              )}
              <div>
                <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
                  {rejected ? 'Registration Not Approved' : 'Retailer Account Under Review'}
                </Title>
                <Text style={{ color: rejected ? '#fee2e2' : '#fef3c7', fontSize: 13 }}>
                  {rejected ? 'Reviewed by SVV Balaji Super Admin' : 'Verification in progress by SVV Balaji Super Admin'}
                </Text>
              </div>
            </Space>
            <Tag color={rejected ? 'red' : 'gold'} style={{ fontSize: 13, padding: '4px 12px', borderRadius: 12, fontWeight: 600 }}>
              {rejected ? 'NOT APPROVED' : 'PENDING APPROVAL'}
            </Tag>
          </div>

          {/* Body Content */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Result
              icon={
                rejected ? (
                  <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 54 }} />
                ) : (
                  <ClockCircleOutlined style={{ color: '#d97706', fontSize: 54 }} />
                )
              }
              title={
                <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                  Welcome, {retailerProfile?.ownerName || 'Partner'}!
                </span>
              }
              subTitle={
                <div style={{ maxWidth: 520, margin: '0 auto', color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
                  {rejected ? (
                    <>
                      The registration for <strong style={{ color: '#0f172a' }}>{retailerProfile.storeName || 'your store'}</strong>{' '}
                      was not approved. Contact us if you think this is a mistake or want to correct your details.
                    </>
                  ) : (
                    <>
                      Your business profile for{' '}
                      <strong style={{ color: '#0f172a' }}>{retailerProfile.storeName || 'your store'}</strong> has been
                      submitted. Our Super Admin team is reviewing your GSTIN and store details.
                    </>
                  )}
                </div>
              }
            />

            {rejected ? (
              <div style={{ maxWidth: 520, margin: '0 auto 24px', textAlign: 'left' }}>
                <Alert type="error" showIcon message="Reason" description={retailerProfile.rejectionReason || 'No reason was given.'} />
                {support.data ? (
                  <Space direction="vertical" size={4} style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
                    {support.data.isPhoneSupportActive && support.data.tollFreeNumber ? (
                      <span>
                        <PhoneOutlined /> {support.data.tollFreeNumber}
                      </span>
                    ) : null}
                    {support.data.isEmailSupportActive && support.data.supportEmail ? (
                      <a href={`mailto:${support.data.supportEmail}`}>
                        <MailOutlined /> {support.data.supportEmail}
                      </a>
                    ) : null}
                  </Space>
                ) : null}
              </div>
            ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '6px 16px',
                borderRadius: 20,
                color: '#92400e',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 24,
              }}
            >
              <LoadingOutlined spin style={{ color: '#d97706' }} />
              <span>
                We check every 30 seconds
                {lastChecked ? ` · last checked ${lastChecked.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
            </div>
            )}
          </div>

          {/* Submitted Profile Audit Box */}
          <Card
            type="inner"
            title={
              <Space>
                <ShopOutlined style={{ color: '#ea580c' }} />
                <span>Submitted Registration Details</span>
              </Space>
            }
            style={{ borderRadius: 12, background: '#fff9eb', borderColor: '#fef3c7', marginBottom: 24 }}
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Store / Business">
                <Text strong>{retailerProfile?.storeName || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Proprietor Name">
                <Text strong>{retailerProfile?.ownerName || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Registered Phone">
                <Text code>{retailerProfile?.phone || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Business Email">
                {retailerProfile?.email ? (
                  <Space size={4}>
                    <MailOutlined style={{ color: '#16a34a' }} />
                    <Text copyable={{ text: retailerProfile.email }}>
                      {retailerProfile.email}
                    </Text>
                  </Space>
                ) : (
                  <Text type="secondary">Not provided</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="GSTIN Number">
                <Text code style={{ color: '#d97706', fontWeight: 700 }}>
                  {retailerProfile?.gstin || '—'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {retailerProfile?.address || '—'} ({retailerProfile?.pincode})
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Bottom Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Button type="default" icon={<DisconnectOutlined />} onClick={signOut}>
              Sign Out
            </Button>
            {rejected ? null : (
            <Button
              type="primary"
              icon={checking ? <LoadingOutlined spin /> : <ReloadOutlined />}
              loading={checking}
              onClick={handleManualCheck}
              style={{ background: '#d97706', borderColor: '#d97706' }}
            >
              Check Approval Status
            </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
