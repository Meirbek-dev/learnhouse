interface UseGetAIFeatures {
  feature: 'editor' | 'activity_ask' | 'course_ask' | 'global_ai_ask';
}

// TODO: It's no longer needed. Remove it fully
function useGetAIFeatures(_props: UseGetAIFeatures) {
  return true;
}

export default useGetAIFeatures;
