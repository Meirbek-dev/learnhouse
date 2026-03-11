'use client';

import { buildCourseWorkspacePath } from '@/lib/course-management';
import { createChapter } from '@services/courses/chapters';
import { createNewCourse, getCourseMetadata } from '@services/courses/courses';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

type TemplateType = 'blank' | 'starter' | 'outline';
type LaunchDestination = 'overview' | 'curriculum';

interface CourseCreationWizardProps {
  orgslug: string;
  orgId: number;
  sourceCourses: Array<{ course_uuid: string; name: string; description?: string }>;
}

const starterChapters = [
  { name: 'Introduction', description: 'Start the course with context, goals, and navigation guidance.' },
  { name: 'Core lessons', description: 'Add the first activities that deliver the main learning value.' },
];

export default function CourseCreationWizard({ orgslug, orgId, sourceCourses }: CourseCreationWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const initialSource = searchParams.get('source') || '';
  const initialTemplate = (searchParams.get('template') as TemplateType | null) || 'blank';
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [template, setTemplate] = useState<TemplateType>(initialTemplate);
  const [sourceCourseUuid, setSourceCourseUuid] = useState(initialSource);
  const [launchDestination, setLaunchDestination] = useState<LaunchDestination>('curriculum');
  const [isPending, startTransition] = useTransition();

  const sourceOptions = useMemo(
    () => sourceCourses.map((course) => ({ ...course, cleanUuid: course.course_uuid.replace(/^course_/, '') })),
    [sourceCourses],
  );

  const canContinue = (() => {
    if (step === 0) {
      return name.trim().length > 0 && description.trim().length > 0;
    }
    if (step === 1 && template === 'outline') {
      return sourceCourseUuid.trim().length > 0;
    }
    return true;
  })();

  const createStarterOutline = async (createdCourse: any) => {
    for (const chapter of starterChapters) {
      await createChapter(
        {
          name: chapter.name,
          description: chapter.description,
          thumbnail_image: '',
          course_id: createdCourse.id,
          org_id: createdCourse.org_id,
        },
        accessToken,
        { courseUuid: createdCourse.course_uuid },
      );
    }
  };

  const createOutlineFromSource = async (createdCourse: any) => {
    if (!sourceCourseUuid) {
      return;
    }

    const sourceMetadata = await getCourseMetadata(sourceCourseUuid, null, accessToken, true);
    const chapters = Array.isArray(sourceMetadata?.chapters) ? sourceMetadata.chapters : [];

    for (const chapter of chapters) {
      await createChapter(
        {
          name: chapter.name || 'Imported chapter',
          description: chapter.description || 'Imported from source course outline.',
          thumbnail_image: '',
          course_id: createdCourse.id,
          org_id: createdCourse.org_id,
        },
        accessToken,
        { courseUuid: createdCourse.course_uuid },
      );
    }
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
          }

          if (template === 'outline') {
            await createOutlineFromSource(result.data);
          }

          toast.success('Course workspace created.');
          router.push(buildCourseWorkspacePath(orgslug, result.data.course_uuid, launchDestination));
          router.refresh();
        } catch (error: any) {
          toast.error(error?.message || 'Unable to create course workspace.');
        }
      })();
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_24%,_#f7f5ef_100%)] px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Guided setup</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Create a course workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            This replaces the old modal-first creation flow. Use it to start from a blank course, seed a starter outline, or reuse another course as a structural template.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Basics', 'Template', 'Launch'].map((label, index) => (
              <Badge
                key={label}
                variant={index <= step ? 'default' : 'outline'}
              >
                {index + 1}. {label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {step === 0 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Basics</div>
                  <div className="mt-1 text-sm text-slate-600">Start with the public-facing identity and intended audience posture for this course.</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Course title</label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Example: Data Analysis for Teachers"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Short description</label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Explain what learners will get from this course and who it is for."
                    className="min-h-32"
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-700">Audience default</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={`rounded-2xl border p-4 text-left ${visibility === 'private' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <div className="font-medium">Private</div>
                      <div className="mt-1 text-sm opacity-80">Keep the course internal while the team builds and reviews it.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('public')}
                      className={`rounded-2xl border p-4 text-left ${visibility === 'public' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <div className="font-medium">Public</div>
                      <div className="mt-1 text-sm opacity-80">Launch the workspace ready for public discovery after review.</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Template</div>
                  <div className="mt-1 text-sm text-slate-600">Choose how much structure you want the new course to start with.</div>
                </div>
                <div className="grid gap-3">
                  {[
                    { value: 'blank', title: 'Blank workspace', description: 'Start with an empty course and build structure manually.' },
                    { value: 'starter', title: 'Starter outline', description: 'Seed the workspace with two starter chapters for faster setup.' },
                    { value: 'outline', title: 'Use existing course as outline', description: 'Reuse chapter structure from another editable course.' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTemplate(option.value as TemplateType)}
                      className={`rounded-2xl border p-4 text-left ${template === option.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <div className="font-medium">{option.title}</div>
                      <div className="mt-1 text-sm opacity-80">{option.description}</div>
                    </button>
                  ))}
                </div>

                {template === 'outline' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Source course</label>
                    <select
                      value={sourceCourseUuid}
                      onChange={(event) => setSourceCourseUuid(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
                    <div className="text-sm text-slate-500">This copies the chapter outline only, not activity content.</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Launch</div>
                  <div className="mt-1 text-sm text-slate-600">Decide where to land after the workspace is created.</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setLaunchDestination('overview')}
                    className={`rounded-2xl border p-4 text-left ${launchDestination === 'overview' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    <div className="font-medium">Open overview</div>
                    <div className="mt-1 text-sm opacity-80">Land in the workspace control center first.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLaunchDestination('curriculum')}
                    className={`rounded-2xl border p-4 text-left ${launchDestination === 'curriculum' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    <div className="font-medium">Open curriculum</div>
                    <div className="mt-1 text-sm opacity-80">Jump straight into chapters and activities.</div>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0 || isPending}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>

              {step < 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep((current) => Math.min(2, current + 1))}
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

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Setup summary</div>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div>
                <div className="text-slate-400">Title</div>
                <div className="mt-1 text-lg font-semibold text-white">{name.trim() || 'Untitled course'}</div>
              </div>
              <div>
                <div className="text-slate-400">Visibility</div>
                <div className="mt-1">{visibility === 'public' ? 'Public launch target' : 'Private draft mode'}</div>
              </div>
              <div>
                <div className="text-slate-400">Template</div>
                <div className="mt-1 capitalize">{template === 'outline' ? 'Existing outline' : template}</div>
              </div>
              <div>
                <div className="text-slate-400">Launch destination</div>
                <div className="mt-1 capitalize">{launchDestination}</div>
              </div>
              {template === 'outline' && sourceCourseUuid ? (
                <div>
                  <div className="text-slate-400">Source course</div>
                  <div className="mt-1">{sourceOptions.find((course) => course.cleanUuid === sourceCourseUuid)?.name || 'Selected outline course'}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
