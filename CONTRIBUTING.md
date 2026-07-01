# Contributing

Thank you for your interest in contributing to **`pacwich`**.

Contributions are welcome. Start with a [discussion](https://github.com/smorsic/pacwich/discussions)
before tackling feature additions, refactors, or otherwise
large, complex, or disruptive changes.

New contributors are encouraged to start with smaller changes,
which are more likely to be accepted. This can help build
trust before tackling larger changes.

Well-suited initial contributions include:

- Bug fixes
- Documentation corrections or clarifications
- Small, focused improvements

If you have larger ideas than the suggested contributions above,
consider heading to our [discussions](https://github.com/smorsic/pacwich/discussions)
to see if others have posted similar ideas or to get feedback first.

The project is actively developed with a clear [roadmap](https://pacwich.dev/roadmap).

Dependency chore updates will **not** be accepted,
as the project already employs automation for this,
and upgrades are at maintainer's discretion.

## Getting Started

Run `bun install` at the repo root. You can run `mise install`
afterwards to install dev tool versions (Bun, node, pnpm, etc.).

After install you should have an AGENTS.md file, which is the
same as the user-facing AGENTS.md that shipped with the package,
plus development guidelines for an agent.

The codebase employs a some consistency in its patterns that
contributions are expected to match. You might also review
[the same document](./md/ai/context/_development.md)
of development guidelines used for agents.

Some local commands you may run first to help with checks:

- `bun format` - run Prettier
- `bun type-check` - TypeScript compiler check
- `bun lint` - lint the project
- `bun pw test` - run tests for the pacwich package
- `bun pw test -- myTestPattern` - run tests with vitest args
- `bun pw build` - create the `dist/` build
- `bun pw test:build` - run tests in the build

```text
·································
········.=###@@@@@@###=.·········
······=#@@@@@@@@@@@@@@@@#=·······
····=%@@@@@@@%****%@@@@@@@%=·····
··-%@@@@@@@*#%@%%@%#*@@@@@@@%-···
·-@@@@@@@*#@@*=++=*@@#*@@@@@@%-··
.*@@@@@@@+@@+=···*·+@@+@@@@@@@@.·
:*@@@@@@@=@@#·*···=#@@=@@@@@@@#:·
.=*@@@@@@@*#@@=++=@@#*@@@@@@@%=.·
·.--#%@@@@@@*######*@@@@@@@%*-.··
··$+--=**#%@@@@@@@@@@@@##*=-+%···
.@-%%*=-===----------===-=*%%-@··
:=.=###%+=:-=++++++=-:=+#%##=.=:·
·#-=:....:+-%@@@@@@%-+:....:+-*··
·:*+++++++-.=######=.-+++++++*:··
···-*%@@@@@-+:....:+-@@@@@#*-····
······=*##@@*++++++*@%#*+=·······
········:-=##@@@@@@##=-:·········
·····················_·····_·····
···___·___·___·_·_·_|_|___|·|_···
··|·.·|·.'|··_|·|·|·|·|··_|···|··
··|··_|__,|___|_____|_|___|_|_|··
··|_|····························
·································
```
