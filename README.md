# MySanguoshaWorkspace

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

Use `npm start` rather than plain `ng serve`. Edits to app, engine and content
code, card data and asset files rebuild and reload the page on their own. The
Angular dev server reads `angular.json`, the `tsconfig` files and
`package.json` only when it starts, so `npm start` watches those files too and
restarts the dev server when one changes ([scripts/dev-server.mjs](scripts/dev-server.mjs)).
Extra options pass through, e.g. `npm start -- --port 4300`.

`npm start` also runs the API server (`npm run server`) on port 3000, which the
dev server proxies `/api` to, so sign-in, rooms and online play work. The API
reads `.env` when it exists: copy [.env.example](.env.example) to `.env` to use
Postgres (`docker compose up -d` starts it on port 5433); without it, the API
keeps everything in memory and forgets it on restart. If the API stops (for
example, port 3000 is taken) the dev server keeps running and says so. Use
`npm run web` to run the dev server alone.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Jest](https://jestjs.io/) test runner, use the following command:

```bash
npm test
```

This runs every project's suite (`engine`, `content`, `sim`) via the root
`jest.config.js`. There is no `ng test` architect target in this workspace.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
