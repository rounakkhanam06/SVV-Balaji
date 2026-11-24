import { useState } from 'react';
import {
  BankOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Col, Divider, Form, Input, Modal, Row, Steps, Tag, Typography } from 'antd';
import { App as AntApp } from 'antd';
import { authApi } from '@shared/api/auth';
import { useAuth } from '../../auth/useAuth';
import { ROLE_LABELS } from '@shared/auth/types';

const BRAND = '#1E5E3A';
const MUTED_ICON = { color: '#94A3B8' };

/** Rough strength hint for a new password - advisory only; the server enforces the minimum. */
function StrengthMeter({ value }: { value: string }) {
  if (!value) return null;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const level = score <= 2 ? 0 : score <= 3 ? 1 : 2;
  const meta = [
    { label: 'Weak', color: '#DC2626' },
    { label: 'Fair', color: '#D97706' },
    { label: 'Strong', color: '#16A34A' },
  ][level];
  return (
    <div style={{ marginTop: -4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= level ? meta.color : '#E5E7EB' }} />
        ))}
      </div>
      <Typography.Text style={{ fontSize: 12, color: meta.color }}>
        {meta.label} password{level < 2 ? ' - mix upper and lower case, numbers and symbols' : ''}
      </Typography.Text>
    </div>
  );
}

