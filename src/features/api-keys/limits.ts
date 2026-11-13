/**
 * The most a key's name can hold. The server (`createApiKeySchema`) and the
 * dialog that makes the key both read it from here, so that the field stops where
 * the server does and the two cannot drift apart. Nothing else is in this module,
 * and it imports nothing: the action and the dialog can both import it.
 */
export const KEY_NAME_MAX = 100;
