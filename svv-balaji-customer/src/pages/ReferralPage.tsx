import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleFilled,
  CopyOutlined,
  CrownFilled,
  GiftOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  ShareAltOutlined,
  ShoppingOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  WalletOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Collapse,
  Divider,
  Empty,
  Input,
  Modal,
  Skeleton,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storefrontAuthApi } from '../api/storefrontAuth';
import type { CustomerReferralSummaryResponse, ReferralProgramResponse } from '../api/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useLoyalty } from '../loyalty/useLoyalty';

const TRIGGER_DESCRIPTIONS: Record<string, { label: string; condition: string }> = {
  REGISTRATION: {
    label: 'On Registration',
    condition: 'Credited instantly when your friend creates their account.',
  },
  FIRST_DELIVERY: {
    label: 'On First Order Delivered',
    condition: 'Credited when your friend receives their first delivery safely at their doorstep.',
  },
};

export function ReferralPage() {
  const navigate = useNavigate();
  const { role, customerProfile, retailerProfile } = useCustomerAuth();
  const loyalty = useLoyalty();

  const isRetailer = role === 'RETAILER';
  const isGuest = role === 'GUEST';

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [programLoading, setProgramLoading] = useState(true);
  const [program, setProgram] = useState<ReferralProgramResponse>({
    isActive: true,
    referrerRewardCoins: 100,
    refereeRewardCoins: 50,
    rewardTrigger: 'FIRST_DELIVERY',
  });

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<CustomerReferralSummaryResponse | null>(null);

  const [applyCodeInput, setApplyCodeInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  // Fetch program rules & active configuration
  useEffect(() => {
    let mounted = true;
    storefrontAuthApi
      .getReferralProgram()
      .then((res) => {
        if (mounted && res) setProgram(res);
      })
      .catch(() => {
        // Fallback to project defaults
      })
      .finally(() => {
        if (mounted) setProgramLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const refreshSummary = () => {
    if (isGuest) return;
    setSummaryLoading(true);
    return storefrontAuthApi
      .getMyReferralSummary()
      .then((res) => {
        if (res) setSummary(res);
      })
      .catch(() => {
        // Non-critical fallback
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  };

  // Fetch customer's own referral metrics & history
  useEffect(() => {
    if (isGuest) return;
    let mounted = true;
    setSummaryLoading(true);
    storefrontAuthApi
      .getMyReferralSummary()
      .then((res) => {
        if (mounted && res) setSummary(res);
      })
      .catch(() => {
        // Non-critical fallback
      })
      .finally(() => {
        if (mounted) setSummaryLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isGuest]);

  const handleApplyReferralCode = () => {
    const code = applyCodeInput.trim();
    if (!code) {
      message.info('Enter a referral code to apply.');
      return;
    }
    setApplyingCode(true);
    storefrontAuthApi
      .applyReferralCode(code)
      .then((res) => {
        message.success(`Applied! You're referred by ${res.referrerName}.`);
        setApplyCodeInput('');
        return refreshSummary();
      })
      .catch((err) => {
        message.error(err?.response?.data?.message || 'Could not apply this referral code.');
      })
      .finally(() => {
        setApplyingCode(false);
      });
  };

  const activeReferralCode =
    summary?.referralCode ||
    (isRetailer ? retailerProfile?.referralCode : customerProfile?.referralCode) ||
    '';

  const inviteLink = activeReferralCode
    ? `${window.location.origin}/${isRetailer ? 'retailers/register' : 'login'}?ref=${activeReferralCode}`
    : `${window.location.origin}/login`;

  const brandPrimary = isRetailer ? '#059669' : '#ea580c';
  const brandDark = isRetailer ? '#065f46' : '#c2410c';

  const triggerInfo =
    TRIGGER_DESCRIPTIONS[program.rewardTrigger] || TRIGGER_DESCRIPTIONS.FIRST_DELIVERY;

  const handleCopyCode = () => {
    if (!activeReferralCode) {
      message.info('Your referral code is being generated. Please sign in or refresh.');
      return;
    }
    void navigator.clipboard?.writeText(activeReferralCode).then(() => {
      setCopiedCode(true);
      message.success(`Referral code ${activeReferralCode} copied to clipboard!`);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const handleCopyLink = () => {
    if (!activeReferralCode) {
      message.info('Your referral link is being generated. Please sign in or refresh.');
      return;
    }
    void navigator.clipboard?.writeText(inviteLink).then(() => {
      setCopiedLink(true);
      message.success('Invite link copied! Share it with friends and family.');
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleWhatsAppShare = () => {
    if (!activeReferralCode) {
      message.info('Please sign in to share your referral code.');
      return;
    }

    const shareText = isRetailer
      ? `Namaste! Join SVV Balaji wholesale mandi direct platform. Register your store with my partner referral code *${activeReferralCode}* to get mandi bulk rates, GST billing, and ₹${program.refereeRewardCoins} welcome reward coins! Join here: ${inviteLink}`
      : `Hey! I order fresh, authentic grocery staples & pantry items directly from SVV Balaji / Desi Tokri. Use my referral code *${activeReferralCode}* when signing up to get *₹${program.refereeRewardCoins} worth Reward Coins* on your first purchase! Register here: ${inviteLink}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleNativeShare = () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }
    const shareText = isRetailer
      ? `Register your retail shop on SVV Balaji with code ${activeReferralCode} for exclusive wholesale pricing and welcome reward coins!`
      : `Shop 100% natural, farm-sourced staples on Desi Tokri. Use code ${activeReferralCode} to get ${program.refereeRewardCoins} welcome coins!`;

    navigator
      .share({
        title: 'Join SVV Balaji Desi Tokri & Earn Rewards',
        text: shareText,
        url: inviteLink,
      })
      .catch(() => {
        // User cancelled share
      });
  };

  const totalFriendsCount = summary?.totalReferred ?? (summary?.referrals.length || 0);
  const successfulCount = summary?.successfulReferrals ?? 0;
  const coinsEarned = summary?.totalCoinsEarned ?? (successfulCount * program.referrerRewardCoins);

  const accentTint = isRetailer ? '#ecfdf5' : '#fff7ed';
  const heroBg = isRetailer ? '#eef7f1' : '#fdf1e8';
  const faqs =
    (isRetailer ? program.retailerFaqs : program.customerFaqs) || [
      {
        question: 'Where do I find my reward coins once earned?',
        answer: 'All referral reward coins are directly credited to your Desi Rewards balance. You can view your points and past earnings breakdown anytime under Desi Rewards in your profile.',
      },
      {
        question: 'How much are referral coins worth?',
        answer: '1 Desi Coin = ₹1 INR. You can apply your coins during checkout to deduct the amount from your eligible orders.',
      },
      {
        question: 'When does my reward get credited?',
        answer: `Per our active program policy (${triggerInfo.label}), rewards are credited automatically ${triggerInfo.condition.toLowerCase()}`,
      },
      {
        question: 'How many coins will my friend and I get?',
        answer: `You receive ${program.referrerRewardCoins} Coins (₹${program.referrerRewardCoins}) and your friend receives ${program.refereeRewardCoins} Coins (₹${program.refereeRewardCoins})!`,
      },
      {
        question: 'Can I refer myself using multiple phone numbers?',
        answer: 'Self-referrals (matching phone number or registered email address) are blocked by our audit system to prevent misuse.',
      },
    ];

  const steps = [
    { title: 'Share your code or link', text: 'Send it to friends, relatives or fellow shop owners on WhatsApp or SMS.' },
    { title: 'Friend signs up', text: 'They enter your code in the referral box while registering.' },
    {
      title: 'Both of you earn',
      text: `You get ${program.referrerRewardCoins} coins, they get ${program.refereeRewardCoins} coins, ${triggerInfo.condition.toLowerCase()}`,
    },
  ];

  return (
    <div className="ref-page">
      {/* Phone header: back, title, coin balance */}
      <header className="mobile-flex ref-topbar">
        <button type="button" onClick={() => navigate(-1)} className="ref-icon-btn" aria-label="Back">
          <ArrowLeftOutlined />
        </button>
        <span className="ref-topbar-title">Refer &amp; Earn</span>
        <Link to="/loyalty" className="ref-coins" style={{ color: brandPrimary }}>
          <WalletOutlined /> {loyalty.points.toLocaleString('en-IN')}
        </Link>
      </header>

      <div className="ref-wrap">
        <div className="desktop-only" style={{ marginBottom: 14 }}>
          <Breadcrumb
            items={[
              { title: <Link to="/">Home</Link> },
              { title: <Link to="/profile">My Account</Link> },
              { title: 'Refer & Earn' },
            ]}
          />
        </div>

        {/* Hero: illustration, one headline, one line of what both sides get */}
        <section className="ref-hero" style={{ background: heroBg }}>
          <InviteIllustration accent={brandPrimary} />
          <h1 className="ref-title">{isRetailer ? 'Invite store partners!' : 'Invite friends!'}</h1>
          <p className="ref-sub">
            You get <strong>{program.referrerRewardCoins} coins</strong>, they get{' '}
            <strong>{program.refereeRewardCoins} coins</strong>
            <br />
            <span className="ref-sub-muted">{triggerInfo.condition}</span>
          </p>

          {isGuest ? (
            <Button type="primary" size="large" block className="ref-primary" style={{ background: brandPrimary, borderColor: brandPrimary }} onClick={() => navigate('/login')}>
              Sign in to get your code
            </Button>
          ) : (
            <>
              <button type="button" className="ref-code" onClick={handleCopyCode} aria-label="Copy referral code">
                <span className="ref-code-label">Your code</span>
                {activeReferralCode ? (
                  <span className="ref-code-value" style={{ color: brandDark }}>{activeReferralCode}</span>
                ) : (
                  <Skeleton.Button active size="small" style={{ width: 120 }} />
                )}
                <span className="ref-code-copy" style={{ color: copiedCode ? '#16a34a' : brandPrimary }}>
                  {copiedCode ? <CheckOutlined /> : <CopyOutlined />} {copiedCode ? 'Copied' : 'Copy'}
                </span>
              </button>

              <Button type="primary" size="large" block className="ref-primary ref-wa" icon={<WhatsAppOutlined />} onClick={handleWhatsAppShare}>
                Invite on WhatsApp
              </Button>
              <div className="ref-secondary">
                <Button block icon={copiedLink ? <CheckOutlined /> : <LinkOutlined />} onClick={handleCopyLink}>
                  {copiedLink ? 'Link copied' : 'Copy link'}
                </Button>
                {typeof navigator !== 'undefined' && 'share' in navigator ? (
                  <Button block icon={<ShareAltOutlined />} onClick={handleNativeShare}>
                    More
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </section>

        {/* Stats: one quiet row */}
        {!isGuest ? (
          <section className="ref-card ref-stats">
            {[
              { label: 'Invited', value: totalFriendsCount },
              { label: 'Qualified', value: successfulCount },
              { label: 'Coins earned', value: coinsEarned.toLocaleString('en-IN') },
            ].map((s) => (
              <div key={s.label} className="ref-stat">
                <div className="ref-stat-value">{summaryLoading ? <Spin size="small" /> : s.value}</div>
                <div className="ref-stat-label">{s.label}</div>
              </div>
            ))}
          </section>
        ) : null}

        {/* Referred by / apply a code */}
        {!isGuest && !summaryLoading ? (
          summary?.appliedReferral ? (
            <section className="ref-card ref-row">
              <CheckCircleFilled style={{ color: '#059669', fontSize: 20 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ref-row-title">Referred by {summary.appliedReferral.referrerName}</div>
                <div className="ref-row-sub">Code {summary.appliedReferral.code}</div>
              </div>
              {summary.appliedReferral.status === 'QUALIFIED' ? (
                <Tag color="green" style={{ margin: 0 }}>+{program.refereeRewardCoins} coins</Tag>
              ) : (
                <Tag color="gold" style={{ margin: 0 }}>Pending</Tag>
              )}
            </section>
          ) : summary?.canApplyReferralCode ? (
            <section className="ref-card">
              <div className="ref-row-title">Have a friend&apos;s code?</div>
              <div className="ref-row-sub" style={{ marginBottom: 10 }}>
                Apply it before your first order to get {program.refereeRewardCoins} welcome coins.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={applyCodeInput}
                  onChange={(e) => setApplyCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  style={{ height: 42, borderRadius: 10, fontFamily: 'monospace', letterSpacing: 1 }}
                  onPressEnter={handleApplyReferralCode}
                />
                <Button type="primary" loading={applyingCode} onClick={handleApplyReferralCode} style={{ height: 42, borderRadius: 10, background: brandPrimary, borderColor: brandPrimary, fontWeight: 600 }}>
                  Apply
                </Button>
              </div>
            </section>
          ) : null
        ) : null}

        {/* How it works */}
        <section className="ref-card">
          <div className="ref-h2">How it works</div>
          {steps.map((s, i) => (
            <div key={s.title} className="ref-step">
              <span className="ref-step-dot" style={{ background: accentTint, color: brandPrimary }}>{i + 1}</span>
              <div>
                <div className="ref-row-title">{s.title}</div>
                <div className="ref-row-sub">{s.text}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Friends who joined */}
        {!isGuest && summary?.referrals && summary.referrals.length > 0 ? (
          <section className="ref-card">
            <div className="ref-h2">Invited friends</div>
            {summary.referrals.map((item) => (
              <div key={item.id} className="ref-friend">
                <Avatar style={{ background: accentTint, color: brandPrimary, fontWeight: 600 }}>{item.refereeName[0] || 'F'}</Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ref-row-title">{item.refereeName}</div>
                  <div className="ref-row-sub">
                    Joined {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                {item.status === 'QUALIFIED' ? (
                  <Tag color="green" style={{ margin: 0 }}>+{program.referrerRewardCoins} coins</Tag>
                ) : (
                  <Tag style={{ margin: 0 }}>Pending</Tag>
                )}
              </div>
            ))}
          </section>
        ) : null}

        {/* FAQs (from Admin > Referral settings) */}
        <section className="ref-card">
          <div className="ref-h2">Questions</div>
          {programLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (
            <Collapse
              ghost
              expandIconPosition="end"
              items={faqs.map((faq, index) => ({
                key: String(index + 1),
                label: <span style={{ fontWeight: 600, color: '#1c1917' }}>{faq.question}</span>,
                children: <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>{faq.answer}</Typography.Text>,
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Two people linked by a spark - our own line drawing for the invite hero
 * (inline SVG, no image request). Ink outlines with the brand colour as accent.
 */
function InviteIllustration({ accent }: { accent: string }) {
  return (
    <svg className="ref-illus" viewBox="0 0 240 130" role="img" aria-label="Two friends connected">
      <g fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* left person */}
        <circle cx="62" cy="48" r="20" fill="#ffffff" />
        <path d="M28 118c0-22 15-38 34-38s34 16 34 38" fill="#ffffff" />
        <path d="M54 46h.01M70 46h.01" strokeWidth="4" />
        <path d="M55 56c4 4 10 4 14 0" />
        {/* right person */}
        <circle cx="178" cy="48" r="20" fill="#ffffff" />
        <path d="M144 118c0-22 15-38 34-38s34 16 34 38" fill="#ffffff" />
        <path d="M170 46h.01M186 46h.01" strokeWidth="4" />
        <path d="M171 56c4 4 10 4 14 0" />
        {/* link between them */}
        <path d="M92 82c18-14 38-14 56 0" strokeDasharray="2 7" />
      </g>
      {/* spark */}
      <g fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 18l-8 18h12l-8 18" />
        <path d="M104 22l-6-6M136 22l6-6M100 40h-8M140 40h8" />
      </g>
    </svg>
  );
}
