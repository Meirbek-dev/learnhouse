import { useOrg } from '@components/Contexts/OrgContext';

interface FeatureType {
  path: string[];
  defaultValue?: boolean;
}

function useFeatureFlag(feature: FeatureType) {
  const org = useOrg() as any;

  if (!org?.config?.config) {
    return Boolean(feature.defaultValue);
  }

  let currentValue = org.config.config;

  // Traverse the path to get the feature flag value
  for (const key of feature.path) {
    if (currentValue && typeof currentValue === 'object') {
      currentValue = currentValue[key];
    } else {
      return Boolean(feature.defaultValue);
    }
  }

  return Boolean(currentValue);
}

export default useFeatureFlag;
