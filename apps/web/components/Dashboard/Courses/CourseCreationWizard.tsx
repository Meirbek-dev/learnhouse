'use client';

import { buildCourseWorkspacePath, cleanCourseUuid, prefixedCourseUuid } from '@/lib/course-management';
import { CheckCircle2, ChevronDown, Loader2, Search, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CourseChoiceCard, courseWorkflowSummaryCardClass } from './courseWorkflowUi';
import { createNewCourse, getCourseMetadata, searchEditableCourses } from '@services/courses/courses';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { CourseWizardValues } from '@/schemas/courseSchemas';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { courseWizardSchema } from '@/schemas/courseSchemas';
import { createChapter } from '@services/courses/chapters';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CourseCreationWizard() {
  const t = useTranslations('DashPage.CourseManagement.Wizard');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const form = useForm<CourseWizardValues>({
    resolver: valibotResolver(courseWizardSchema),
    defaultValues: {
      name: '',
      description: '',
      public: false,
      template: 'blank',
      sourceCourseUuid: '',
    },
  });

  const { name, description, template, sourceCourseUuid, public: isPublic } = form.watch();

  const [isPending, startTransition] = useTransition();

  // ── Async source-course combobox ──────────────────────────────────────────
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceOptions, setSourceOptions] = useState<{ course_uuid: string; name: string; cleanUuid: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSourceName, setSelectedSourceName] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSourceSearch = useCallback(
    (query: string) => {
      setSourceQuery(query);
      if (!accessToken) return;

      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchEditableCourses(query, accessToken, 20);
          setSourceOptions(
            results.map((c: any) => ({
              course_uuid: c.course_uuid,
              name: c.name,
              cleanUuid: cleanCourseUuid(c.course_uuid) ?? c.course_uuid,
            })),
          );
        } catch {
          // ignore search errors
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [accessToken],
  );

  // Trigger initial load when outline panel opens
  useEffect(() => {
    if (template === 'outline' && sourceOptions.length === 0 && accessToken) {
       handleSourceSearch('');
    }
  }, [template, sourceOptions.length, accessToken, handleSourceSearch]);

  useEffect(() => {
    const templateParam = searchParams.get('tpl');
    const sourceParam = searchParams.get('src');

    if (templateParam === 'outline' || templateParam === 'starter' || templateParam === 'blank') {
      form.setValue('template', templateParam);
      setShowAdvancedOptions(templateParam !== 'blank');
    }

    if (sourceParam?.trim()) {
      form.setValue('sourceCourseUuid', cleanCourseUuid(sourceParam));
      form.setValue('template', 'outline');
      setShowAdvancedOptions(true);
    }
  }, [form, searchParams]);

  const canCreate =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    (template !== 'outline' || Boolean(sourceCourseUuid?.trim()));

  const createOutlineFromSource = async (createdCourse: any) => {
    if (!sourceCourseUuid) return;
    const sourceMetadata = await getCourseMetadata(prefixedCourseUuid(sourceCourseUuid), null, accessToken, true);
    const chapters = Array.isArray(sourceMetadata?.chapters) ? sourceMetadata.chapters : [];
    for (const chapter of chapters) {
      await createChapter(
        {
          name: chapter.name || t('importedChapterName'),
          description: chapter.description || t('importedChapterDescription'),
          thumbnail_image: '',
          course_id: createdCourse.id,
        },
        accessToken,
      );
    }
  };

  const handleCreate = form.handleSubmit((values) => {
    if (!accessToken) {
      toast.error(t('errors.authRequired'));
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const result = await createNewCourse(
            {
              name: values.name.trim(),
              description: values.description.trim(),
              learnings: JSON.stringify([]),
              tags: JSON.stringify([]),
              visibility: values.public,
              // 'starter' template → backend seeds chapters atomically
              // 'outline' → we copy from source after creation
              // 'blank' → no seeding
              template: values.template !== 'outline' ? values.template : undefined,
            },
            null,
            accessToken,
          );

          if (!result.success) {
            throw new Error(result.data?.detail || t('errors.creationFailed'));
          }

          // 'outline' copies chapters from the source course client-side
          // (backend doesn't know which source to copy from)
          if (values.template === 'outline') {
            await createOutlineFromSource(result.data);
          }

          toast.success(t('toasts.created'));
          router.replace(buildCourseWorkspacePath(result.data.course_uuid, 'curriculum'));
          router.refresh();
        } catch (error: any) {
          toast.error(error?.message || t('errors.createWorkspace'));
        }
      })();
    });
  });

  const summaryContent = (
    <div className="space-y-4 text-sm text-muted-foreground">
      <div>
        <div className="text-muted-foreground">{t('summary.title')}</div>
        <div className="mt-1 text-base font-semibold text-foreground">{name.trim() || t('summary.untitledCourse')}</div>
      </div>
      <div>
        <div className="text-muted-foreground">{t('summary.visibility')}</div>
        <div className="mt-1">{isPublic ? t('visibility.public.summary') : t('visibility.private.summary')}</div>
      </div>
      <div>
        <div className="text-muted-foreground">{t('summary.template')}</div>
        <div className="mt-1">
          {template === 'blank'
            ? t('template.blank.title')
            : template === 'starter'
              ? t('template.starter.title')
              : t('template.outline.title')}
        </div>
      </div>
      {template === 'outline' && sourceCourseUuid ? (
        <div>
          <div className="text-muted-foreground">{t('summary.sourceCourse')}</div>
          <div className="mt-1">{selectedSourceName || t('summary.selectedOutlineCourse')}</div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('header.label')}
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{t('header.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('header.description')}</p>
        </div>

        <div className="xl:hidden">
          <Collapsible>
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="group flex w-full items-center justify-between rounded-t-xl border bg-card px-5 py-4 text-foreground"
                />
              }
            >
              <span className="text-sm font-semibold">{t('summary.heading')}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="rounded-b-xl border border-t-0 bg-card px-5 pb-5 text-foreground">
              {summaryContent}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-foreground">{t('steps.basics')}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t('basics.description')}</div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="course-title"
                  className="text-sm font-medium text-foreground"
                >
                  {t('basics.courseTitle')}
                </label>
                <Input
                  id="course-title"
                  {...form.register('name')}
                  placeholder={t('basics.courseTitlePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="course-description"
                  className="text-sm font-medium text-foreground"
                >
                  {t('basics.shortDescription')}
                </label>
                <Textarea
                  id="course-description"
                  {...form.register('description')}
                  placeholder={t('basics.shortDescriptionPlaceholder')}
                  className="min-h-32"
                />
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">{t('basics.audienceDefault')}</legend>
                <RadioGroup
                  value={isPublic ? 'public' : 'private'}
                  onValueChange={(val) => form.setValue('public', val === 'public')}
                  className="grid gap-3 md:grid-cols-2"
                >
                  {[
                    {
                      value: 'private',
                      title: t('visibility.private.title'),
                      description: t('visibility.private.description'),
                    },
                    {
                      value: 'public',
                      title: t('visibility.public.title'),
                      description: t('visibility.public.description'),
                    },
                  ].map((option) => (
                    <CourseChoiceCard
                      key={option.value}
                      id={`vis-${option.value}`}
                      value={option.value}
                      checked={(isPublic ? 'public' : 'private') === option.value}
                      title={option.title}
                      description={option.description}
                      icon={option.value === 'public' ? CheckCircle2 : Sparkles}
                      onSelect={(value) => form.setValue('public', value === 'public')}
                    />
                  ))}
                </RadioGroup>
              </fieldset>

              <Collapsible
                open={showAdvancedOptions}
                onOpenChange={setShowAdvancedOptions}
              >
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between rounded-xl border bg-muted/30 px-4 py-3 text-left"
                    />
                  }
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t('steps.template')}</div>
                    <div className="text-sm text-muted-foreground">{t('template.description')}</div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-5 rounded-xl border bg-card p-4">
                  <RadioGroup
                    value={template}
                    onValueChange={(val) => form.setValue('template', val as CourseWizardValues['template'])}
                    className="grid gap-3"
                  >
                    {[
                      { value: 'blank', title: t('template.blank.title'), description: t('template.blank.description') },
                      {
                        value: 'starter',
                        title: t('template.starter.title'),
                        description: t('template.starter.description'),
                      },
                      {
                        value: 'outline',
                        title: t('template.outline.title'),
                        description: t('template.outline.description'),
                      },
                    ].map((option) => (
                      <CourseChoiceCard
                        key={option.value}
                        id={`tpl-${option.value}`}
                        value={option.value}
                        checked={template === option.value}
                        title={option.title}
                        description={option.description}
                        icon={option.value === 'outline' ? ChevronDown : option.value === 'starter' ? Sparkles : CheckCircle2}
                        onSelect={(value) => form.setValue('template', value as CourseWizardValues['template'])}
                      />
                    ))}
                  </RadioGroup>

                  {template === 'outline' ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="source-course-search"
                        className="text-sm font-medium text-foreground"
                      >
                        {t('template.sourceCourse')}
                      </label>

                      {/* Async search input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="source-course-search"
                          value={sourceQuery}
                          onChange={(e) => handleSourceSearch(e.target.value)}
                          placeholder={t('template.selectCourse')}
                          className="pl-9"
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {/* Results list */}
                      {sourceOptions.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-md">
                          {sourceOptions.map((course) => (
                            <button
                              key={course.course_uuid}
                              type="button"
                              className={cn(
                                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                sourceCourseUuid === course.cleanUuid && 'bg-accent font-medium',
                              )}
                              onClick={() => {
                                form.setValue('sourceCourseUuid', course.cleanUuid);
                                setSelectedSourceName(course.name);
                                setSourceQuery(course.name);
                              }}
                            >
                              {course.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {sourceCourseUuid && (
                        <p className="text-xs text-muted-foreground">
                          {t('template.sourceCourseHelp')}
                        </p>
                      )}
                    </div>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="mt-8 flex items-center justify-between border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dash/courses')}
                disabled={isPending}
              >
                {tCommon('cancel')}
              </Button>

              <Button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate || isPending}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {t('actions.createWorkspace')}
              </Button>
            </div>
          </div>

          <div className="hidden xl:block">
            <div className={cn('sticky top-6', courseWorkflowSummaryCardClass)}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('summary.heading')}
              </div>
              <div className="mt-4">{summaryContent}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