export function ProfilePage() {
  const { user, reload } = useAuth();
  const { message } = AntApp.useApp();

  const [activeTab, setActiveTab] = useState('1');

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // 2FA setup
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [enablingTwoFactor, setEnablingTwoFactor] = useState(false);

  // 2FA disable
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);

  if (!user) return null;

  const onUpdateProfile = async (values: any) => {
    setUpdatingProfile(true);
    try {
      await authApi.updateProfile({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || null,
      });
      message.success('Profile updated successfully');
      await reload();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const onChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('Password updated successfully. Other sessions have been signed out.');
      passwordForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const startTwoFactorSetup = async () => {
    try {
      const res = await authApi.generateTwoFactor();
      setSecret(res.secret);
      setQrCodeUrl(res.qrCodeDataUrl);
      setSetupStep(0);
      setRecoveryCodes(null);
      setTwoFactorCode('');
      setSetupModalVisible(true);
    } catch {
      message.error('Failed to initiate 2FA setup');
    }
  };

  const confirmTwoFactorSetup = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      message.error('Please enter a valid 6-digit code');
      return;
    }
    setEnablingTwoFactor(true);
    try {
      const res = await authApi.enableTwoFactor(twoFactorCode);
      setRecoveryCodes(res.recoveryCodes);
      setSetupStep(1);
      await reload();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setEnablingTwoFactor(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disablePassword) {
      message.error('Please enter your password');
      return;
    }
    setDisablingTwoFactor(true);
    try {
      await authApi.disableTwoFactor(disablePassword);
      message.success('Two-Factor Authentication disabled');
      setDisableModalVisible(false);
      setDisablePassword('');
      await reload();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setDisablingTwoFactor(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const initials = (user.fullName || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sections = [
    { key: '1', icon: <UserOutlined />, title: 'Personal details', hint: 'Name, email and phone' },
    { key: '2', icon: <LockOutlined />, title: 'Password', hint: 'Change your sign-in password' },
    {
      key: '3',
      icon: <SafetyCertificateOutlined />,
      title: 'Two-factor authentication',
      hint: user.isTwoFactorEnabled ? 'On' : 'Off - recommended',
    },
  ];
  const current = sections.find((x) => x.key === activeTab) ?? sections[0];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Profile banner */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #DCEBE1', background: 'linear-gradient(135deg, #F3F9F5 0%, #E6F2EA 100%)' }}
        styles={{ body: { padding: 24 } }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
          <Avatar size={84} style={{ background: BRAND, fontSize: 30, fontWeight: 600, flex: '0 0 84px', boxShadow: '0 0 0 4px #fff' }}>
            {initials}
          </Avatar>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Typography.Title level={3} style={{ margin: 0, color: '#0F172A' }}>
              {user.fullName}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              <MailOutlined /> {user.email}
              {user.phone ? (
                <span style={{ marginLeft: 14 }}>
                  <PhoneOutlined /> {user.phone}
                </span>
              ) : null}
            </Typography.Text>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="green" style={{ margin: 0, fontWeight: 500 }}>
                {ROLE_LABELS[user.role]}
              </Tag>
              {user.branch ? (
                <Tag icon={<BankOutlined />} style={{ margin: 0 }}>
                  {user.branch.name}
                </Tag>
              ) : null}
              <Tag color={user.status === 'ACTIVE' ? 'success' : 'error'} style={{ margin: 0 }}>
                {user.status === 'ACTIVE' ? 'Active' : user.status}
              </Tag>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #DCEBE1', borderRadius: 12, padding: '14px 18px', minWidth: 220 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Account security
            </Typography.Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {user.isTwoFactorEnabled ? (
                <>
                  <CheckCircleOutlined style={{ color: '#16A34A', fontSize: 18 }} />
                  <Typography.Text strong>Strong - 2FA on</Typography.Text>
                </>
              ) : (
                <>
                  <WarningOutlined style={{ color: '#D97706', fontSize: 18 }} />
                  <Typography.Text strong>Basic - 2FA off</Typography.Text>
                </>
              )}
            </div>
            {!user.isTwoFactorEnabled ? (
              <Button type="link" size="small" style={{ padding: 0, height: 'auto', marginTop: 4 }} onClick={() => setActiveTab('3')}>
                Turn on 2FA →
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        {/* Section menu */}
        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 14, border: '1px solid #EEF2F0' }} styles={{ body: { padding: 8 } }}>
            {sections.map((sec) => {
              const active = sec.key === activeTab;
              return (
                <div
                  key={sec.key}
                  onClick={() => setActiveTab(sec.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: active ? '#E8F3EC' : undefined,
                    transition: 'background .15s',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 16,
                      flex: '0 0 36px',
                      background: active ? BRAND : '#F1F5F3',
                      color: active ? '#fff' : BRAND,
                    }}
                  >
                    {sec.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block', color: active ? BRAND : '#0F172A' }}>
                      {sec.title}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {sec.hint}
                    </Typography.Text>
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>

        {/* Section content */}
        <Col xs={24} md={16}>
          <Card
            style={{ borderRadius: 14, border: '1px solid #EEF2F0' }}
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
                <span style={{ color: BRAND }}>{current.icon}</span>
                {current.title}
              </span>
            }
            styles={{ body: { padding: 24 } }}
          >
            {activeTab === '1' ? (
              <Form
                form={profileForm}
                layout="vertical"
                requiredMark={false}
                initialValues={{ fullName: user.fullName, email: user.email, phone: user.phone }}
                onFinish={onUpdateProfile}
              >
                <Form.Item label="Full name" name="fullName" rules={[{ required: true, message: 'Enter your name' }]}>
                  <Input size="large" prefix={<UserOutlined style={MUTED_ICON} />} />
                </Form.Item>
                <Row gutter={16}>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      label="Email address"
                      name="email"
                      rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
                      extra="You sign in with this email."
                    >
                      <Input size="large" prefix={<MailOutlined style={MUTED_ICON} />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={10}>
                    <Form.Item label="Phone number" name="phone">
                      <Input size="large" prefix={<PhoneOutlined style={MUTED_ICON} />} placeholder="Optional" />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider style={{ margin: '8px 0 20px' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <Button onClick={() => profileForm.resetFields()}>Reset</Button>
                  <Button type="primary" htmlType="submit" loading={updatingProfile}>
                    Save changes
                  </Button>
                </div>
              </Form>
            ) : null}

            {activeTab === '2' ? (
              <Form form={passwordForm} layout="vertical" requiredMark={false} onFinish={onChangePassword}>
                <Form.Item label="Current password" name="currentPassword" rules={[{ required: true, message: 'Enter your current password' }]}>
                  <Input.Password size="large" prefix={<LockOutlined style={MUTED_ICON} />} />
                </Form.Item>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="New password" name="newPassword" rules={[{ required: true, min: 8, message: 'At least 8 characters' }]}>
                      <Input.Password size="large" prefix={<KeyOutlined style={MUTED_ICON} />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Confirm new password"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: 'Repeat the new password' },
                        ({ getFieldValue }) => ({
                          validator: (_, v) =>
                            !v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')),
                        }),
                      ]}
                    >
                      <Input.Password size="large" prefix={<KeyOutlined style={MUTED_ICON} />} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item noStyle shouldUpdate={(a, b) => a.newPassword !== b.newPassword}>
                  {({ getFieldValue }) => <StrengthMeter value={getFieldValue('newPassword') ?? ''} />}
                </Form.Item>
                <Alert
                  type="warning"
                  showIcon
                  message="Changing your password signs you out on every other device."
                  style={{ margin: '16px 0 20px', borderRadius: 10 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" htmlType="submit" loading={updatingPassword}>
                    Update password
                  </Button>
                </div>
              </Form>
            ) : null}

            {activeTab === '3' ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 16,
                    padding: 18,
                    borderRadius: 12,
                    background: user.isTwoFactorEnabled ? '#F0FDF4' : '#FFFBEB',
                    border: `1px solid ${user.isTwoFactorEnabled ? '#BBF7D0' : '#FDE68A'}`,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 22,
                      flex: '0 0 48px',
                      background: '#fff',
                      color: user.isTwoFactorEnabled ? '#16A34A' : '#D97706',
                    }}
                  >
                    {user.isTwoFactorEnabled ? <CheckCircleOutlined /> : <SafetyCertificateOutlined />}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Typography.Text strong style={{ display: 'block', fontSize: 15 }}>
                      {user.isTwoFactorEnabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {user.isTwoFactorEnabled
                        ? 'A code from your authenticator app is needed at every sign-in.'
                        : 'Add a second step to sign-in so a stolen password is not enough.'}
                    </Typography.Text>
                  </div>
                  {user.isTwoFactorEnabled ? (
                    <Button danger onClick={() => setDisableModalVisible(true)}>
                      Turn off
                    </Button>
                  ) : (
                    <Button type="primary" onClick={startTwoFactorSetup}>
                      Set up 2FA
                    </Button>
                  )}
                </div>
                <Typography.Title level={5} style={{ marginTop: 24 }}>
                  How it works
                </Typography.Title>
                {[
                  'Install an authenticator app such as Google Authenticator or Microsoft Authenticator.',
                  'Scan the QR code we show you, then enter the 6-digit code to confirm.',
                  'Save your recovery codes somewhere safe - they get you in if you lose your phone.',
                ].map((t, i) => (
                  <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#E8F3EC',
                        color: BRAND,
                        fontWeight: 600,
                        fontSize: 12,
                        display: 'grid',
                        placeItems: 'center',
                        flex: '0 0 24px',
                      }}
                    >
                      {i + 1}
                    </span>
                    <Typography.Text type="secondary">{t}</Typography.Text>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>

      {/* 2FA setup */}
      <Modal title="Set up two-factor authentication" open={setupModalVisible} onCancel={() => setSetupModalVisible(false)} footer={null} width={600}>
        <Steps current={setupStep} items={[{ title: 'Authenticator app' }, { title: 'Recovery codes' }]} style={{ marginBottom: 24 }} />

        {setupStep === 0 && (
          <div>
            <Typography.Paragraph>1. Scan this QR code with your authenticator app.</Typography.Paragraph>
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              {qrCodeUrl ? <img src={qrCodeUrl} alt="QR code" style={{ border: '1px solid #eee', borderRadius: 8, padding: 8, background: '#fff' }} /> : null}
            </div>
            <Typography.Paragraph>
              Or enter this code manually:
              <Typography.Text code copyable style={{ marginLeft: 8 }}>
                {secret}
              </Typography.Text>
            </Typography.Paragraph>
            <Divider />
            <Typography.Paragraph>2. Enter the 6-digit code generated by the app.</Typography.Paragraph>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input
                placeholder="000000"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: 140, fontSize: 18, letterSpacing: 6, textAlign: 'center' }}
                size="large"
              />
              <Button type="primary" size="large" onClick={confirmTwoFactorSetup} loading={enablingTwoFactor}>
                Verify & activate
              </Button>
            </div>
          </div>
        )}

        {setupStep === 1 && (
          <div>
            <Alert type="success" showIcon message="Two-factor authentication is now on." style={{ marginBottom: 24 }} />
            <Typography.Title level={5}>Save your recovery codes</Typography.Title>
            <Typography.Paragraph>
              These codes get you into your account if you lose your phone.
              <strong> They are shown only once.</strong> Each code works one time.
            </Typography.Paragraph>
            <div
              style={{
                background: '#F6FAF7',
                border: '1px solid #E3EFE7',
                padding: 16,
                borderRadius: 10,
                fontFamily: 'monospace',
                fontSize: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {recoveryCodes?.map((code) => (
                <div key={code}>{code}</div>
              ))}
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={() => copyToClipboard(recoveryCodes?.join('\n') || '')}>Copy codes</Button>
              <Button type="primary" onClick={() => setSetupModalVisible(false)}>
                I have saved these codes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2FA disable */}
      <Modal title="Turn off two-factor authentication" open={disableModalVisible} onCancel={() => setDisableModalVisible(false)} footer={null}>
        <Typography.Paragraph>
          Your account will be protected by your password only. Enter your current password to confirm.
        </Typography.Paragraph>
        <Input.Password
          placeholder="Current password"
          value={disablePassword}
          onChange={(e) => setDisablePassword(e.target.value)}
          style={{ marginBottom: 16 }}
          size="large"
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => setDisableModalVisible(false)}>Cancel</Button>
          <Button danger type="primary" onClick={disableTwoFactor} loading={disablingTwoFactor}>
            Turn off 2FA
          </Button>
        </div>
      </Modal>
    </div>
  );
}
