import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  RightOutlined,
  SendOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { checkoutApi, type OrderDetail, type OrderSummaryRow } from '../api/checkout';
import type { SupportTicketCategory } from '../api/supportTickets';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import {
  useCreateSupportTicket,
  useReplyToSupportTicket,
  useSupportTicketThread,
  useSupportTickets,
} from '../hooks/useSupportTickets';
import { formatInr } from '../utils/money';
import { statusColor, statusLabel } from './orderStatus';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  senderName?: string;
  text: string;
  orderInfo?: {
    date: string;
    itemsText: string;
  };
  options?: Array<{
    id: string;
    text: string;
    boldWords?: string[];
    action: () => void;
  }>;
  timestamp: string;
}

const getCurrentTimeStr = () =>
  new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function OrderSupportPage() {
  const navigate = useNavigate();
  const { orderId: paramOrderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const queryOrderId = searchParams.get('orderId');
  const activeOrderNumber = paramOrderId || queryOrderId;

  const { isLoggedIn, customerProfile } = useCustomerAuth();
  const createTicket = useCreateSupportTicket();
  const replyTicket = useReplyToSupportTicket();
  const ticketsQuery = useSupportTickets();

  // Fetch orders list if no active order is selected or for order picker
  const ordersQuery = useQuery({
    queryKey: ['storefront', 'orders'],
    queryFn: checkoutApi.orders,
    enabled: isLoggedIn,
  });

  // Fetch single order details if orderNumber present
  const orderDetailsQuery = useQuery({
    queryKey: ['storefront', 'orders', activeOrderNumber],
    queryFn: () => checkoutApi.order(activeOrderNumber as string),
    enabled: Boolean(activeOrderNumber),
  });

  const activeOrder: OrderDetail | undefined = orderDetailsQuery.data;
  const recentOrders: OrderSummaryRow[] = ordersQuery.data ?? [];

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  // What the customer picked in the guided menu so far - goes into the ticket
  // so support sees the whole conversation, not a one-line summary.
  const pathRef = useRef<string[]>([]);

  // Every message is stored on a support ticket (never only in this page), so
  // the chat survives a reload and support sees exactly what was sent. One
  // conversation per order: reuse its latest ticket unless that one is closed.
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const existingTicket = useMemo(
    () =>
      (ticketsQuery.data ?? []).find(
        (t) => (t.orderNumber ?? null) === (activeOrderNumber ?? null) && t.status !== 'CLOSED',
      ) ?? null,
    [ticketsQuery.data, activeOrderNumber],
  );
  const activeTicketId = createdTicketId ?? existingTicket?.id ?? null;
  const thread = useSupportTicketThread(activeTicketId);
  const ticket = thread.data && thread.data.status !== 'CLOSED' ? thread.data : null;

  // Scroll the chat pane itself, not the window — on desktop the chat is a card
  // inside the page and scrollIntoView would drag the whole page along.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, botTyping]);

  // Helper to format date
  const formatOrderDate = (isoString?: string) => {
    if (!isoString) return 'Recent Order';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };

  // Build items summary string
  const getItemsSummary = (order?: OrderDetail) => {
    if (!order || !order.items || order.items.length === 0) return 'Various Grocery Items';
    return order.items.map((i) => `${i.name || 'Item'} (×${i.quantity})`).join(', ');
  };

  useEffect(() => {
    setCreatedTicketId(null);
    pathRef.current = [];
  }, [activeOrderNumber]);

  // Initialize Conversation
  useEffect(() => {
    if (activeOrderNumber && orderDetailsQuery.isLoading) return;

    const targetOrder = activeOrder || (recentOrders.length > 0 ? recentOrders[0] : null);
    const orderDate = targetOrder ? formatOrderDate((targetOrder as any).placedAt || (targetOrder as any).createdAt) : 'Recent Order';
    const itemsText = activeOrder ? getItemsSummary(activeOrder) : targetOrder ? (targetOrder as any).lines?.map((l: any) => l.name).join(', ') || 'Items' : 'Items';

    const initialMsgs: ChatMessage[] = [
      {
        id: 'msg-1',
        sender: 'bot',
        senderName: 'DesiTokri Buddy',
        text: targetOrder
          ? `Hi, we're happy to assist you for order #${targetOrder.orderNumber} placed on ${orderDate}`
          : `Hi, we're happy to assist you with your Desi Tokri orders!`,
        orderInfo: {
          date: orderDate,
          itemsText: itemsText,
        },
        timestamp: getCurrentTimeStr(),
      },
      {
        id: 'msg-2',
        sender: 'bot',
        senderName: 'DesiTokri Buddy',
        text: 'How may I help you today?',
        timestamp: getCurrentTimeStr(),
        options: getMainOptions(targetOrder?.orderNumber),
      },
    ];

    setMessages(initialMsgs);
  }, [activeOrderNumber, orderDetailsQuery.isLoading, ordersQuery.isLoading]);

  // Generate Main Options
  const getMainOptions = (ordNo?: string) => {
    return [
      {
        id: 'opt-item-issue',
        text: 'I have an issue with the ordered item(s)',
        boldWords: ['issue', 'ordered item(s)'],
        action: () => handleSelectOption('I have an issue with the ordered item(s)', 'item-issue'),
      },
      {
        id: 'opt-delivery-misconduct',
        text: 'I want to report delivery partner misconduct',
        action: () => handleSelectOption('I want to report delivery partner misconduct', 'delivery-misconduct'),
      },
      {
        id: 'opt-other-issue',
        text: 'I have another issue with my order',
        boldWords: ['another issue'],
        action: () => handleSelectOption('I have another issue with my order', 'other-issue'),
      },
      {
        id: 'opt-main-menu',
        text: 'Go back to main menu',
        action: () => handleSelectOption('Go back to main menu', 'main-menu'),
      },
    ];
  };

  // Add User message and trigger bot response
  const addUserMessage = (text: string) => {
    pathRef.current.push(text);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: getCurrentTimeStr(),
    };
    setMessages((prev) => [...prev, userMsg]);
  };

  const addBotMessage = (text: string, options?: ChatMessage['options']) => {
    setBotTyping(true);
    setTimeout(() => {
      setBotTyping(false);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        senderName: 'DesiTokri Buddy',
        text,
        timestamp: getCurrentTimeStr(),
        options,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 400);
  };

  // Flow Handlers
  const handleSelectOption = (userLabel: string, flowKey: string) => {
    addUserMessage(userLabel);

    if (flowKey === 'main-menu') {
      pathRef.current = [];
      addBotMessage('Here is the main menu. How else can I assist you?', getMainOptions(activeOrderNumber));
      return;
    }

    if (flowKey === 'item-issue') {
      if (activeOrder && activeOrder.items.length > 0) {
        const itemOptions = activeOrder.items.map((item) => ({
          id: `item-${item.productId}`,
          text: `Problem with ${item.name || 'Product'} (×${item.quantity})`,
          action: () => handleItemProblemSelect(item.name || 'Product'),
        }));
        itemOptions.push({
          id: 'item-all',
          text: 'Problem with multiple / all items',
          action: () => handleItemProblemSelect('Multiple items'),
        });
        itemOptions.push({
          id: 'item-back',
          text: 'Go back to main menu',
          action: () => handleSelectOption('Go back to main menu', 'main-menu'),
        });

        addBotMessage('Please select the item you are facing an issue with:', itemOptions);
      } else {
        addBotMessage('What problem are you facing with your item(s)?', [
          {
            id: 'prob-damaged',
            text: 'Damaged or spoiled product received',
            action: () => handleIssueTypeSelect('ORDER_ISSUE', 'Damaged / Spoiled product'),
          },
          {
            id: 'prob-missing',
            text: 'Item missing from package',
            action: () => handleIssueTypeSelect('ORDER_ISSUE', 'Missing item from package'),
          },
          {
            id: 'prob-wrong',
            text: 'Received wrong product',
            action: () => handleIssueTypeSelect('ORDER_ISSUE', 'Wrong item received'),
          },
          {
            id: 'prob-quality',
            text: 'Quality / Expiry date concern',
            action: () => handleIssueTypeSelect('ORDER_ISSUE', 'Quality / Expiry concern'),
          },
          {
            id: 'prob-back',
            text: 'Go back to main menu',
            action: () => handleSelectOption('Go back to main menu', 'main-menu'),
          },
        ]);
      }
    } else if (flowKey === 'delivery-misconduct') {
      addBotMessage('We take delivery partner misconduct very seriously. Please specify what happened:', [
        {
          id: 'del-rude',
          text: 'Delivery partner was rude / unprofessional',
          action: () => handleIssueTypeSelect('DELIVERY_DELAY', 'Delivery partner rude / unprofessional'),
        },
        {
          id: 'del-extra-cash',
          text: 'Demanded extra cash or fee',
          action: () => handleIssueTypeSelect('DELIVERY_DELAY', 'Demanded extra cash / fee'),
        },
        {
          id: 'del-careless',
          text: 'Handled parcel carelessly / dropped bag',
          action: () => handleIssueTypeSelect('DELIVERY_DELAY', 'Handled parcel carelessly'),
        },
        {
          id: 'del-back',
          text: 'Go back to main menu',
          action: () => handleSelectOption('Go back to main menu', 'main-menu'),
        },
      ]);
    } else if (flowKey === 'other-issue') {
      addBotMessage('Please select your query category:', [
        {
          id: 'oth-delay',
          text: 'Order is delayed / Not delivered yet',
          action: () => handleIssueTypeSelect('DELIVERY_DELAY', 'Order delivery delayed'),
        },
        {
          id: 'oth-payment',
          text: 'Payment / Refund inquiry',
          action: () => handleIssueTypeSelect('PAYMENT_REFUND', 'Payment or Refund inquiry'),
        },
        {
          id: 'oth-invoice',
          text: 'Need GST invoice copy',
          action: () => handleIssueTypeSelect('ACCOUNT_GST', 'GST Invoice request'),
        },
        {
          id: 'oth-back',
          text: 'Go back to main menu',
          action: () => handleSelectOption('Go back to main menu', 'main-menu'),
        },
      ]);
    }
  };

  const handleItemProblemSelect = (itemName: string) => {
    addUserMessage(`Issue with ${itemName}`);
    addBotMessage(`What is the specific issue with ${itemName}?`, [
      {
        id: 'spec-damaged',
        text: 'Item is damaged or spoiled',
        action: () => handleResolutionOffer(itemName, 'Damaged / Spoiled'),
      },
      {
        id: 'spec-missing',
        text: 'Item was missing in the bag',
        action: () => handleResolutionOffer(itemName, 'Missing from bag'),
      },
      {
        id: 'spec-wrong',
        text: 'Wrong item delivered',
        action: () => handleResolutionOffer(itemName, 'Wrong item delivered'),
      },
      {
        id: 'spec-back',
        text: 'Go back to main menu',
        action: () => handleSelectOption('Go back to main menu', 'main-menu'),
      },
    ]);
  };

  const handleResolutionOffer = (itemName: string, problemType: string) => {
    addUserMessage(`${problemType}`);
    addBotMessage(
      `We're sincerely sorry for the trouble with ${itemName}. How would you like us to resolve this for you?`,
      [
        {
          id: 'res-wallet',
          text: 'Instant Refund to Desi Tokri Wallet',
          boldWords: ['Instant Refund', 'Desi Tokri Wallet'],
          action: () => submitTicketAndFinalize('ORDER_ISSUE', `Refund request for ${itemName} (${problemType})`, 'Refund to Wallet'),
        },
        {
          id: 'res-replace',
          text: 'Request Replacement Item Delivery',
          boldWords: ['Replacement Item'],
          action: () => submitTicketAndFinalize('ORDER_ISSUE', `Replacement request for ${itemName} (${problemType})`, 'Replacement Delivery'),
        },
        {
          id: 'res-exec',
          text: 'Speak with Support Manager',
          action: () => submitTicketAndFinalize('ORDER_ISSUE', `Callback request for ${itemName} (${problemType})`, 'Support Manager Call'),
        },
      ],
    );
  };

  const handleIssueTypeSelect = (category: SupportTicketCategory, issueSubject: string) => {
    addUserMessage(issueSubject);
    submitTicketAndFinalize(category, issueSubject, 'Logged Ticket');
  };

  /**
   * Store the request: a reply on this order's open ticket if there is one,
   * otherwise a new ticket. `body` is exactly what support will read.
   */
  const sendToSupport = (category: SupportTicketCategory, subject: string, body: string, onDone?: () => void) => {
    const fail = (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(typeof msg === 'string' ? msg : 'Could not send your message. Please try again.');
    };
    if (activeTicketId && ticket) {
      replyTicket.mutate({ id: activeTicketId, body }, { onSuccess: () => onDone?.(), onError: fail });
      return;
    }
    createTicket.mutate(
      {
        category,
        subject: `[DesiTokri Support] ${subject}`.slice(0, 160),
        description: body.slice(0, 2000),
        orderNumber: activeOrderNumber || undefined,
      },
      {
        onSuccess: (created) => {
          setCreatedTicketId(created.id);
          onDone?.();
        },
        onError: fail,
      },
    );
  };

  const menuSteps = () => pathRef.current.filter((p) => p !== 'Go back to main menu');

  const submitTicketAndFinalize = (category: SupportTicketCategory, subject: string, resolutionChoice: string) => {
    const steps = menuSteps();
    const body = [
      `Issue: ${steps.length ? steps.join(' → ') : subject}`,
      `Resolution requested: ${resolutionChoice}`,
    ].join('\n');
    sendToSupport(category, subject, body, () => {
      pathRef.current = [];
    });
  };

  // Custom User Typing Send
  const handleSendCustomText = () => {
    if (!inputText.trim()) return;
    const txt = inputText.trim();
    const steps = menuSteps();
    const body = steps.length && !ticket ? `${txt}\n\n(Selected: ${steps.join(' → ')})` : txt;
    sendToSupport('OTHER', txt.slice(0, 120), body, () => {
      setInputText('');
      pathRef.current = [];
    });
  };

  const handleEndChat = () => {
    message.info('Support chat ended');
    if (activeOrderNumber) {
      navigate(`/orders/${activeOrderNumber}`);
    } else {
      navigate('/orders');
    }
  };

  // Once a ticket exists the chat IS that ticket - every message from both
  // sides as stored, so it reads the same after a reload or on another device.
  const displayMessages: ChatMessage[] = ticket
    ? [
        ...messages.slice(0, 1).map((m) => ({ ...m, options: undefined })),
        { id: 'ticket-opening', sender: 'user' as const, text: ticket.description, timestamp: timeOf(ticket.createdAt) },
        ...ticket.messages.map((m) => ({
          id: m.id,
          sender: m.author === 'CUSTOMER' ? ('user' as const) : ('bot' as const),
          senderName: 'Desi Tokri Support',
          text: m.body,
          timestamp: timeOf(m.createdAt),
        })),
      ]
    : messages;

  // Only the newest set of choices is live; older ones stay visible as history.
  const lastOptionsId = [...displayMessages].reverse().find((m) => m.options?.length)?.id;
  const sending = createTicket.isPending || replyTicket.isPending;
  const loadingOrder = Boolean(activeOrderNumber) && orderDetailsQuery.isLoading;
  const orderLink = activeOrderNumber ? `/orders/${activeOrderNumber}` : '/orders';

  return (
    <div className="osp">
      <div className="osp-wrap">
        {/* Desktop sidebar: the order this chat is about, plus help info */}
        <aside className="osp-side">
          {loadingOrder ? (
            <div className="osp-card">
              <Skeleton active paragraph={{ rows: 5 }} />
            </div>
          ) : activeOrder ? (
            <OrderSummaryCard order={activeOrder} onView={() => navigate(orderLink)} />
          ) : (
            <RecentOrdersCard
              orders={recentOrders}
              loading={ordersQuery.isLoading}
              onPick={(no) => navigate(`/orders/${no}/support`)}
            />
          )}

          <div className="osp-card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="osp-avatar" style={{ background: '#fef3c7', color: '#b45309' }}>
                <ClockCircleOutlined />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>We usually reply within 15 minutes</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                  Updates on your request are sent by SMS and WhatsApp.
                </div>
              </div>
            </div>
            <Link
              to="/support"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', color: '#15803d', fontWeight: 600, fontSize: 13.5 }}
            >
              <span>
                <MessageOutlined style={{ marginRight: 8 }} />
                View my support requests
              </span>
              <RightOutlined style={{ fontSize: 11 }} />
            </Link>
          </div>
        </aside>

        {/* Chat: full screen on phones, a card on tablet/desktop */}
        <section className="osp-chat" aria-label="Support chat">
          <header className="osp-head">
            <button type="button" className="osp-icon-btn" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeftOutlined style={{ fontSize: 17 }} />
            </button>
            <div className="osp-avatar" style={{ width: 38, height: 38, fontSize: 18 }}>
              <CustomerServiceOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Desi Tokri Support
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                {botTyping ? 'typing…' : ticket ? 'Support team · replies appear here' : 'Online · virtual assistant'}
              </div>
            </div>
            <button type="button" className="osp-end-btn" onClick={handleEndChat}>
              End chat
            </button>
          </header>

          {/* Compact order strip for phone/tablet, where the sidebar is hidden */}
          {activeOrder ? (
            <button type="button" className="osp-strip" onClick={() => navigate(orderLink)}>
              <div className="osp-avatar" style={{ borderRadius: 10, background: '#f1f5f9', color: '#475569' }}>
                <ShoppingOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>Order #{activeOrder.orderNumber}</div>
                <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeOrder.items.length} item{activeOrder.items.length === 1 ? '' : 's'} · {formatInr(activeOrder.totals.total)}
                </div>
              </div>
              <Tag color={statusColor(activeOrder.status)} style={{ margin: 0 }}>
                {statusLabel(activeOrder.status, activeOrder.fulfillment.method)}
              </Tag>
              <RightOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
            </button>
          ) : null}

          <div className="osp-stream" ref={streamRef}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, background: '#e2e8f0', padding: '3px 12px', borderRadius: 12 }}>
                Today
              </span>
            </div>

            {loadingOrder ? (
              <div style={{ maxWidth: 360 }}>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </div>
            ) : null}

            {ticket ? (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#166534', fontWeight: 500, background: '#dcfce7', padding: '3px 12px', borderRadius: 12 }}>
                  Ticket #{ticket.ticketNumber} · {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                </span>
              </div>
            ) : null}

            {displayMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              const optionsLive = msg.id === lastOptionsId && !botTyping;
              return (
                <div key={msg.id} className={`osp-row${isUser ? ' osp-row--user' : ''}`}>
                  {!isUser ? (
                    <div className="osp-avatar">
                      <CustomerServiceOutlined />
                    </div>
                  ) : null}
                  <div style={{ minWidth: 0, flex: isUser ? undefined : 1 }}>
                    {!isUser ? (
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: '0 0 4px 2px' }}>
                        {msg.senderName || 'DesiTokri Buddy'}
                      </div>
                    ) : null}
                    <div className={`osp-bubble osp-bubble--${isUser ? 'user' : 'bot'}`}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                      {msg.orderInfo ? (
                        <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 10, fontSize: 13, color: '#334155' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>Order contents: </span>
                          {msg.orderInfo.itemsText}
                        </div>
                      ) : null}
                      <div style={{ textAlign: 'right', fontSize: 11, color: isUser ? 'rgba(255,255,255,0.8)' : '#94a3b8', marginTop: 4 }}>
                        {msg.timestamp}
                      </div>
                    </div>

                    {msg.options && msg.options.length > 0 ? (
                      <div className="osp-options">
                        {msg.options.map((opt) => (
                          <button key={opt.id} type="button" className="osp-opt" onClick={opt.action} disabled={!optionsLive}>
                            <span>{renderOptionText(opt.text, opt.boldWords)}</span>
                            <RightOutlined style={{ fontSize: 11, flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {botTyping ? (
              <div className="osp-row">
                <div className="osp-avatar">
                  <CustomerServiceOutlined />
                </div>
                <div className="osp-bubble--bot osp-typing" aria-label="Support is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </div>

          <div className="osp-composer">
            <Input.TextArea
              placeholder="Type your message here…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPressEnter={(e) => {
                if (e.shiftKey) return;
                e.preventDefault();
                if (sending) return;
                handleSendCustomText();
              }}
              autoSize={{ minRows: 1, maxRows: 4 }}
              maxLength={2000}
              style={{ borderRadius: 20, padding: '8px 14px', borderColor: '#cbd5e1', resize: 'none' }}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSendCustomText}
              disabled={!inputText.trim()}
              loading={sending}
              aria-label="Send message"
              style={{
                background: inputText.trim() ? '#16a34a' : '#cbd5e1',
                borderColor: inputText.trim() ? '#16a34a' : '#cbd5e1',
                color: '#ffffff',
                flexShrink: 0,
                width: 40,
                height: 40,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderSummaryCard({ order, onView }: { order: OrderDetail; onView: () => void }) {
  const placed = new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="osp-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Getting help with</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' }}>#{order.orderNumber}</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Placed on {placed}</div>
        </div>
        <Tag color={statusColor(order.status)} style={{ margin: 0 }}>
          {statusLabel(order.status, order.fulfillment.method)}
        </Tag>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {order.items.map((item) => (
          <div key={item.productId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ShoppingOutlined />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name || 'Item'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Qty {item.quantity}</div>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{formatInr(item.total)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0', fontSize: 14 }}>
        <span style={{ color: '#475569' }}>Order total</span>
        <strong style={{ color: '#0f172a' }}>{formatInr(order.totals.total)}</strong>
      </div>

      <Button block onClick={onView} style={{ marginTop: 14, borderRadius: 10 }}>
        View order details
      </Button>
    </div>
  );
}

function RecentOrdersCard({ orders, loading, onPick }: { orders: OrderSummaryRow[]; loading: boolean; onPick: (orderNumber: string) => void }) {
  return (
    <div className="osp-card">
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Need help with an order?</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 10 }}>Pick one so we can look at it with you.</div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : orders.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8' }}>No recent orders.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {orders.slice(0, 5).map((o) => (
            <button
              key={o.orderNumber}
              type="button"
              className="osp-opt"
              style={{ padding: '10px 4px', color: '#0f172a' }}
              onClick={() => onPick(o.orderNumber)}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>#{o.orderNumber}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                  {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatInr(o.total)}
                </span>
              </span>
              <RightOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to bold specific keywords in option text
function renderOptionText(text: string, boldWords?: string[]) {
  if (!boldWords || boldWords.length === 0) return text;
  if (text.includes('issue') && text.includes('ordered item(s)')) {
    return (
      <span>
        I have an <strong>issue</strong> with the <strong>ordered item(s)</strong>
      </span>
    );
  }
  if (text.includes('another issue')) {
    return (
      <span>
        I have <strong>another issue</strong> with my order
      </span>
    );
  }
  if (text.includes('Instant Refund') || text.includes('Desi Tokri Wallet')) {
    return (
      <span>
        <strong>Instant Refund</strong> to <strong>Desi Tokri Wallet</strong>
      </span>
    );
  }
  return text;
}
