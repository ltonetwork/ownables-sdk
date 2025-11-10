# Junie Project Guidelines — Ownables SDK (React)

These guidelines tell Junie how to work in this repository: what the project contains, which commands to use, when to run tests and builds, what environment variables are needed, and the expected code style.

## Overview
- Type: React + TypeScript app created with Create React App, customized with CRACO.
- Purpose: SDK wallet/UI and tooling to develop and test LTO Ownables (CosmWasm smart-contract packages running in browser or LTO private layer).
- Node version: Prefer Node 20 (see README note on compatibility).

## Project Structure
Top-level items you’ll most often interact with:
- src/ — React app source (TypeScript, components, services). Primary place for UI and app logic changes.
- public/ — Static public assets for CRA.
- ownables/ — Example Ownable packages (Rust/wasm or static); built and imported in the wallet for testing.
- bin/ — Helper scripts (e.g., packaging/cid tools).
- craco.config.js — CRA configuration overrides.
- ownable-js.webpack.js — Webpack config used by build:ownable.js step before dev/prod builds.
- tsconfig.json — TypeScript configuration (strict mode enabled).
- README.md — Developer quickstart and environment docs.

## Environment Variables
Create a .env in project root (or use your existing one). Common vars used by the app:
- REACT_APP_LTO_API_URL
- REACT_APP_LTO_NETWORK_ID
- REACT_APP_LTO_EXPLORER_URL
- REACT_APP_LTO_WALLET_URL
- REACT_APP_RELAY
- REACT_APP_SECURE_KEY
- REACT_APP_OBUILDER
- REACT_APP_OBUILDER_API_SECRET_KEY
- REACT_APP_WALLETCONNECT_PROJECT_ID
Notes:
- CRA requires REACT_APP_ prefix to expose vars to the browser.
- If you change .env while the dev server runs, you may need to restart npm start.

## Tooling and Commands
Defined in package.json (via CRACO):
- Install: npm i
- Initialize Rust toolchain (optional, for ownables): npm run rustup
- Build all ownables (optional, if you need the example packages): npm run ownables:build-all
- Build a specific ownable: npm run ownables:build --package=<name>
- Clean ownables artifacts: npm run ownables:clean
- Dev server: npm start
  - Runs build:ownable.js first, then craco start.
- Tests: npm test
  - Uses craco test (CRA test runner / Jest + Testing Library).
- Production build: npm run build
  - Runs build:ownable.js first, then craco build.

Additional packaging utilities:
- Build ownable.js bundle: npm run build:ownable.js
- Compute CID for a package zip: npm run ownables:cid --package=<name>

## When Junie Should Run Tests and Builds
- Always run tests (npm test) when you modify code in src/ or change logic that may affect UI/behaviour.
  - For quick CI-like verification, exit watch mode after first run if prompted by CRA test runner.
- Run a production build (npm run build) before submitting if you:
  - Touched TypeScript types, build config (craco.config.js, ownable-js.webpack.js), or dependencies.
  - Made changes that could impact bundling, environment variables, or runtime imports.
- Running ownables builds (npm run ownables:build-all) is not required for typical UI changes. Do it if your change relies on updated example ownable packages under ownables/.

## Local Development Flow (Recommended)
1) npm i
2) Ensure Node 20 is used (nvm use 20 if needed).
3) If working with ownables packages: npm run rustup (first time), then npm run ownables:build-all.
4) Create/update .env with the required REACT_APP_* values.
5) npm start and develop against http://localhost:3000.
6) Before commit/PR:
   - npm test
   - npm run build (to catch type/build issues).

## Code Style and Conventions
- Language: TypeScript (strict mode enabled in tsconfig.json).
- Framework: React 18 with function components and hooks.
- UI: MUI v5 (@mui/material, @mui/icons-material). Follow MUI component patterns.
- State and side effects: Prefer React hooks (useState, useEffect, useMemo, etc.).
- Formatting: Keep consistent with existing style; if you use a formatter, match Prettier defaults (2 spaces, semicolons, single quotes acceptable). Do not add new tooling unless requested.
- Linting: Inherits CRA’s eslintConfig (react-app, react-app/jest). Fix warnings surfaced during dev/test/build.
- Imports: Use absolute/relative paths as already used in the codebase; do not introduce custom module aliasing without updating tsconfig and craco accordingly.
- Error handling: Use try/catch around async services (e.g., in src/services/*). Surface user-facing errors with MUI Snackbar/Notistack patterns already present.
- Components: Keep components small, typed with React.FC or explicit props interfaces. Co-locate component-specific styles and tests.

## Testing Guidance
- Stack: Jest + React Testing Library (via CRA). No custom config needed.
- Write tests for logic-heavy hooks/services and critical UI flows.
- Prefer queries by role/label/text over test ids.
- If tests require wallet/ownables context, abstract dependencies to allow mocking.

## Performance and Accessibility
- Prefer memoization (useMemo, useCallback) for expensive render paths.
- Use MUI components with proper aria attributes; ensure interactive elements are reachable and labeled.

## Making Changes Safely
- Keep changes minimal and focused on the issue.
- Do not introduce new dependencies unless necessary; prefer existing stack.
- If editing build config (craco/webpack), verify both npm start and npm run build.
- If touching ownables build scripts, validate with npm run ownables:build --package=<name>.

## Submission Checklist for Junie
- Code compiles: npm run build succeeds.
- Tests pass: npm test succeeds (or relevant suite if narrowed by CRA).
- No unnecessary files added; changes are minimal.
- Update README if you introduce required environment variables or new commands.
- Summarize changes and note any risks or follow-ups.

## Notes
- This is a Create React App project; many configs are convention-based.
- CRACO is used to extend CRA without ejecting—avoid eject unless explicitly required.
- If in doubt about guidelines or missing details, propose updates in this file and ask for confirmation.
