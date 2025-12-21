import { AlertTriangle, AlignCenter, AlignLeft, AlignRight, Download, Expand, Image } from 'lucide-react';
import { FileUploadBlock, FileUploadBlockButton, FileUploadBlockInput } from '../../FileUploadBlock';
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getActivityBlockMediaDirectory } from '@services/media/media';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { uploadNewImageFile } from '@services/blocks/Image/images';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { constructAcceptValue } from '@/lib/constants';
// Lazy-load re-resizable to avoid adding it to the initial bundle
import { Suspense, lazy, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { useTranslations } from 'next-intl';
const LazyResizable = lazy(() => import('re-resizable').then((mod) => ({ default: mod.Resizable })));

const SUPPORTED_FILES = constructAcceptValue(['jpg', 'png', 'webp', 'gif']);

const ImageBlockComponent = (props: any) => {
  const t = useTranslations('DashPage.Editor.ImageBlock');
  const org = useOrg() as any;
  const course = useCourse();
  const editorState = useEditorProvider();
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const { isEditable } = editorState;
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [blockObject, setblockObject] = useState(props.node.attrs.blockObject);
  const [imageSize, setImageSize] = useState({
    width: props.node.attrs.size > 0 ? props.node.attrs.size.width : 300,
  });
  const [alignment, setAlignment] = useState(props.node.attrs.alignment || 'center');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fileId = blockObject ? `${blockObject.content.file_id}.${blockObject.content.file_format}` : null;

  const handleImageChange = (event: React.ChangeEvent<any>) => {
    setImage(event.target.files[0]);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!image) return;
    setIsLoading(true);
    const object = await uploadNewImageFile(image, props.extension.options.activity.activity_uuid, access_token);
    setIsLoading(false);
    setblockObject(object);
    props.updateAttributes({
      blockObject: object,
      size: imageSize,
      alignment,
    });
  };

  const handleDownload = () => {
    if (!fileId) return;

    const imageUrl = getActivityBlockMediaDirectory(
      org?.org_uuid,
      course?.courseStructure.course_uuid,
      props.extension.options.activity.activity_uuid,
      blockObject.block_uuid,
      fileId,
      'imageBlock',
    );

    const link = document.createElement('a');
    link.href = imageUrl || '';
    link.download = `image-${blockObject?.block_uuid || 'download'}.${blockObject?.content.file_format || 'jpg'}`;
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

  const handleAlignmentChange = (newAlignment: string) => {
    setAlignment(newAlignment);
    props.updateAttributes({
      alignment: newAlignment,
    });
  };

  const imageUrl = blockObject
    ? getActivityBlockMediaDirectory(
        org?.org_uuid,
        course?.courseStructure.course_uuid,
        props.extension.options.activity.activity_uuid,
        blockObject.block_uuid,
        fileId || '',
        'imageBlock',
      )
    : null;

  const getAlignmentClass = () => {
    switch (alignment) {
      case 'left': {
        return 'justify-start';
      }
      case 'right': {
        return 'justify-end';
      }
      default: {
        return 'justify-center';
      }
    }
  };

  return (
    <>
      <NodeViewWrapper className="block-image w-full">
        <FileUploadBlock
          isEditable={isEditable}
          isLoading={isLoading}
          isEmpty={!blockObject}
          Icon={Image}
        >
          <FileUploadBlockInput
            onChange={handleImageChange}
            accept={SUPPORTED_FILES}
          />
          <FileUploadBlockButton
            onClick={handleSubmit}
            disabled={!image}
          />
        </FileUploadBlock>

        {blockObject && isEditable ? (
          <div className={`flex w-full ${getAlignmentClass()}`}>
            <Suspense fallback={<div className="h-8" />}>
              <LazyResizable
                defaultSize={{ width: imageSize.width, height: '100%' }}
                handleStyles={{
                  right: {
                    position: 'unset',
                    width: 7,
                    height: 30,
                    borderRadius: 20,
                    cursor: 'col-resize',
                    backgroundColor: 'black',
                    opacity: '0.3',
                    margin: 'auto',
                    marginLeft: 5,
                  },
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  maxWidth: '100%',
                }}
                maxWidth="100%"
                minWidth={200}
                enable={{ right: true }}
                onResizeStop={(_e, _direction, ref, d) => {
                  const newWidth = Math.min(imageSize.width + d.width, ref.parentElement?.clientWidth || 1000);
                  props.updateAttributes({
                    size: {
                      width: newWidth,
                    },
                  });
                  setImageSize({
                    width: newWidth,
                  });
                }}
              >
                <div className="relative">
                  <img
                    src={imageUrl || ''}
                    alt=""
                    className="h-auto w-full max-w-full rounded-lg shadow-sm"
                  />
                  <div className="bg-opacity-90 absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white p-1 opacity-70 shadow-xs backdrop-blur-xs transition-opacity hover:opacity-100">
                    <button
                      onClick={() => {
                        handleAlignmentChange('left');
                      }}
                      className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'left' ? 'bg-gray-100' : ''}`}
                      title={t('alignLeft')}
                    >
                      <AlignLeft size={16} />
                    </button>
                    <button
                      onClick={() => {
                        handleAlignmentChange('center');
                      }}
                      className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'center' ? 'bg-gray-100' : ''}`}
                      title={t('alignCenter')}
                    >
                      <AlignCenter size={16} />
                    </button>
                    <button
                      onClick={() => {
                        handleAlignmentChange('right');
                      }}
                      className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'right' ? 'bg-gray-100' : ''}`}
                      title={t('alignRight')}
                    >
                      <AlignRight size={16} />
                    </button>
                    <div className="h-4 w-px bg-gray-300" />
                    <button
                      onClick={handleExpand}
                      className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
                      title={t('expand')}
                    >
                      <Expand size={16} />
                    </button>
                  </div>
                </div>
              </LazyResizable>
            </Suspense>
          </div>
        ) : null}

        {blockObject && !isEditable ? (
          <div className={`flex w-full ${getAlignmentClass()}`}>
            <div className="relative">
              <img
                src={imageUrl || ''}
                alt=""
                className="h-auto max-w-full rounded-lg shadow-sm"
                style={{ width: imageSize.width }}
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={handleExpand}
                  className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                  title={t('expand')}
                >
                  <Expand className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={handleDownload}
                  className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                  title={t('download')}
                >
                  <Download className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div>
            <AlertTriangle
              color="#e1e0e0"
              size={50}
            />
          </div>
        ) : null}
      </NodeViewWrapper>

      {blockObject && imageUrl ? (
        <Modal
          isDialogOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          dialogTitle={t('imageViewer')}
          minWidth="lg"
          minHeight="lg"
          dialogContent={
            <div className="flex w-full items-center justify-center">
              <img
                src={imageUrl}
                alt=""
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          }
        />
      ) : null}
    </>
  );
};

export default ImageBlockComponent;
