import Image from 'next/image';
import styles from './product.module.css';

interface Props {
  src?: string;
  label: string;
  aspect?: string;
  priority?: boolean;
}

export default function ProductImageSlot({ src, label, aspect = '4/3', priority = false }: Props) {
  if (src) {
    return (
      <div
        className={`${styles.imageSlot} ${styles.imageSlotFilled}`}
        style={{ aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={label}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className={styles.imageSlotImg}
          priority={priority}
        />
      </div>
    );
  }
  return (
    <div className={styles.imageSlot} style={{ aspectRatio: aspect }}>
      <span className={styles.imageSlotIcon} aria-hidden="true">📷</span>
      <span className={styles.imageSlotLabel}>{label}</span>
    </div>
  );
}
