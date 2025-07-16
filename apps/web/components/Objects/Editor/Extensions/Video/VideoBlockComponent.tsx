'use client';

import { AlertCircle, ArrowLeftRight, CheckCircle2, Download, Expand, Loader2, Upload, Video, X } from 'lucide-react';
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext';
import ArtPlayer from '@components/Objects/Activities/Video/Artplayer';
import { getActivityBlockMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { uploadNewVideoFile } from '@services/blocks/Video/video';
import { useCourse } from '@components/Contexts/CourseContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { AnimatePresence, motion } from 'framer-motion';
import { constructAcceptValue } from '@/lib/constants';
import { useLocale, useTranslations } from 'next-intl';
import type { ChangeEvent, DragEvent } from 'react';
import { styled } from 'styled-components';
import type ArtplayerType from 'artplayer';
import type { Node } from '@tiptap/core';
import { cn } from '@/lib/utils';

const SUPPORTED_FILES = constructAcceptValue(['webm', 'mkv', 'mp4']);

const VIDEO_SIZES = {
  small: { width: 480, label: 'sizeSmall' },
  medium: { width: 720, label: 'sizeMedium' },
  large: { width: 960, label: 'sizeLarge' },
  full: { width: '100%', label: 'sizeFull' },
} as const;

type VideoSize = keyof typeof VIDEO_SIZES;

const VideoWrapper = styled.div`
  transition: all 0.2s ease;
  background-color: #f9f9f9;
  border: 1px solid #eaeaea;
`;

const VideoContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const UploadZone = styled(motion.div)<{ isDragging: boolean }>`
  border: 2px dashed ${(props) => (props.isDragging ? '#3b82f6' : '#e5e7eb')};
  background: ${(props) => (props.isDragging ? 'rgba(59, 130, 246, 0.05)' : '#ffffff')};
  transition: all 0.2s ease;
  border-radius: 0.75rem;
  padding: 2rem;
  text-align: center;
  cursor: pointer;

  &:hover {
    background: rgba(59, 130, 246, 0.05);
    border-color: #3b82f6;
  }
`;

const SizeButton = styled(motion.button)<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: ${(props) => (props.isActive ? '#ffffff' : '#4b5563')};
  background: ${(props) => (props.isActive ? '#3b82f6' : 'transparent')};
  border: 1px solid ${(props) => (props.isActive ? '#3b82f6' : '#e5e7eb')};
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.isActive ? '#2563eb' : '#f9fafb')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

interface Organization {
  org_uuid: string;
}

interface Course {
  courseStructure: {
    course_uuid: string;
  };
}

interface EditorState {
  isEditable: boolean;
}

interface Session {
  data?: {
    tokens?: {
      access_token?: string;
    };
  };
}

interface VideoBlockObject {
  block_uuid: string;
  content: {
    file_id: string;
    file_format: string;
  };
  size: VideoSize;
}

type ExtendedNodeViewProps = {
  extension: Node & {
    options: {
      activity: {
        activity_uuid: string;
      };
    };
  };
} & Omit<NodeViewProps, 'extension'>;

