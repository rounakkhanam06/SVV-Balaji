import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Divider, Form, Input, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { authApi } from '@shared/api/auth';
import { useAuth } from '../auth/useAuth';
import { tokenStore } from '../api/tokenStore';

const { Text, Title } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const { user, initialising, reload } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);

  // Where RequireAuth bounced them from, so they land back on it after signing in.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  if (!initialising && user) {
    return <Navigate to={from} replace />;
  }

  const onFinish = async (values: LoginForm) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.login(values.email.trim(), values.password);

      if ('requiresTwoFactor' in result) {
        setRequiresTwoFactor(true);
        setTwoFactorToken(result.twoFactorToken);
        return;
      }

      tokenStore.set({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      await reload();
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in'));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyTwoFactor = async () => {
    if (!twoFactorToken) return;
    setVerifyingTwoFactor(true);
    setError(null);
    try {
      const session = await authApi.verifyTwoFactorLogin(twoFactorToken, twoFactorCode);
      tokenStore.set({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      await reload();
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid or expired 2FA code'));
      setVerifyingTwoFactor(false);
    }
  };

  return (
    <div className="login-page-bg">
      <div className="login-card-container">
        <Card className="login-card">
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 24px rgba(22, 101, 52, 0.12), 0 0 0 1px rgba(22, 101, 52, 0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                marginBottom: 16,
              }}
            >
              <img
                src="/svv-balaji.png"
                alt="SVV Balaji"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              SVV Balaji
            </Title>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Tag
                color="green"
                style={{
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '1px 10px',
                  margin: 0,
                }}
              >
                Enterprise Admin Portal
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
              Sign in with your enterprise credentials to access management console.
            </Text>
          </div>

          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 20, borderRadius: 10 }}
            />
          ) : null}

          {requiresTwoFactor ? (
            <div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <SafetyCertificateFilled style={{ color: '#16a34a', fontSize: 20, marginTop: 2 }} />
                <div>
                  <Text strong style={{ color: '#166534', fontSize: 14 }}>
                    Two-Factor Authentication
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                    Enter the 6-digit code from your authenticator app (Google Authenticator / Authy).
                  </Text>
                </div>
              </div>

              <Input
                size="large"
                placeholder="000000"
                maxLength={8}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.trim())}
                style={{
                  textAlign: 'center',
                  fontSize: 26,
                  letterSpacing: 6,
                  fontWeight: 700,
                  borderRadius: 10,
                  marginBottom: 16,
                  padding: '10px',
                }}
                onPressEnter={onVerifyTwoFactor}
                autoFocus
              />

              <Button
                type="primary"
                block
                size="large"
                onClick={onVerifyTwoFactor}
                loading={verifyingTwoFactor}
                disabled={!twoFactorCode}
                style={{
                  borderRadius: 10,
                  height: 46,
                  fontWeight: 600,
                  backgroundColor: '#166534',
                  borderColor: '#166534',
                  boxShadow: '0 4px 12px rgba(22, 101, 52, 0.2)',
                }}
              >
                Verify & Sign In
              </Button>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Button
                  type="link"
                  onClick={() => {
                    setRequiresTwoFactor(false);
                    setTwoFactorToken(null);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                  style={{ fontSize: 13 }}
                >
                  ← Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <Form<LoginForm>
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              size="large"
            >
              <Form.Item
                name="email"
                label={<Text strong style={{ fontSize: 13, color: '#334155' }}>Enterprise Email</Text>}
                rules={[
                  { required: true, message: 'Please enter your work email' },
                  { type: 'email', message: 'Enter a valid email address' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#94a3b8', marginRight: 4 }} />}
                  placeholder="name@svvbalaji.com"
                  autoComplete="username"
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<Text strong style={{ fontSize: 13, color: '#334155' }}>Password</Text>}
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: 4 }} />}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{ borderRadius: 10 }}
                />
              </Form.Item>

              <div style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={submitting}
                  icon={<ArrowRightOutlined />}
                  style={{
                    borderRadius: 10,
                    height: 46,
                    fontWeight: 600,
                    fontSize: 15,
                    backgroundColor: '#166534',
                    borderColor: '#166534',
                    boxShadow: '0 4px 14px rgba(22, 101, 52, 0.25)',
                  }}
                >
                  Sign In to Dashboard
                </Button>
              </div>
            </Form>
          )}

          <Divider style={{ margin: '24px 0 16px' }} />

          {/* Security Footnote */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#64748b',
                backgroundColor: '#f8fafc',
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
              }}
            >
              <SafetyCertificateOutlined style={{ color: '#16a34a' }} />
              <span>256-Bit SSL Encrypted Enterprise Session</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginTop: 10 }}>
              SVV Balaji Food & Beverages Pvt. Ltd.
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, letterSpacing: '0.4px', marginTop: 2 }}>
              Discover Natural Taste
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
