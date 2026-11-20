import React, { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#594943] via-[#433631] to-[#433631] text-[#FAF6F1] p-4 ${className}`}
      >
        <span className="font-editorial text-2xl tracking-wider opacity-90">EP</span>
        <span className="mt-1 text-[11px] text-[#FAF6F1]/70 text-center line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
