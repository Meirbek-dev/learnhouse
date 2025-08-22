import {
  Bike,
  Book,
  Briefcase,
  Building,
  Camera,
  Coffee,
  Coins,
  Cpu,
  Dumbbell,
  Flower,
  Gamepad,
  GraduationCap,
  Heart,
  Loader2,
  Microscope,
  Music,
  Palette,
  Plane,
  Search,
  Shirt,
  Utensils,
} from 'lucide-react';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useCallback, useEffect, useState } from 'react';
import { ScrollArea } from '@components/ui/scroll-area';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { ChangeEvent, FC } from 'react';
import { useTranslations } from 'next-intl';
import { createApi } from 'unsplash-js';

const unsplash = createApi({
  accessKey: process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY as string,
});

const IMAGES_PER_PAGE = 20;

const LABEL_KEYS_WITH_ICONS = [
  { key: 'nature', icon: Flower },
  { key: 'technology', icon: Cpu },
  { key: 'business', icon: Briefcase },
  { key: 'education', icon: GraduationCap },
  { key: 'health', icon: Heart },
  { key: 'art', icon: Palette },
  { key: 'science', icon: Microscope },
  { key: 'travel', icon: Plane },
  { key: 'food', icon: Utensils },
  { key: 'sports', icon: Dumbbell },
  { key: 'music', icon: Music },
  { key: 'fashion', icon: Shirt },
  { key: 'history', icon: Book },
  { key: 'architecture', icon: Building },
  { key: 'fitness', icon: Bike },
  { key: 'photography', icon: Camera },
  { key: 'biology', icon: Microscope },
  { key: 'finance', icon: Coins },
  { key: 'lifestyle', icon: Coffee },
  { key: 'gaming', icon: Gamepad },
] as const;

interface UnsplashImagePickerProps {
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
  isOpen?: boolean;
}

const UnsplashImagePicker: FC<UnsplashImagePickerProps> = ({ onSelect, onClose, isOpen = true }) => {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('CourseEdit.General.UnsplashPicker');

  // Generate predefined labels with translations
  const predefinedLabels = LABEL_KEYS_WITH_ICONS.map(({ key, icon }) => ({
    name: t(`Labels.${key}`),
    icon,
    key,
  }));

  const fetchImages = useCallback(async (searchQuery: string, pageNum: number) => {
    setLoading(true);
    try {
      const result = await unsplash.search.getPhotos({
        query: searchQuery,
        page: pageNum,
        perPage: IMAGES_PER_PAGE,
      });
      if (result?.response) {
        setImages((prevImages) =>
          pageNum === 1 ? result.response.results : [...prevImages, ...result.response.results],
        );
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetchImages = useCallback(
    (searchQuery: string) => {
      setPage(1);
      fetchImages(searchQuery, 1);
    },
    [fetchImages],
  );

  useEffect(() => {
    if (query) {
      debouncedFetchImages(query);
    } else if (images.length > 0 || page > 1) {
      setImages([]);
      setPage(1);
    }
  }, [query, debouncedFetchImages, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen && images.length === 0 && !query && !loading) {
      fetchImages('course', 1);
    }
  }, [isOpen, images.length, query, loading, fetchImages]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleLabelClick = (labelKey: string) => {
    setQuery(labelKey);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchImages(query, nextPage);
  };

  const handleImageSelect = (imageUrl: string) => {
    onSelect(imageUrl);
    onClose();
  };

  const modalContent = (
    <div className="flex h-full flex-col">
      <div className="space-y-4 p-4">
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border p-2 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <Search
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            size={20}
          />
        </div>
        {!query && (
          <ScrollArea className="max-h-[150px] pr-2">
            <div className="flex flex-wrap gap-2">
              {predefinedLabels.map((label) => (
                <button
                  key={label.key}
                  onClick={() => {
                    handleLabelClick(label.key);
                  }}
                  className="soft-shadow flex items-center gap-1 space-x-1 rounded-lg bg-neutral-100 px-3 py-1 transition-colors hover:bg-neutral-200"
                >
                  <label.icon size={16} />
                  <span>{label.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="grid grid-cols-3 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative w-full pb-[56.25%]"
            >
              <img
                src={image.urls.small}
                alt={image.alt_description || 'Unsplash image'}
                className="absolute inset-0 h-full w-full cursor-pointer rounded-lg object-cover transition-opacity hover:opacity-80"
                onClick={() => {
                  handleImageSelect(image.urls.regular);
                }}
              />
            </div>
          ))}
        </div>
        {loading ? (
          <div className="mt-4 flex justify-center">
            <div className="flex animate-pulse items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-gray-600">
              <Loader2
                size={16}
                className="mr-2 animate-spin"
              />
              <span>{t('loading')}</span>
            </div>
          </div>
        ) : null}
        {!loading && images.length > 0 && (
          <Button
            onClick={handleLoadMore}
            className="mt-4 w-full px-4 py-2"
          >
            {t('loadMoreButton')}
          </Button>
        )}
        {!loading && images.length === 0 && query ? <p className="mt-4 text-center">{t('noResults')}</p> : null}
      </div>
    </div>
  );

  return (
    <Modal
      dialogTitle={t('modalTitle')}
      dialogContent={modalContent}
      onOpenChange={onClose}
      isDialogOpen={isOpen}
      minWidth="lg"
      minHeight="lg"
      customHeight="h-[80vh]"
    />
  );
};

export default UnsplashImagePicker;
