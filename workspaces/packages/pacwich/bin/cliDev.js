#!/usr/bin/env bun
import { delegateToLocalPacwichIfPresent } from "../src/cli/localDelegation.ts";
delegateToLocalPacwichIfPresent();
const { createCli } = await import("pacwich_local/cli");
createCli().run();
