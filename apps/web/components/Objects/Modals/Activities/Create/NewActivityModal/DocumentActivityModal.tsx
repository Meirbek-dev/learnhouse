'use client';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import * as React from 'react';
import BarLoader from 'react-spinners/BarLoader';

import { constructAcceptValue } from '@/lib/constants';
import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form';

const SUPPORTED_FILES = constructAcceptValue(['pdf']);

function DocumentPdfModal({ submitFileActivity, chapterId, course }: any) {
  const t = useTranslations('Components.DocumentPdfModal');
  const [documentpdf, setDocumentPdf] = React.useState(null) as any;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = React.useState('');

  const handleDocumentPdfChange = (event: React.ChangeEvent<any>) => {
    setDocumentPdf(event.target.files[0]);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);
    const _status = await submitFileActivity(
      documentpdf,
      'documentpdf',
      {
        name,
        chapter_id: chapterId,
        activity_type: 'TYPE_DOCUMENT',
        activity_sub_type: 'SUBTYPE_DOCUMENT_PDF',
        published_version: 1,
        version: 1,
        course_id: course.id,
      },
      chapterId,
    );
    setIsSubmitting(false);
  };

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="documentpdf-activity-name">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('pdfDocumentName')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingName')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={handleNameChange}
            type="text"
            required
          />
        </Form.Control>
      </FormField>
      <FormField name="documentpdf-activity-file">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('pdfDocumentFile')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingFile')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <input
            accept={SUPPORTED_FILES}
            type="file"
            onChange={handleDocumentPdfChange}
            required
          />
        </Form.Control>
      </FormField>

      <Flex className="mt-6 justify-end">
        <Form.Submit asChild>
          <ButtonBlack
            type="submit"
            className="mt-2.5"
          >
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('createActivity')
            )}
          </ButtonBlack>
        </Form.Submit>
      </Flex>
    </FormLayout>
  );
}

export default DocumentPdfModal;
