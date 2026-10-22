import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorCode, errorMessage } from '../api/client';
import { riderApi, type ItemPreview, type Offer, type TaskSummary } from '../api/rider';
import { riderEvents } from '../live/alerts';
import { Box, Clock, Pin, Send } from './icons';
import { ScooterArt } from './illustrations';
import { Modal, date, inr, time, useToast } from './kit';

/** Order and task pieces shared by the Dashboard, Orders and task screens (follows the supplied order-card design). */

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Go to store', AT_PICKUP: 'At store', PICKED_UP: 'Picked up', OUT_FOR_DELIVERY: 'On the way', AT_DROP: 'At customer',
  FAILED: 'Return to store', DELIVERED: 'Delivered', RETURNED_TO_STORE: 'Returned', CANCELLED: 'Cancelled',
};

/** "Toor Dal 1kg" or "Toor Dal 1kg + 2 more". */
export function itemsTitle(items: ItemPreview[], count: number) {
  if (!items.length) return `${count || 'Order'} item${count === 1 ? '' : 's'}`;
  const more = items.length > 1 ? items.length - 1 : 0;
  return `${items[0].name}${more ? ` + ${more} more` : ''}`;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/images/') || url.startsWith('/icons/') || url.startsWith('/favicon')) {
    return url;
  }
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') || 'http://localhost:3000';
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${cleanPath}`;
}

export function ItemThumb({ items, size = 76 }: { items: ItemPreview[]; size?: number }) {
  const [error, setError] = useState(false);
  const rawImg = items.find((i) => i.image)?.image;
  const imgUrl = resolveImageUrl(rawImg);

  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {imgUrl && !error ? (
        <img
          src={imgUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setError(true)}
        />
      ) : (
        <Box size={Math.round(size * 0.45)} />
      )}
    </div>
  );
}

function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [until]);
  return <span className={`chip ${left <= 10 ? 'red' : 'orange'}`}><Clock size={13} /> {left}s</span>;
}

/**
 * Accept / reject an offer, with the follow-up (refresh lists; an accept raises
 * the "assigned to you" pop-up, which opens the task). Requests go to several
 * riders at once, so "someone else was faster" is a normal outcome, not an error.
 */
export function useOfferResponse(onDone?: () => void, onAccepted?: (taskId: string) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    // A double tap queues behind the first call instead of racing it; the server answers a repeat accept idempotently.
    scope: { id: 'offer-response' },
    mutationFn: ({ offer, accept, reason }: { offer: Offer; accept: boolean; reason?: string }) =>
      accept ? riderApi.accept(offer.offerId) : riderApi.reject(offer.offerId, reason),
    onSuccess: (r, v) => {
      onDone?.();
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['offers'] });
      const res = r as { status?: string; taskId?: string } | undefined;
      if (v.accept && res?.status === 'ACCEPTED' && res.taskId) {
        if (onAccepted) {
          onAccepted(res.taskId);
        } else {
          riderEvents.assigned({ taskId: res.taskId, by: 'ACCEPT' });
        }
      } else if (v.accept) {
        toast('Time ran out on this request - it has gone to another rider', 'info');
      } else toast('Order rejected - it goes to another rider', 'info');
    },
    onError: (e) => {
      onDone?.();
      const code = errorCode(e);
      toast(errorMessage(e), code === 'OFFER_TAKEN' || code === 'OFFER_CLOSED' || code === 'OFFER_EXPIRED' ? 'info' : 'error');
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

/** New order card: product, drop area, order no. + time, Accept / Reject. */
export function OfferCard({ offer, onOpen, onAccept, onReject, busy }: { offer: Offer; onOpen: () => void; onAccept: () => void; onReject: () => void; busy: boolean }) {
  return (
    <div className="card order" onClick={onOpen} role="button">
      <ItemThumb items={offer.items} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="between">
          <p className="title ellipsis" style={{ margin: 0 }}>{itemsTitle(offer.items, offer.itemCount)}</p>
          <Countdown until={offer.expiresAt} />
        </div>
        {offer.kind === 'RETURN_PICKUP' ? <div style={{ marginTop: 4 }}><span className="chip orange">↩ Return pickup</span></div> : null}
        <div className="meta"><Pin size={15} /> <span className="ellipsis">{offer.kind === 'RETURN_PICKUP' ? `Collect from ${offer.dropArea}` : offer.dropArea}</span></div>
        <div className="meta"><Clock size={15} /> <span className="ellipsis">{date(offer.offeredAt)}{offer.cod > 0 ? ` · COD ${inr(offer.cod)}` : ''}</span></div>
        {offer.estimatedEarning ? <div className="meta" style={{ color: 'var(--green)', fontWeight: 600 }}>You earn {inr(offer.estimatedEarning)}</div> : null}
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn success small" onClick={onAccept} disabled={busy}>{busy ? 'Accepting…' : 'Accept'}</button>
          <button className="btn danger small" onClick={onReject} disabled={busy}>Reject</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Active / delivered / returned order card. The pin button opens the live
 * track screen for an order still in hand.
 */
export function TaskCard({ t }: { t: TaskSummary }) {
  const navigate = useNavigate();
  const live = !['DELIVERED', 'RETURNED_TO_STORE', 'CANCELLED'].includes(t.status);
  const when = t.deliveredAt ?? (live ? t.promisedBy ?? t.assignedAt : t.updatedAt) ?? t.updatedAt;
  const chip = t.status === 'DELIVERED' ? 'lav' : t.status === 'FAILED' || t.status === 'CANCELLED' ? 'red' : t.status === 'RETURNED_TO_STORE' ? 'grey' : 'green';
  const label = live ? (t.status === 'FAILED' ? 'Return to store' : 'Active Order') : STATUS_LABEL[t.status] ?? t.status;
  return (
    <Link to={`/task/${t.id}`} className="card order" style={{ display: 'flex' }}>
      <ItemThumb items={t.items} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="title ellipsis">{itemsTitle(t.items, t.itemCount)}</p>
        <div className="meta"><Pin size={15} /> <span className="ellipsis">{t.dropAddress}</span></div>
        <div className="meta"><Clock size={15} /> <span className="ellipsis">{date(when)} at {time(when)}</span></div>
        <div className="between" style={{ marginTop: 8 }}>
          <span className={`chip ${chip}`}>{label}</span>
          {live ? (
            <button className="pin-btn" aria-label="Track this order" onClick={(e) => { e.preventDefault(); navigate(`/task/${t.id}/track`); }}>
              <Pin size={16} />
            </button>
          ) : t.earned ? <b style={{ fontSize: 13, color: 'var(--green)' }}>+{inr(t.earned)}</b> : null}
        </div>
      </div>
    </Link>
  );
}

/** The compact "order details" pop-up for a delivery request that has not been accepted yet. */
export function OfferModal({ offer, onClose, onAccept, onReject, busy, heading }: { offer: Offer | null; onClose: () => void; onAccept: () => void; onReject: () => void; busy: boolean; heading?: string }) {
  if (!offer) return null;
  const isReturn = offer.kind === 'RETURN_PICKUP';
  return (
    <Modal open onClose={onClose}>
      <div className="offer-pop">
        <div className="between" style={{ marginBottom: 8 }}>
          <b style={{ fontSize: 15, color: 'var(--orange-dark)' }}>{isReturn ? '↩ Return pickup' : heading ?? 'New delivery request'}</b>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Countdown until={offer.expiresAt} />
            <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ width: 26, height: 26, fontSize: 17 }}>×</button>
          </div>
        </div>

        {/* Earning, payment and items in one row */}
        <div className="between" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '8px 12px', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#047857', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>You earn</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#065f46', lineHeight: 1.1 }}>{offer.estimatedEarning ? inr(offer.estimatedEarning) : '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`chip ${offer.cod > 0 ? 'orange' : 'grey'}`} style={{ fontWeight: 600, fontSize: 11.5 }}>
              {isReturn ? 'Return' : offer.cod > 0 ? `COD ${inr(offer.cod)}` : 'Prepaid'}
            </span>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              {offer.itemCount} item{offer.itemCount === 1 ? '' : 's'}{offer.distanceKm !== null ? ` · ${offer.distanceKm.toFixed(1)} km` : ''}
            </div>
          </div>
        </div>

        {/* Order + route */}
        <div className="block" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <ItemThumb items={offer.items} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{itemsTitle(offer.items, offer.itemCount)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>#{offer.returnRequest?.requestNumber ?? offer.orderNumber ?? offer.taskNumber}</div>
            </div>
          </div>
          <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--ink)' }}>
            <span style={{ color: 'var(--orange)', verticalAlign: 'middle' }}><Box size={14} /></span> {offer.pickup.name}
          </div>
          <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--ink)' }}>
            <span style={{ color: 'var(--green, #16a34a)', verticalAlign: 'middle' }}><Pin size={14} /></span> {isReturn ? `Collect from ${offer.dropArea}` : offer.dropArea}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginTop: 10 }}>
          <button className="btn danger medium" onClick={onReject} disabled={busy} style={{ fontWeight: 600, fontSize: 15 }}>Reject</button>
          <button className="btn success medium" onClick={onAccept} disabled={busy} style={{ fontWeight: 600, fontSize: 15 }}>
            {busy ? 'Accepting…' : isReturn ? 'Accept pickup' : 'Accept'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** "Write a specific reason to reject order" pop-up. The reason goes to the store with the rejection. */
export function RejectModal({ offer, onClose, onSubmit, busy }: { offer: Offer | null; onClose: () => void; onSubmit: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [offer?.offerId]);
  if (!offer) return null;
  const ok = reason.trim().length >= 3;
  return (
    <Modal open onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '10px 4px 4px' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>Write a Specific Reason to</h3>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--red)' }}>Reject Order</div>
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 10px' }}>Tap a reason to reject, or type your own</p>
        <form className="reason-input" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(reason.trim()); }}>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Type something here" maxLength={300} aria-label="Reason" />
          <button type="submit" className="icon-btn" disabled={!ok || busy} aria-label="Reject with this reason"><Send size={20} /></button>
        </form>
        <div className="reason-chips">
          {['Too far', 'Vehicle problem', 'Already on a delivery', 'Ending my shift'].map((r) => (
            <button key={r} type="button" className="chip grey" disabled={busy} onClick={() => onSubmit(r)}>{r}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
