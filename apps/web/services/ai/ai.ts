/**
 * @deprecated Import directly from `@services/ai/ai-streaming` instead.
 *
 * This barrel re-exports the non-streaming helpers that have been merged into
 * the unified `ai-streaming` module.  Existing imports pointing here continue
 * to work without modification.
 */
export {
  startActivityAIChatSession,
  sendActivityAIChatMessage,
} from '@services/ai/ai-streaming';
