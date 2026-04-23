import { loadContext, saveProfile, saveProviders } from "../lib/storage.js";
import { printSuccess } from "../lib/ui.js";

const PROFILE_KEYS = new Set([
  "brandName",
  "voice",
  "defaultPlatform",
  "defaultNiche",
  "defaultAudience",
  "aiProvider",
  "aiModel",
  "defaultVoice"
]);

export async function runProfile(positionals, options) {
  const [subcommand = "show", key, ...valueParts] = positionals;
  const context = await loadContext();

  if (subcommand === "show") {
    printSuccess(JSON.stringify({ profile: context.profile, providers: context.providers }, null, 2));
    return;
  }

  if (subcommand === "set") {
    const value = valueParts.join(" ").trim();
    if (!PROFILE_KEYS.has(key)) {
      throw new Error(`Unsupported profile key: ${key}`);
    }
    if (!value) {
      throw new Error("profile set requires a value");
    }

    context.profile[key] = value;
    if (key === "aiProvider") {
      context.providers.defaultProvider = value;
      const nextProvider = context.providers.providers[value];
      if (nextProvider && (!context.profile.aiModel || context.profile.aiModel === "creator-local-v1")) {
        context.profile.aiModel = nextProvider.model;
      }
    }
    if (key === "aiModel" && context.providers.providers[context.profile.aiProvider]) {
      context.providers.providers[context.profile.aiProvider].model = value;
    }

    await saveProfile(context.profile);
    await saveProviders(context.providers);
    printSuccess(`Profile updated: ${key} = ${value}`);
    return;
  }

  if (subcommand === "provider") {
    const [name = context.profile.aiProvider] = key ? [key] : [];
    const provider = context.providers.providers[name];
    if (!provider) {
      throw new Error(`Unknown provider: ${name}`);
    }

    const wasEnabled = provider.enabled;
    if (options.enable) provider.enabled = true;
    if (options.disable) provider.enabled = false;
    if (options.model) provider.model = options.model;
    if (options.baseUrl) provider.baseUrl = options.baseUrl;
    if (options.apiKeyEnv) provider.apiKeyEnv = options.apiKeyEnv;

    if (options.enable || options.disable || options.model || options.baseUrl || options.apiKeyEnv) {
      // Auto-switch to this provider if it was just enabled
      if (options.enable && !wasEnabled) {
        context.providers.defaultProvider = name;
        context.profile.aiProvider = name;
        context.profile.aiModel = provider.model;
      }

      await saveProviders(context.providers);
      await saveProfile(context.profile);

      const switchMsg = options.enable && !wasEnabled ? ` (now default)` : "";
      printSuccess(`Provider updated: ${name}${switchMsg}`);
      return;
    }

    printSuccess(JSON.stringify(provider, null, 2));
    return;
  }

  throw new Error(`Unknown profile subcommand: ${subcommand}`);
}
