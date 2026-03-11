'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { createNewCourse, getCourseMetadata } from '@services/courses/courses';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { RadioGroup } from '@/components/ui/radio-group';
import { buildCourseWorkspacePath } from '@/lib/course-management';
import { CourseChoiceCard, courseWorkflowSummaryCardClass } from './courseWorkflowUi';
import { createChapter } from '@services/courses/chapters';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useMemo, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TemplateType = 'blank' | 'starter' | 'outline';
type LaunchDestination = 'overview' | 'curriculum';

interface CourseCreationWizardProps {
  orgslug: string;
  orgId: number;
  sourceCourses: { course_uuid: string; name: string; description?: string }[];
}

const STEPS = ['Basics', 'Template', 'Launch'] as const;

export default function CourseCreationWizard({ orgslug, orgId, sourceCourses }: CourseCreationWizardProps) {
  const t = useTranslations('DashPage.CourseManagement.Wizard');
  const router = useRouter();
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;

  // URL-based step state — browser back button works, page refresh restores position.
  const [step, setStep] = useQueryState('step', { defaultValue: '0', shallow: true });
  const currentStep = Math.min(2, Math.max(0, Number(step)));

  // Persist form state in URL params so back navigation restores choices.
  const [name, setName] = useQueryState('name', { defaultValue: '', shallow: true });
  const [description, setDescription] = useQueryState('desc', { defaultValue: '', shallow: true });
  const [visibility, setVisibility] = useQueryState('vis', { defaultValue: 'private', shallow: true });
  const [template, setTemplate] = useQueryState('tpl', { defaultValue: 'blank', shallow: true });
  const [sourceCourseUuid, setSourceCourseUuid] = useQueryState('src', { defaultValue: '', shallow: true });
  const [launchDestination, setLaunchDestination] = useQueryState('dest', {
    defaultValue: 'curriculum',
    shallow: true,
  });
  const [isPending, startTransition] = useTransition();

  const sourceOptions = useMemo(
    () => sourceCourses.map((course) => ({ ...course, cleanUuid: course.course_uuid.replace(/^course_/, '') })),
    [sourceCourses],
  );

  const stepLabels = [t('steps.basics'), t('steps.template'), t('steps.launch')] as const;

  const starterChapters = useMemo(
    () => [
      {
        name: t('starterChapters.introduction.name'),
        description: t('starterChapters.introduction.description'),
      },
      {
        name: t('starterChapters.coreLessons.name'),
        description: t('starterChapters.coreLessons.description'),
      },
    ],
    [t],
  );

  const canContinue = (() => {
    if (currentStep === 0) {
      return name.trim().length > 0 && description.trim().length > 0;
    }
    if (currentStep === 1 && template === 'outline') {
      return sourceCourseUuid.trim().length > 0;
    }
    return true;
  })();

  const createStarterOutline = async (createdCourse: any) => {
    // Parallel chapter creation — no sequential awaiting.
    await Promise.all(
      starterChapters.map((chapter) =>
        createChapter(
          {
            name: chapter.name,
            description: chapter.description,
            thumbnail_image: '',
            course_id: createdCourse.id,
            org_id: createdCourse.org_id,
          },
          accessToken,
          { courseUuid: createdCourse.course_uuid },
        ),
      ),
    );
  };

  const createOutlineFromSource = async (createdCourse: any) => {
    if (!sourceCourseUuid) return;

    const sourceMetadata = await getCourseMetadata(sourceCourseUuid, null, accessToken, true);
    const chapters = Array.isArray(sourceMetadata?.chapters) ? sourceMetadata.chapters : [];

    // Parallel chapter creation — much faster for large source courses.
    await Promise.all(
      chapters.map((chapter: any) =>
        createChapter(
          {
            name: chapter.name || t('importedChapterName'),
            description: chapter.description || t('importedChapterDescription'),
            thumbnail_image: '',
            course_id: createdCourse.id,
            org_id: createdCourse.org_id,
          },
          accessToken,
          { courseUuid: createdCourse.course_uuid },
        ),
      ),
    );
  };

  const handleCreate = () => {
    if (!accessToken) {
      toast.error(t('errors.authRequired'));
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const result = await createNewCourse(
            orgId,
            {
              name: name.trim(),
              description: description.trim(),
              learnings: JSON.stringify([]),
              tags: JSON.stringify([]),
              visibility: visibility === 'public',
            },
            null,
            accessToken,
            { orgSlug: orgslug },
          );

          if (!result.success) {
            throw new Error(result.data?.detail || t('errors.creationFailed'));
          }

          if (template === 'starter') {
            await createStarterOutline(result.data);
          } else if (template === 'outline') {
            await createOutlineFromSource(result.data);
          }

          toast.success(t('toasts.created'));
          router.push(
            buildCourseWorkspacePath(orgslug, result.data.course_uuid, launchDestination as LaunchDestination),
          );
          router.refresh();
        } catch (error: any) {
          toast.error(error?.message || t('errors.createWorkspace'));
        }
      })();
    });
  };

  const summaryContent = (
    <div className="space-y-4 text-sm text-muted-foreground">
      <div>
        <div className="text-muted-foreground">{t('summary.title')}</div>
        <div className="mt-1 text-base font-semibold text-foreground">{name.trim() || t('summary.untitledCourse')}</div>
      </div>
      <div>
        <div className="text-muted-foreground">{t('summary.visibility')}</div>
        <div className="mt-1">{visibility === 'public' ? t('visibility.public.summary') : t('visibility.private.summary')}</div>
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
          {launchDestination === 'overview' ? t('launch.overview.title') : t('launch.curriculum.title')}
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
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('header.label')}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{t('header.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t('header.description')}
          </p>

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
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('basics.description')}
                  </div>
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('basics.shortDescriptionPlaceholder')}
                    className="min-h-32"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-foreground">{t('basics.audienceDefault')}</legend>
                  <RadioGroup
                    value={visibility}
                    onValueChange={(val) => {
                      void setVisibility(val);
                    }}
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
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('template.description')}
                  </div>
                </div>

                <RadioGroup
                  value={template}
                  onValueChange={(val) => {
                    void setTemplate(val);
                  }}
                  className="grid gap-3"
                >
                  {[
                    {
                      value: 'blank',
                        title: t('template.blank.title'),
                        description: t('template.blank.description'),
                    },
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
                    <select
                      id="source-course"
                      value={sourceCourseUuid}
                      onChange={(e) => setSourceCourseUuid(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm"
                    >
                      <option value="">{t('template.selectCourse')}</option>
                      {sourceOptions.map((course) => (
                        <option
                          key={course.course_uuid}
                          value={course.cleanUuid}
                        >
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-muted-foreground">
                      {t('template.sourceCourseHelp')}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 2: Launch */}
            {currentStep === 2 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('steps.launch')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('launch.description')}
                  </div>
                </div>

                <RadioGroup
                  value={launchDestination}
                  onValueChange={(val) => {
                    void setLaunchDestination(val);
                  }}
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
                      checked={launchDestination === option.value}
                      title={option.title}
                      description={option.description}
                      icon={option.value === 'curriculum' ? ArrowRight : CheckCircle2}
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
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('summary.heading')}</div>
              <div className="mt-4">{summaryContent}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
