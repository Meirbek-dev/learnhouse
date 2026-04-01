import Image, { type ImageLoaderProps, type ImageProps } from 'next/image';

const directLoader = ({ src }: ImageLoaderProps) => src;

export default function NextImage({ src, alt, ...props }: ImageProps) {
  return (
    <Image
      src={src}
      alt={alt ?? ''}
      loader={directLoader}
      unoptimized
      {...props}
    />
  );
}
