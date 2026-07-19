'use client';

import styles from './TikTokEmbed.module.css';

interface Props {
  videoId: string;
}

export default function TikTokEmbed({ videoId }: Props) {
  return (
    <div className={styles.embedWrap}>
      <iframe
        src={`https://www.tiktok.com/embed/v3/${videoId}`}
        className={styles.iframe}
        allow="encrypted-media;"
        allowFullScreen
        title="TikTok Video"
      />
    </div>
  );
}
