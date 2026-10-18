import { isCloudConfigured } from "../supabaseClient";
import { localStore } from "./localStore";
import { supabaseStore } from "./supabaseStore";
import type { Store } from "./types";

/** Cloud (accounts + shared albums) when Supabase is configured, otherwise this-browser-only. */
export const store: Store = isCloudConfigured ? supabaseStore : localStore;
export type { Store } from "./types";
