'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Code2, PencilLine, Plus, Trash2 } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateOrganization } from '@services/settings/org';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import type { FC } from 'react';
import { mutate } from 'swr';
import * as z from 'zod';

interface Script {
  name: string;
  content: string;
}

interface OrganizationScripts {
  scripts: Script[];
}

const getValidationSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    content: z.string().min(1, t('validation.contentRequired')),
  });

type ScriptFormData = z.infer<ReturnType<typeof getValidationSchema>>;

const OrgEditOther: FC = () => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const [selectedView, setSelectedView] = useState<'list' | 'edit'>('list');
  // Initialize scripts from org with lazy initialization
  const [scripts, setScripts] = useState<Script[]>(() => {
    if (org?.scripts?.scripts) {
      return Array.isArray(org.scripts.scripts) ? org.scripts.scripts : [];
    }
    return [];
  });
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const t = useTranslations('DashPage.Other');

  const updateOrg = async (values: Script) => {
    const loadingToast = toast.loading(t('updatingOrganization'));
    try {
      let updatedScripts: Script[];

      if (currentScript) {
        // Edit existing script
        updatedScripts = scripts.map((script) => (script.name === currentScript.name ? values : script));
      } else {
        // Add new script
        updatedScripts = [...scripts, values];
      }

      // Create a new organization object with scripts array wrapped in an object
      const updateData = {
        id: org.id,
        scripts: {
          scripts: updatedScripts,
        },
      };

      await updateOrganization(org.id, updateData, access_token);
      await revalidateTags(['organizations'], org.slug);
      mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);
      setScripts(updatedScripts);
      setSelectedView('list');
      setCurrentScript(null);
      toast.success(t('scriptSavedSuccess'), { id: loadingToast });
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error(t('scriptSaveError'), { id: loadingToast });
    }
  };

  const deleteScript = async (scriptToDelete: Script) => {
    const loadingToast = toast.loading(t('deletingScript'));
    try {
      const updatedScripts = scripts.filter((script) => script.name !== scriptToDelete.name);

      // Create a new organization object with scripts array wrapped in an object
      const updateData = {
        id: org.id,
        scripts: {
          scripts: updatedScripts,
        },
      };

      await updateOrganization(org.id, updateData, access_token);
      await revalidateTags(['organizations'], org.slug);
      mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);
      setScripts(updatedScripts);
      toast.success(t('scriptDeletedSuccess'), { id: loadingToast });
    } catch (error) {
      console.error('Error deleting script:', error);
      toast.error(t('scriptDeleteError'), { id: loadingToast });
    }
  };

  return (
    <div className="soft-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <div className="pt-0.5">
        <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center space-x-2 text-xl font-bold text-gray-800">
                <Code2 className="h-5 w-5" />
                <span>{t('scripts')}</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-4 w-4 text-orange-500 transition-colors hover:text-orange-600" />
                    </TooltipTrigger>
                    <TooltipContent
                      className="data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 max-w-[400px] border-orange-100 bg-orange-50 text-orange-900 [&>p]:text-orange-800"
                      sideOffset={8}
                    >
                      <p className="p-2 leading-relaxed">{t('scriptsWarning')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h1>
              <h2 className="text-base text-gray-500">{t('scriptsDescription')}</h2>
            </div>
            {selectedView === 'list' && (
              <Button
                onClick={() => {
                  setCurrentScript(null);
                  setSelectedView('edit');
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('addScript')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pt-1">
        {selectedView === 'list' ? (
          <div className="space-y-4">
            {!scripts || scripts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-gray-500">
                <Code2 className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium">{t('noScripts')}</p>
                <p className="mt-1 text-xs text-gray-400">{t('addFirstScript')}</p>
              </div>
            ) : (
              scripts.map((script, index) => (
                <div
                  key={index}
                  className="group rounded-lg border border-gray-200 bg-gray-50/50 p-4 transition-colors duration-150 hover:bg-gray-100/80"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-baseline space-x-2">
                        <h4 className="truncate text-sm font-medium text-gray-800">{script.name}</h4>
                      </div>
                      <pre className="overflow-x-auto rounded border border-gray-200 bg-white/80 p-2 font-mono text-sm text-gray-600">
                        {script.content.length > 100 ? `${script.content.slice(0, 100)}...` : script.content}
                      </pre>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                        onClick={() => {
                          setCurrentScript(script);
                          setSelectedView('edit');
                        }}
                      >
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:bg-red-50 hover:text-red-500"
                        onClick={() => deleteScript(script)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <ScriptFormComponent
            currentScript={currentScript}
            onSuccess={() => {
              setSelectedView('list');
              setCurrentScript(null);
            }}
            onCancel={() => {
              setSelectedView('list');
              setCurrentScript(null);
            }}
            updateOrg={updateOrg}
          />
        )}
      </div>
    </div>
  );
};

const ScriptFormComponent = ({
  currentScript,
  onSuccess,
  onCancel,
  updateOrg,
}: {
  currentScript: Script | null;
  onSuccess: () => void;
  onCancel: () => void;
  updateOrg: (values: Script) => Promise<void>;
}) => {
  const t = useTranslations('DashPage.Other');
  const validationSchema = getValidationSchema(t);

  const form = useForm<ScriptFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: currentScript?.name || '',
      content: currentScript?.content || '',
    },
  });

  const handleSubmit = async (values: ScriptFormData) => {
    await updateOrg(values);
    onSuccess();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('scriptNameLabel')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('scriptNamePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('scriptContentLabel')}</FormLabel>
              <FormControl>
                <Textarea
                  className="font-mono"
                  placeholder={t('scriptContentPlaceholder')}
                  rows={10}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t('saving') : t('saveScript')}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default OrgEditOther;
