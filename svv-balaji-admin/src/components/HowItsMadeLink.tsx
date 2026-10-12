import { LinkOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import { isWebLink, linkSourceLabel, youtubeEmbedUrl } from '@shared/utils/howItsMade';

/**
 * Staff-side view of a "how this is made" link: a small player for YouTube,
 * otherwise the link itself - roughly what customers and retailers will see.
 */
export function HowItsMadeLink({ url, compact = false }: { url?: string | null; compact?: boolean }) {
  if (!url || !isWebLink(url)) return null;
  const embed = youtubeEmbedUrl(url);
  const link = (
    <Typography.Link href={url} target="_blank" rel="noopener noreferrer">
      <Space size={4}>
        {embed ? <PlayCircleOutlined /> : <LinkOutlined />}
        {`Open on ${linkSourceLabel(url)}`}
      </Space>
    </Typography.Link>
  );
  if (!embed || compact) return link;
  return (
    <Space direction="vertical" size={4}>
      <iframe
        src={embed}
        title="How it's made"
        width={320}
        height={180}
        style={{ border: 0, borderRadius: 8, maxWidth: '100%' }}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {link}
    </Space>
  );
}