function VideoBlockComponent(props: ExtendedNodeViewProps) {
  const t = useTranslations('DashPage.Editor.VideoBlock');
  const fullLocale = useLocale();
  const locale = fullLocale.split('-')[0];
  const { node, extension, updateAttributes } = props;
  const org = useOrg() as Organization | null;
  const course = useCourse() as Course | null;

  const subtitleEntries = [
    { html: 'Русский', url: '/subtitle.ru.srt' },
    { html: 'English', url: '/subtitle.en.srt' },
    { html: 'Қазақша', url: '/subtitle.kz.srt' },
  ];
  const editorState = useEditorProvider() as EditorState;
  const session = useLHSession() as Session;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  const initialBlockObject = useMemo(() => {
    if (!node.attrs.blockObject) return null;
    if ('size' in node.attrs.blockObject && typeof node.attrs.blockObject.size === 'string') {
      return node.attrs.blockObject as VideoBlockObject;
    }
    return;
  }, [node.attrs.blockObject]);

  const [_video, setVideo] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [blockObject, setBlockObject] = useState<VideoBlockObject | null>(initialBlockObject || null);
  const [selectedSize, setSelectedSize] = useState<VideoSize>(initialBlockObject?.size || 'medium');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Update block object when size changes
  useEffect(() => {
    if (blockObject && blockObject.size !== selectedSize) {
      const newBlockObject = {
        ...blockObject,
        size: selectedSize,
      };
      setBlockObject(newBlockObject);
      updateAttributes({ blockObject: newBlockObject });
    }
  }, [selectedSize, blockObject, updateAttributes]);

  const isEditable = editorState?.isEditable;
  const access_token = session?.data?.tokens?.access_token;
  const fileId = blockObject ? `${blockObject.content.file_id}.${blockObject.content.file_format}` : null;

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideo(file);
      setError(null);
      handleUpload(file);
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === uploadZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    const fileExtension = file?.name.split('.').pop()?.toLowerCase();

    if (file && fileExtension && ['mkv', 'mp4', 'webm'].includes(fileExtension)) {
      setVideo(file);
      setError(null);
      handleUpload(file);
    } else {
      setError(t('errorFormat'));
    }
  };

  const handleUpload = async (file: File) => {
    if (!access_token) return;

    try {
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const object = await uploadNewVideoFile(file, extension.options.activity.activity_uuid, access_token);

      clearInterval(progressInterval);
      setUploadProgress(100);

      const newBlockObject = {
        ...object,
        size: selectedSize,
      };
      setBlockObject(newBlockObject);
      updateAttributes({ blockObject: newBlockObject });
      setVideo(null);

      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch {
      setError(t('errorUpload'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    setBlockObject(null);
    updateAttributes({ blockObject: null });
    setVideo(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleSizeChange = (size: VideoSize) => {
    setSelectedSize(size);
  };

  const videoUrl =
    blockObject && org?.org_uuid && course?.courseStructure.course_uuid
      ? getActivityBlockMediaDirectory(
          org.org_uuid,
          course.courseStructure.course_uuid,
          extension.options.activity.activity_uuid,
          blockObject.block_uuid,
          fileId || '',
          'videoBlock',
        )
      : null;

  const handleDownload = () => {
    if (!videoUrl) return;

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `video-${blockObject?.block_uuid || 'download'}.${blockObject?.content.file_format || 'mp4'}`;
    link.setAttribute('download', '');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExpand = () => {
    setIsModalOpen(true);
  };

  // If we're in preview mode and have a video, show only the video player
  if (!isEditable && blockObject && videoUrl) {
    const { width } = VIDEO_SIZES[blockObject.size];
    return (
      <>
        <NodeViewWrapper className="block-video w-full">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative flex w-full justify-center"
          >
            <div
              style={{
                maxWidth: typeof width === 'number' ? width : '100%',
                width: '100%',
              }}
            >
              <div className="relative">
                <ArtPlayer
                  option={{
                    url: videoUrl,
                    muted: false,
                    autoplay: false,
                    lang: locale,
                    pip: true,
                  }}
                  subtitle={{
                    url: `/subtitle.${locale}.srt`,
                    type: 'srt',
                    style: {
                      color: '#ffffff',
                      fontSize: '2rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      textAlign: 'center',
                    },
                    encoding: 'utf8',
                  }}
                  locale={locale}
                  subtitleEntries={subtitleEntries}
                  className="aspect-video w-full rounded-lg shadow-sm"
                  onPlayerReady={(art: ArtplayerType) => {}}
                />
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    onClick={handleExpand}
                    className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                    title="Expand video"
                  >
                    <Expand className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                    title="Download video"
                  >
                    <Download className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </NodeViewWrapper>

        <Modal
          isDialogOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          dialogTitle="Video Player"
          minWidth="lg"
          minHeight="lg"
          dialogContent={
            <div className="w-full">
              <video
                controls
                autoPlay
                className="aspect-video w-full rounded-lg bg-black object-contain shadow-lg"
                src={videoUrl}
              />
            </div>
          }
        />
      </>
    );
  }

  // If we're in preview mode but don't have a video, show nothing
  if (!(isEditable || (blockObject && videoUrl))) {
    return null;
  }

  // Show the full editor UI when in edit mode
  return (
    <NodeViewWrapper className="block-video w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <VideoWrapper className="flex flex-col space-y-4 rounded-lg px-5 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-zinc-500">
              <Video size={16} />
              <span className="font-medium">{t('title')}</span>
            </div>
            {blockObject && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRemove}
                className="text-zinc-400 transition-colors hover:text-red-500"
                title={t('remove')}
              >
                <X size={16} />
              </motion.button>
            )}
          </div>

          {!(blockObject && videoUrl) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleVideoChange}
                accept={SUPPORTED_FILES}
                className="hidden"
                aria-label={t('ariaLabel')}
                title={t('selectVideoFile')}
              />

              <UploadZone
                ref={uploadZoneRef}
                isDragging={isDragging}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative"
              >
                <AnimatePresence>
                  {isLoading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
                      <div className="text-sm text-zinc-600">{t('uploading', { progress: uploadProgress })}</div>
                      <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-gray-200">
                        <motion.div
                          className="h-full rounded-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <Upload className="mx-auto h-8 w-8 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium text-zinc-700">{t('uploadPlaceholder')}</div>
                        <div className="mt-1 text-xs text-zinc-500">{t('uploadHint')}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </UploadZone>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-500">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {blockObject && videoUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-sm font-medium text-zinc-500">
                  <ArrowLeftRight size={14} />
                  {t('sizeLabel')}
                </div>
                {(Object.keys(VIDEO_SIZES) as VideoSize[]).map((size) => (
                  <SizeButton
                    key={size}
                    isActive={selectedSize === size}
                    onClick={() => handleSizeChange(size)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {size === selectedSize && <CheckCircle2 size={14} />}
                    {t(VIDEO_SIZES[size].label)}
                  </SizeButton>
                ))}
                <SizeButton
                  isActive={false}
                  onClick={handleDownload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="ml-auto"
                >
                  <Download size={14} />
                  {t('download')}
                </SizeButton>
              </div>

              <VideoContainer>
                <div
                  style={{
                    maxWidth:
                      typeof VIDEO_SIZES[selectedSize].width === 'number' ? VIDEO_SIZES[selectedSize].width : '100%',
                    width: '100%',
                  }}
                >
                  <div className="relative overflow-hidden rounded-lg bg-black/5">
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                    <ArtPlayer
                      option={{
                        url: videoUrl,
                        muted: false,
                        autoplay: false,
                        lang: locale,
                        pip: true,
                      }}
                      subtitle={{
                        url: `/subtitle.${locale}.srt`,
                        type: 'srt',
                        style: {
                          color: '#ffffff',
                          fontSize: '2rem',
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          textAlign: 'center',
                        },
                        encoding: 'utf8',
                      }}
                      locale={locale}
                      subtitleEntries={subtitleEntries}
                      className={cn(
                        'aspect-video w-full bg-black/95 shadow-sm transition-all duration-200',
                        isLoading && 'opacity-50 blur-sm',
                      )}
                      onPlayerReady={(art: ArtplayerType) => {}}
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        onClick={handleExpand}
                        className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                        title="Expand video"
                      >
                        <Expand className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={handleDownload}
                        className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                        title="Download video"
                      >
                        <Download className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </VideoContainer>
            </motion.div>
          )}
        </VideoWrapper>

        {blockObject && videoUrl && (
          <Modal
            isDialogOpen={isModalOpen}
            onOpenChange={setIsModalOpen}
            dialogTitle="Video Player"
            minWidth="lg"
            minHeight="lg"
            dialogContent={
              <div className="w-full">
                <video
                  controls
                  autoPlay
                  className="aspect-video w-full rounded-lg bg-black object-contain shadow-lg"
                  src={videoUrl}
                />
              </div>
            }
          />
        )}
      </motion.div>
    </NodeViewWrapper>
  );
}

export default VideoBlockComponent;
