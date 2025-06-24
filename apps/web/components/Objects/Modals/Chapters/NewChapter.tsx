'use client';
import { FormMessage } from '@radix-ui/react-form';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import BarLoader from 'react-spinners/BarLoader';

import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form';

function NewChapterModal({ submitChapter, closeModal, course }: any) {
  const t = useTranslations('Components.NewChapterModal');
  const [chapterName, setChapterName] = useState('');
  const [chapterDescription, setChapterDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChapterNameChange = (e: any) => {
    setChapterName(e.target.value);
  };

  const handleChapterDescriptionChange = (e: any) => {
    setChapterDescription(e.target.value);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    setIsSubmitting(true);
    const chapter_object = {
      name: chapterName,
      description: chapterDescription,
      thumbnail_image: '',
      course_id: course.id,
      org_id: course.org_id,
    };
    await submitChapter(chapter_object);
    setIsSubmitting(false);
  };

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="chapter-name">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('chapterName')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingName')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={handleChapterNameChange}
            type="text"
            required
          />
        </Form.Control>
      </FormField>
      <FormField name="chapter-desc">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('chapterDescription')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingDescription')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Textarea
            onChange={handleChapterDescriptionChange}
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
              t('createChapter')
            )}
          </ButtonBlack>
        </Form.Submit>
      </Flex>
    </FormLayout>
  );
}

export default NewChapterModal;
