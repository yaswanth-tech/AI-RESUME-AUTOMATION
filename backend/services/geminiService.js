/**
 * Compatibility stub for routes that were removed from the active server mounts.
 * LLM calls must use the task-specific, schema-validated aiProviderService.
 */
function disabledLegacyCall() {
  return Promise.reject(new Error('This legacy free-form AI route is disabled. Use the schema-validated AI service task API.'));
}

module.exports = {
  generateJSON: disabledLegacyCall,
  generateText: disabledLegacyCall
};
