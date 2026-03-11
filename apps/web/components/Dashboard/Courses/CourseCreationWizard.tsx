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

const starterChapters = [
  { name: 'Introduction', description: 'Start the course with context, goals, and navigation guidance.' },
  { name: 'Core lessons', description: 'Add the first activities that deliver the main learning value.' },
];

export default function CourseCreationWizard({ orgslug, orgId, sourceCourses }: CourseCreationWizardProps) {
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
            name: chapter.name || 'Imported chapter',
            description: chapter.description || 'Imported from source course outline.',
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
      toast.error('You must be signed in to create a course.');
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
            throw new Error(result.data?.detail || 'Course creation failed.');
          }

          if (template === 'starter') {
            await createStarterOutline(result.data);
          } else if (template === 'outline') {
            await createOutlineFromSource(result.data);
          }

          toast.success('Course workspace created.');
          router.push(
            buildCourseWorkspacePath(orgslug, result.data.course_uuid, launchDestination as LaunchDestination),
          );
          router.refresh();
        } catch (error: any) {
          toast.error(error?.message || 'Unable to create course workspace.');
        }
      })();
    });
  };

  const summaryContent = (
    <div className="space-y-4 text-sm text-muted-foreground">
      <div>
        <div className="text-muted-foreground">Title</div>
        <div className="mt-1 text-base font-semibold text-foreground">{name.trim() || 'Untitled course'}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Visibility</div>
        <div className="mt-1">{visibility === 'public' ? 'Public launch target' : 'Private draft mode'}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Template</div>
        <div className="mt-1 capitalize">{template === 'outline' ? 'Existing outline' : template}</div>
      </div>
      <div>
        <div className="text-muted-foreground">Launch destination</div>
        <div className="mt-1 capitalize">{launchDestination}</div>
      </div>
      {template === 'outline' && sourceCourseUuid ? (
        <div>
          <div className="text-muted-foreground">Source course</div>
          <div className="mt-1">
            {sourceOptions.find((c) => c.cleanUuid === sourceCourseUuid)?.name || 'Selected outline course'}
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
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guided setup</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">Create a course workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Start from a blank course, seed a starter outline, or reuse another course as a structural template.
          </p>

          {/* Linear step indicator */}
          <div className="mt-5 flex items-center">
            {STEPS.map((label, index) => {
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
              <span className="text-sm font-semibold">Setup summary</span>
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
                  <div className="text-sm font-semibold text-foreground">Basics</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Start with the public-facing identity and intended audience posture for this course.
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="course-title"
                    className="text-sm font-medium text-foreground"
                  >
                    Course title
                  </label>
                  <Input
                    id="course-title"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Example: Data Analysis for Teachers"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="course-description"
                    className="text-sm font-medium text-foreground"
                  >
                    Short description
                  </label>
                  <Textarea
                    id="course-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what learners will get from this course and who it is for."
                    className="min-h-32"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-foreground">Audience default</legend>
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
                        title: 'Private',
                        description: 'Keep the course internal while the team builds and reviews it.',
                      },
                      {
                        value: 'public',
                        title: 'Public',
                        description: 'Launch the workspace ready for public discovery after review.',
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
                  <div className="text-sm font-semibold text-foreground">Template</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Choose how much structure you want the new course to start with.
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
                      title: 'Blank workspace',
                      description: 'Start with an empty course and build structure manually.',
                    },
                    {
                      value: 'starter',
                      title: 'Starter outline',
                      description: 'Seed the workspace with two starter chapters for faster setup.',
                    },
                    {
                      value: 'outline',
                      title: 'Use existing course as outline',
                      description: 'Reuse chapter structure from another editable course.',
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
                      Source course
                    </label>
                    <select
                      id="source-course"
                      value={sourceCourseUuid}
                      onChange={(e) => setSourceCourseUuid(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm"
                    >
                      <option value="">Select a course</option>
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
                      This copies the chapter outline only, not activity content.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 2: Launch */}
            {currentStep === 2 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-foreground">Launch</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Decide where to land after the workspace is created.
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
                      title: 'Open overview',
                      description: 'Land in the workspace control center first.',
                    },
                    {
                      value: 'curriculum',
                      title: 'Open curriculum',
                      description: 'Jump straight into chapters and activities.',
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
                Back
              </Button>

              {currentStep < 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep(String(currentStep + 1))}
                  disabled={!canContinue || isPending}
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canContinue || isPending}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Create workspace
                </Button>
              )}
            </div>
          </div>

          {/* Desktop summary sidebar */}
          <div className="hidden xl:block">
            <div className={cn('sticky top-6', courseWorkflowSummaryCardClass)}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setup summary</div>
              <div className="mt-4">{summaryContent}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
