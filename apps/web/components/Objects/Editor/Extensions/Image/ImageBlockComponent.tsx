import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { Resizable } from 're-resizable'
import {
  AlertTriangle,
  Image,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { uploadNewImageFile } from '../../../../../services/blocks/Image/images'
import { getActivityBlockMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { useCourse } from '@components/Contexts/CourseContext'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  FileUploadBlock,
  FileUploadBlockButton,
  FileUploadBlockInput,
} from '../../FileUploadBlock'
import { constructAcceptValue } from '@/lib/constants'

const SUPPORTED_FILES = constructAcceptValue(['image'])

function ImageBlockComponent(props: any) {
  const org = useOrg() as any
  const course = useCourse() as any
  const editorState = useEditorProvider() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const isEditable = editorState.isEditable
  const [image, setImage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [blockObject, setblockObject] = useState(props.node.attrs.blockObject)
  const [imageSize, setImageSize] = useState({
    width: props.node.attrs.size ? props.node.attrs.size.width : 300,
  })
  const [alignment, setAlignment] = useState(
    props.node.attrs.alignment || 'center'
  )

  const fileId = blockObject
    ? `${blockObject.content.file_id}.${blockObject.content.file_format}`
    : null

  const handleImageChange = (event: React.ChangeEvent<any>) => {
    setImage(event.target.files[0])
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!image) return;
    setIsLoading(true)
    const object = await uploadNewImageFile(
      image,
      props.extension.options.activity.activity_uuid,
      access_token
    )
    setIsLoading(false)
    setblockObject(object)
    props.updateAttributes({
      blockObject: object,
      size: imageSize,
      alignment: alignment,
    })
  }

  const handleDownload = () => {
    if (!fileId) return

    const imageUrl = getActivityBlockMediaDirectory(
      org?.org_uuid,
      course?.courseStructure.course_uuid,
      props.extension.options.activity.activity_uuid,
      blockObject.block_uuid,
      fileId,
      'imageBlock'
    )

    const link = document.createElement('a')
    link.href = imageUrl || ''
    link.download = `image-${blockObject?.block_uuid || 'download'}.${blockObject?.content.file_format || 'jpg'}`
    link.setAttribute('download', '')
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleAlignmentChange = (newAlignment: string) => {
    setAlignment(newAlignment)
    props.updateAttributes({
      alignment: newAlignment,
    })
  }

  useEffect(() => {}, [course, org])

  const getAlignmentClass = () => {
    switch (alignment) {
      case 'left':
        return 'justify-start'
      case 'right':
        return 'justify-end'
      default:
        return 'justify-center'
    }
  }

  return (
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
        <FileUploadBlockButton onClick={handleSubmit} disabled={!image} />
      </FileUploadBlock>

      {blockObject && isEditable && (
        <div className={`flex w-full ${getAlignmentClass()}`}>
          <Resizable
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
              const newWidth = Math.min(
                imageSize.width + d.width,
                ref.parentElement?.clientWidth || 1000
              )
              props.updateAttributes({
                size: {
                  width: newWidth,
                },
              })
              setImageSize({
                width: newWidth,
              })
            }}
          >
            <div className="relative">
              <img
                src={`${getActivityBlockMediaDirectory(
                  org?.org_uuid,
                  course?.courseStructure.course_uuid,
                  props.extension.options.activity.activity_uuid,
                  blockObject.block_uuid,
                  fileId || '',
                  'imageBlock'
                )}`}
                alt=""
                className="h-auto max-w-full rounded-lg shadow-sm"
                style={{ width: '100%' }}
              />
              <div className="shadow-xs backdrop-blur-xs absolute right-2 top-2 flex items-center gap-1.5 rounded-lg bg-white bg-opacity-90 p-1 opacity-70 transition-opacity hover:opacity-100">
                <button
                  onClick={() => handleAlignmentChange('left')}
                  className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'left' ? 'bg-gray-100' : ''}`}
                  title="Align left"
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  onClick={() => handleAlignmentChange('center')}
                  className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'center' ? 'bg-gray-100' : ''}`}
                  title="Center align"
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  onClick={() => handleAlignmentChange('right')}
                  className={`rounded-md p-1.5 text-gray-600 hover:bg-gray-100 ${alignment === 'right' ? 'bg-gray-100' : ''}`}
                  title="Align right"
                >
                  <AlignRight size={16} />
                </button>
              </div>
            </div>
          </Resizable>
        </div>
      )}

      {blockObject && !isEditable && (
        <div className={`flex w-full ${getAlignmentClass()}`}>
          <div className="relative">
            <img
              src={`${getActivityBlockMediaDirectory(
                org?.org_uuid,
                course?.courseStructure.course_uuid,
                props.extension.options.activity.activity_uuid,
                blockObject.block_uuid,
                fileId || '',
                'imageBlock'
              )}`}
              alt=""
              className="h-auto max-w-full rounded-lg shadow-sm"
              style={{ width: imageSize.width, maxWidth: '100%' }}
            />
            <button
              onClick={handleDownload}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
              title="Download image"
            >
              <Download className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div>
          <AlertTriangle color="#e1e0e0" size={50} />
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default ImageBlockComponent
