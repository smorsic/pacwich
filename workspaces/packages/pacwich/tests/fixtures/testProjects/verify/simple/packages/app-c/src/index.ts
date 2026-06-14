import { appCSub } from "app-c/sub"; // self-import: must NOT be flagged
import { libA } from "lib-a";
import { libB as libBValue } from "lib-b";
import type { libB } from "lib-b/sub/path";

export const appC = { libA, libBValue, appCSub };
export type AppCDep = libB;
