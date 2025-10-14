import { useOrg } from '@components/Contexts/OrgContext';

interface UseGetAIFeatures {
  feature: 'editor' | 'activity_ask' | 'course_ask' | 'global_ai_ask';
}

function useGetAIFeatures(_props: UseGetAIFeatures) {
  const org = useOrg() as any;
  return org?.config?.config?.features.ai.enabled || false;
}

export default useGetAIFeatures;
