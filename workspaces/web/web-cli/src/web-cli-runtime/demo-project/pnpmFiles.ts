export const PNPM_WORKSPACE_YAML = `packages:
  - apps/my-app-a/frontend-a
  - apps/my-app-a/backend-a
  - apps/my-app-b/shared-a
  - apps/my-app-b/*
  - libraries/frontend-utils
  - libraries/backend-utils
  - libraries/shared-utils

catalog:
  typescript: ^5.7.0
  eslint: ^9.15.0
  typescript-eslint: ^8.15.0

catalogs:
  frontend:
    react: ^18.3.0
    react-dom: ^18.3.0
    "@types/react": ^18.3.0
    "@types/react-dom": ^18.3.0
    "@rsbuild/core": ^1.1.0
    "@rsbuild/plugin-react": ^1.0.0
  backend:
    express: ^4.21.0
    "@types/express": ^4.17.0
  shared:
    zod: ^3.23.0
`;

export const PNPM_LOCK_YAML = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript-eslint:
        specifier: 'catalog:'
        version: 8.65.0(eslint@9.39.5(jiti@2.7.0))(typescript@5.9.3)

  apps/my-app-a/backend-a:
    dependencies:
      '@demo/backend-utils':
        specifier: workspace:*
        version: link:../../../libraries/backend-utils
      '@demo/shared-utils':
        specifier: workspace:*
        version: link:../../../libraries/shared-utils
      express:
        specifier: catalog:backend
        version: 4.22.2
    devDependencies:
      '@types/express':
        specifier: catalog:backend
        version: 4.17.25
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  apps/my-app-a/frontend-a:
    dependencies:
      '@demo/frontend-utils':
        specifier: workspace:*
        version: link:../../../libraries/frontend-utils
      '@demo/shared-utils':
        specifier: workspace:*
        version: link:../../../libraries/shared-utils
      react:
        specifier: catalog:frontend
        version: 18.3.1
      react-dom:
        specifier: catalog:frontend
        version: 18.3.1(react@18.3.1)
    devDependencies:
      '@rsbuild/core':
        specifier: catalog:frontend
        version: 1.7.6
      '@rsbuild/plugin-react':
        specifier: catalog:frontend
        version: 1.4.6(@rsbuild/core@1.7.6)
      '@types/react':
        specifier: catalog:frontend
        version: 18.3.31
      '@types/react-dom':
        specifier: catalog:frontend
        version: 18.3.7(@types/react@18.3.31)
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  apps/my-app-b/backend-b:
    dependencies:
      '@demo/backend-utils':
        specifier: workspace:*
        version: link:../../../libraries/backend-utils
      '@demo/shared-a':
        specifier: workspace:*
        version: link:../shared-a
      '@demo/shared-utils':
        specifier: workspace:*
        version: link:../../../libraries/shared-utils
      express:
        specifier: catalog:backend
        version: 4.22.2
    devDependencies:
      '@types/express':
        specifier: catalog:backend
        version: 4.17.25
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  apps/my-app-b/frontend-b:
    dependencies:
      '@demo/frontend-utils':
        specifier: workspace:*
        version: link:../../../libraries/frontend-utils
      '@demo/shared-a':
        specifier: workspace:*
        version: link:../shared-a
      '@demo/shared-utils':
        specifier: workspace:*
        version: link:../../../libraries/shared-utils
      react:
        specifier: catalog:frontend
        version: 18.3.1
      react-dom:
        specifier: catalog:frontend
        version: 18.3.1(react@18.3.1)
    devDependencies:
      '@rsbuild/core':
        specifier: catalog:frontend
        version: 1.7.6
      '@rsbuild/plugin-react':
        specifier: catalog:frontend
        version: 1.4.6(@rsbuild/core@1.7.6)
      '@types/react':
        specifier: catalog:frontend
        version: 18.3.31
      '@types/react-dom':
        specifier: catalog:frontend
        version: 18.3.7(@types/react@18.3.31)
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  apps/my-app-b/shared-a:
    dependencies:
      '@demo/shared-utils':
        specifier: workspace:*
        version: link:../../../libraries/shared-utils
      zod:
        specifier: catalog:shared
        version: 3.25.76
    devDependencies:
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  libraries/backend-utils:
    devDependencies:
      '@types/express':
        specifier: catalog:backend
        version: 4.17.25
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      express:
        specifier: catalog:backend
        version: 4.22.2
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  libraries/frontend-utils:
    devDependencies:
      '@types/react':
        specifier: catalog:frontend
        version: 18.3.31
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      react:
        specifier: catalog:frontend
        version: 18.3.1
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

  libraries/shared-utils:
    dependencies:
      zod:
        specifier: catalog:shared
        version: 3.25.76
    devDependencies:
      eslint:
        specifier: 'catalog:'
        version: 9.39.5(jiti@2.7.0)
      typescript:
        specifier: 'catalog:'
        version: 5.9.3

packages:

  '@rsbuild/core@1.7.6': {}

  '@rsbuild/plugin-react@1.4.6': {}

  '@types/express@4.17.25': {}

  '@types/react-dom@18.3.7': {}

  '@types/react@18.3.31': {}

  eslint@9.39.5: {}

  express@4.22.2: {}

  react-dom@18.3.1: {}

  react@18.3.1: {}

  typescript-eslint@8.65.0: {}

  typescript@5.9.3: {}

  zod@3.25.76: {}
`;
