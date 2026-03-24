'use client';

import { buildCourseWorkspacePath, cleanCourseUuid, prefixedCourseUuid } from '@/lib/course-management';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CourseChoiceCard, courseWorkflowSummaryCardClass } from './courseWorkflowUi';
import { createNewCourse, getCourseMetadata } from '@services/courses/courses';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { CourseWizardValues } from '@/schemas/courseSchemas';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { courseWizardSchema } from '@/schemas/courseSchemas';
import { createChapter } from '@services/courses/chapters';
import { RadioGroup } from '@/components/ui/radio-group';
import { useQueryParam } from '@/hooks/useQueryParam';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useMemo, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CourseCreationWizardProps {
  sourceCourses: { course_uuid: string; name: string; description?: string }[];
}

const STEPS = ['Basics', 'Template', 'Launch'] as const;

export default function CourseCreationWizard({ sourceCourses }: CourseCreationWizardProps) {
  const t = useTranslations('DashPage.CourseManagement.Wizard');
  const router = useRouter();
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;

  const [step, setStep] = useQueryParam('step', '0');
  const currentStep = Math.min(2, Math.max(0, Number(step)));

  const form = useForm<CourseWizardValues>({
    resolver: valibotResolver(courseWizardSchema),
    defaultValues: {
      name: '',
      description: '',
      public: false,
      template: 'blank',
      sourceCourseUuid: '',
      launchDest: 'curriculum',
    },
  });

  const { name, description, template, sourceCourseUuid, launchDest, public: isPublic } = form.watch();

  const [isPending, startTransition] = useTransition();

  const sourceOptions = useMemo(
    () =>
      sourceCourses.map((course) => ({
        ...course,
        cleanUuid: cleanCourseUuid(course.course_uuid) ?? course.course_uuid,
      })),
    [sourceCourses],
  );

  const stepLabels = [t('steps.basics'), t('steps.template'), t('steps.launch')] as const;

  const starterChapters = useMemo(
    () => [
      { name: t('starterChapters.introduction.name'), description: t('starterChapters.introduction.description') },
      { name: t('starterChapters.coreLessons.name'), description: t('starterChapters.coreLessons.description') },
    ],
    [t],
  );

  const canContinue = (() => {
    if (currentStep === 0) return name.trim().length > 0 && description.trim().length > 0;
    if (currentStep === 1 && template === 'outline') return Boolean(sourceCourseUuid?.trim());
    return true;
  })();

  const createStarterOutline = async (createdCourse: any) => {
    await Promise.all(
      starterChapters.map((chapter) =>
        createChapter(
          { name: chapter.name, description: chapter.description, thumbnail_image: '', course_id: createdCourse.id },
          accessToken,
          { courseUuid: createdCourse.course_uuid },
        ),
      ),
    );
  };

  const createOutlineFromSource = async (createdCourse: any) => {
    if (!sourceCourseUuid) return;
    const sourceMetadata = await getCourseMetadata(prefixedCourseUuid(sourceCourseUuid), null, accessToken, true);
    const chapters = Array.isArray(sourceMetadata?.chapters) ? sourceMetadata.chapters : [];
    await Promise.all(
      chapters.map((chapter: any) =>
        createChapter(
          {
            name: chapter.name || t('importedChapterName'),
            description: chapter.description || t('importedChapterDescription'),
            thumbnail_image: '',
            course_id: createdCourse.id,
          },
          accessToken,
          { courseUuid: createdCourse.course_uuid },
        ),
      ),
    );
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
            },
            null,
            accessToken,
          );

          if (!result.success) {
            throw new Error(result.data?.detail || t('errors.creationFailed'));
          }

          if (values.template === 'starter') {
            await createStarterOutline(result.data);
          } else if (values.template === 'outline') {
            await createOutlineFromSource(result.data);
          }

          toast.success(t('toasts.created'));
          router.replace(buildCourseWorkspacePath(result.data.course_uuid, values.launchDest));
          router.refresh();
        } catch (error: any) {
          toast.error(error?.message || t('errors.createWorkspace'));
        }
      })();
    });
  });

  const visibility = isPublic ? 'public' : 'private';

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
      <div>
        <div className="text-muted-foreground">{t('summary.launchDestination')}</div>
        <div className="mt-1">
          {launchDest === 'overview' ? t('launch.overview.title') : t('launch.curriculum.title')}
        </div>
      </div>
      {template === 'outline' && sourceCourseUuid ? (
        <div>
          <div className="text-muted-foreground">{t('summary.sourceCourse')}</div>
          <div className="mt-1">
            {sourceOptions.find((c) => c.cleanUuid === sourceCourseUuid)?.name || t('summary.selectedOutlineCourse')}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header + step indicator */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('header.label')}
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{t('header.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('header.description')}</p>

          {/* Linear step indicator */}
          <div className="mt-5 flex items-center">
            {stepLabels.map((label, index) => {
              const done = index < currentStep;
              const active = index === currentStep;
              return (
                <div
                  key={label}
                  className="flex items-center"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        done && 'bg-primary/80 text-primary-foreground',
                        active && 'bg-primary text-primary-foreground',
                        !done && !active && 'border border-input text-muted-foreground',
                      )}
                    >
                      {done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                    </div>
                    <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn('mx-3 h-px w-8 shrink-0', done ? 'bg-primary/60' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile summary collapsible */}
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
          {/* Main form */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            {/* Step 0: Basics */}
            {currentStep === 0 ? (
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
                    value={visibility}
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
                        checked={visibility === option.value}
                        title={option.title}
                        description={option.description}
                        icon={option.value === 'public' ? CheckCircle2 : ArrowLeft}
                        onSelect={(value) => form.setValue('public', value === 'public')}
                      />
                    ))}
                  </RadioGroup>
                </fieldset>
              </div>
            ) : null}

            {/* Step 1: Template */}
            {currentStep === 1 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('steps.template')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{t('template.description')}</div>
                </div>

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
                      icon={
                        option.value === 'outline' ? ChevronDown : option.value === 'starter' ? Sparkles : CheckCircle2
                      }
                      onSelect={(value) => form.setValue('template', value as CourseWizardValues['template'])}
                    />
                  ))}
                </RadioGroup>

                {template === 'outline' ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="source-course"
                      className="text-sm font-medium text-foreground"
                    >
                      {t('template.sourceCourse')}
                    </label>
                    <Select
                      value={sourceCourseUuid ?? undefined}
                      onValueChange={(value) => {
                        if (value) form.setValue('sourceCourseUuid', value);
                      }}
                      items={sourceOptions.map((course) => ({ value: course.cleanUuid, label: course.name }))}
                    >
                      <SelectTrigger id="source-course">
                        <SelectValue placeholder={t('template.selectCourse')} />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((course) => (
                          <SelectItem
                            key={course.course_uuid}
                            value={course.cleanUuid}
                          >
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-sm text-muted-foreground">{t('template.sourceCourseHelp')}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 2: Launch */}
            {currentStep === 2 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('steps.launch')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{t('launch.description')}</div>
                </div>

                <RadioGroup
                  value={launchDest}
                  onValueChange={(val) => form.setValue('launchDest', val as CourseWizardValues['launchDest'])}
                  className="grid gap-3 md:grid-cols-2"
                >
                  {[
                    {
                      value: 'overview',
                      title: t('launch.overview.title'),
                      description: t('launch.overview.description'),
                    },
                    {
                      value: 'curriculum',
                      title: t('launch.curriculum.title'),
                      description: t('launch.curriculum.description'),
                    },
                  ].map((option) => (
                    <CourseChoiceCard
                      key={option.value}
                      id={`dest-${option.value}`}
                      value={option.value}
                      checked={launchDest === option.value}
                      title={option.title}
                      description={option.description}
                      icon={option.value === 'curriculum' ? ArrowRight : CheckCircle2}
                      onSelect={(value) => form.setValue('launchDest', value as CourseWizardValues['launchDest'])}
                    />
                  ))}
                </RadioGroup>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(String(currentStep - 1))}
                disabled={currentStep === 0 || isPending}
              >
                <ArrowLeft className="size-4" />
                {t('actions.back')}
              </Button>

              {currentStep < 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep(String(currentStep + 1))}
                  disabled={!canContinue || isPending}
                >
                  {t('actions.continue')}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canContinue || isPending}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {t('actions.createWorkspace')}
                </Button>
              )}
            </div>
          </div>

          {/* Desktop summary sidebar */}
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
