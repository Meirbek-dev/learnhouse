import { FileUploadBlock, FileUploadBlockButton, FileUploadBlockInput } from '../../FileUploadBlock';
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext';
import { uploadNewPDFFile } from '../../../../../services/blocks/Pdf/pdf';
import { AlertTriangle, Download, Expand, FileText } from 'lucide-react';
import { getActivityBlockMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { constructAcceptValue } from '@/lib/constants';
import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { styled } from 'styled-components';

const SUPPORTED_FILES = constructAcceptValue(['pdf']);

function PDFBlockComponent(props: any) {
  const org = useOrg() as any;
  const course = useCourse() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [pdf, setPDF] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [blockObject, setblockObject] = useState(props.node.attrs.blockObject);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileId = blockObject ? `${blockObject.content.file_id}.${blockObject.content.file_format}` : null;
  const editorState = useEditorProvider() as any;
  const { isEditable } = editorState;

  const handlePDFChange = (event: React.ChangeEvent<any>) => {
    setPDF(event.target.files[0]);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!pdf) return; // Guard: only proceed if pdf is not null
    setIsLoading(true);
    const object = await uploadNewPDFFile(pdf, props.extension.options.activity.activity_uuid, access_token);
    setIsLoading(false);
    setblockObject(object);
    props.updateAttributes({
      blockObject: object,
    });
  };

  const handleDownload = () => {
    if (!fileId) return;

    const pdfUrl = getActivityBlockMediaDirectory(
      org?.org_uuid,
      course?.courseStructure.course_uuid,
      props.extension.options.activity.activity_uuid,
      blockObject.block_uuid,
      fileId,
      'pdfBlock',
    );

    const link = document.createElement('a');
    link.href = pdfUrl || '';
    link.download = `document-${blockObject?.block_uuid || 'download'}.${blockObject?.content.file_format || 'pdf'}`;
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

  const pdfUrl = blockObject
    ? getActivityBlockMediaDirectory(
        org?.org_uuid,
        course?.courseStructure.course_uuid,
        props.extension.options.activity.activity_uuid,
        blockObject.block_uuid,
        fileId || '',
        'pdfBlock',
      )
    : null;

  useEffect(() => {}, [course, org]);

  return (
    <>
      <NodeViewWrapper className="block-pdf">
        <FileUploadBlock
          isEditable={isEditable}
          isLoading={isLoading}
          isEmpty={!blockObject}
          Icon={FileText}
        >
          <FileUploadBlockInput
            onChange={handlePDFChange}
            accept={SUPPORTED_FILES}
          />
          <FileUploadBlockButton
            onClick={handleSubmit}
            disabled={!pdf}
          />
        </FileUploadBlock>

        {blockObject && (
          <BlockPDF>
            <div className="relative">
              <iframe
                className="h-96 w-full rounded-lg bg-black object-scale-down shadow-sm"
                src={pdfUrl || ''}
                title="PDF Document Viewer"
              />
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  onClick={handleExpand}
                  className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                  title="Expand PDF"
                >
                  <Expand className="h-4 w-4 text-white" />
                </button>
                {!isEditable && (
                  <button
                    onClick={handleDownload}
                    className="rounded-full bg-black/50 p-2 transition-colors hover:bg-black/70"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          </BlockPDF>
        )}
        {isLoading && (
          <div>
            <AlertTriangle
              color="#e1e0e0"
              size={50}
            />
          </div>
        )}
      </NodeViewWrapper>

      {blockObject && pdfUrl && (
        <Modal
          isDialogOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          dialogTitle="PDF Document"
          minWidth="xl"
          minHeight="xl"
          dialogContent={
            <div className="h-[80vh] w-full">
              <iframe
                className="h-full w-full rounded-lg border shadow-lg"
                src={pdfUrl}
                title="PDF Document"
              />
            </div>
          }
        />
      )}
    </>
  );
}

export default PDFBlockComponent;

const BlockPDF = styled.div`
  display: flex;
  flex-direction: column;
  img {
    width: 100%;
    height: 300px;
    // cover
    object-fit: cover;
    border-radius: 6px;
  }
`;
const _PDFNotFound = styled.div``;
