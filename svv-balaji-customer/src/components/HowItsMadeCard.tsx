import { ExportOutlined, PlayCircleFilled } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useState } from 'react';
import { isWebLink, linkSourceLabel, youtubeEmbedUrl, youtubeVideoId } from '@shared/utils/howItsMade';

/**
 * "How it's made" on the product page, for customers and retailers alike.
 * A YouTube video shows its thumbnail and loads the player only on tap (no
 * third-party player on every product view); any other link - Instagram, a
 * blog - opens in a new tab.
 */
export function HowItsMadeCard({ url, productName }: { url?: string | null; productName: string }) {
  const [playing, setPlaying] = useState(false);
  if (!url || !isWebLink(url)) return null;

  const videoId = youtubeVideoId(url);
  const embed = youtubeEmbedUrl(url);
  const source = linkSourceLabel(url);

  return (
    <div className="pdp-section-card" style={{ background: '#fff', padding: '16px', marginTop: 8 }}>
      <Typography.Text strong style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
        How it's made
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
        See how {productName} goes from the farm to your pack.
      </Typography.Text>

      {videoId && embed ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
          {playing ? (
            <iframe
              src={`${embed}&autoplay=1`}
              title={`How ${productName} is made`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play: how ${productName} is made`}
              style={{ position: 'absolute', inset: 0, padding: 0, border: 0, cursor: 'pointer', background: '#000' }}
            >
              <img
                src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
              />
              <PlayCircleFilled
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 56, color: '#fff' }}
              />
            </button>
          )}
        </div>
      ) : (
        <Button
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          icon={<ExportOutlined />}
          style={{ borderRadius: 8, borderColor: '#fed7aa', color: '#ea580c', background: '#fff7ed', fontWeight: 600 }}
        >
          Watch on {source}
        </Button>
      )}
    </div>
  );
}
