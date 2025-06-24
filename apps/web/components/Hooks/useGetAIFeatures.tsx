import { useCallback, useEffect, useState } from 'react';

import { useOrg } from '@components/Contexts/OrgContext';

interface UseGetAIFeatures {
  feature: 'editor' | 'activity_ask' | 'course_ask' | 'global_ai_ask';
}

function useGetAIFeatures(props: UseGetAIFeatures) {
  const org = useOrg() as any;
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  const checkAvailableAIFeaturesOnOrg = useCallback(
    (_feature: string) => {
      const config = org?.config?.config?.features.ai.enabled;
      return config;
    },
    [org],
  );

  useEffect(() => {
    if (org) {
      // Check if org is not null or undefined
      const isEnabledStatus = checkAvailableAIFeaturesOnOrg(props.feature);
      setIsEnabled(isEnabledStatus);
    }
  }, [org, checkAvailableAIFeaturesOnOrg, props.feature]);

  return isEnabled;
}

export default useGetAIFeatures;
