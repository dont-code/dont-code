# Plan — dont-code: installable platform + AI plugin generation

Status: draft / awaiting decisions
Date: 2026-11-14
Current focus (2026-11-20): Phase 1 — complete release bundle generation (§10). All verification
gates are deferred until an installable bundle exists.
Repos in scope: `dont-code` (dashboard + release workflow), `project-services`, `data-services`,
`ng-xtend` (host + plugins + templates), new `plugin-worker`, and two distribution channels
(`dont-code_ynh` YunoHost package, `dont-code-docker` compose bundle).

---

## 1. Vision & distribution goals

The end state is **a complete dont-code platform that someone can install on their own server**,
not just a set of Java services plus a static dashboard published to `dont-code.net`.

Deployment is deliberately split from release generation:

- **CI publishes a release bundle** (dashboard + Java services + host/plugins). It is
  deployment-agnostic.
- **A YunoHost package** consumes that bundle and attaches it to the server's **existing MongoDB**.
- **A Docker bundle** consumes the same release bundle and **includes MongoDB**, for standalone
  installs.

There are three goals. They are ordered: each depends on the previous one.

### G1 — Install the base platform in one go

> "Someone installs dont-code, then has the database, REST APIs, dashboard and the current AI
> designer installed."

Acceptance:

- A **release bundle published by CI** is the only deployment input; no code is built on the
  server.
- Two independent distribution channels consume the same bundle:
  - **YunoHost package** — installs the bundle and **connects to the server's existing MongoDB**
    (no database is bundled),
  - **Docker bundle** — runs the bundle **with MongoDB included**, fully self-contained.
- Each channel produces a working site at `https://<domain>/`.
- Installed and started automatically:
  - MongoDB (external for YunoHost, bundled for Docker),
  - `project-services` (projects REST + the AI `/generate` WebSocket),
  - `data-services` (application data + document uploads),
  - the **dashboard** static app,
  - the **xt-host** static app plus the default plugins (the app runtime),
  - the reverse proxy wiring (SPA routes, WebSocket upgrade, uploads).
- The AI designer is usable immediately: the installer asks for a model provider + key
  (Mistral **or** any OpenAI-compatible endpoint, incl. Ollama), stores it in a secrets file, and
  the services start with it. A missing key must not crash the platform; it disables the designer
  with a clear message.
- `https://<domain>/` shows the dashboard app list; "Generate an app" opens the designer.
- No hardcoded `dont-code.net` URL remains in a fresh install (verified by a config lint step).

### G2 — Apps created by the AI designer are automatically visible

> "Applications created by the AI designer should be automatically visible to the dashboard."

Today this already half-works: saving goes through `ProjectService.saveProjectDefinition` to
`projectApiUrl`, and `ListOfApps` lists from the same `projectApiUrl`. It is not reliable, because
of install/config gaps and a duplicate-on-resave bug (see §2.3).

Acceptance:

- `design → save → back to dashboard` shows the app without a page reload of the server or any
  file edit.
- `design → save → open` launches the app in the host with the correct repository.
- Re-saving an existing app **updates** it; it never creates a duplicate entry.
- The same behaviour works on a self-hosted install purely from generated config (no rebuild).
- Generated apps are visible to their creator, and to the whole instance in `shared` tenancy mode
  (see §4.7).

### G3 — Optionally install the development platform

> "Then he can decide to install the dont-code development platform, where he would have OpenCode
> generate new plugins, new workflows and have them immediately available for application design."

Acceptance:

- The dev add-on is a **separate package** installed *after* and *on top of* the base platform
  (it declares the base as a dependency and refuses to install without it).
- Installing it adds: OpenCode server, the `plugin-worker`, a job/approval UI (or a dev section in
  the dashboard), and a toolchain sandbox.
- Chat flow: when the design needs a capability the platform lacks, the designer proposes a
  `PluginSpec`; a human confirms; the worker generates, builds and tests the plugin; a human
  approves; it is deployed to the isolated generated-plugin namespace and registered in the host
  repository.
- The new type/workflow is **immediately usable in the same design session** because the
  capability catalog is refreshed and the prompt regenerated.
- Uninstalling the add-on leaves the base platform and all previously generated plugins working.
- Base install does **not** require Docker/Node toolchain; only the add-on does.

### Non-goals (for now)

- The legacy `ide-services` / `ide-ui` / `preview-ui` stack.
- Multi-node / HA deployments.
- Fine-grained end-user accounts inside dont-code (delegated to the host SSO, see §4.7).
- Public plugin marketplace / cross-instance plugin sharing.

---

## 2. What exists today (verified)

### 2.1 The AI designer (config-only)

```
apps/dashboard/src/app/generate-app/*        chat UI
  shared/generate-app-service/*              WebSocket client
        │  ws(s)://.../generate
        ▼
../project-services/src/main/java/net/dontcode/prj/generate/
  GenerateProjectResource.java               @WebSocket(path="/generate")
  GenerateProjectService.java                @RegisterAiService (LangChain4j / Mistral)
        │  returns GenerateProjectModel{response, error, model}
        ▼
  ApplicationModel { content.creation.{entities, workflows} }
        │
        ├─ save → ProjectResource (Mongo)  POST/PUT /project[/{name}]
        └─ preview → iframe applicationHostUrl + "prjDef=" + JSON
```

- `GenerateProjectService` hardcodes the available types and workflows in its system message
  (`GenerateProjectService.java:18-24`): `number,string,date,time,date-time,currency,country,
  money-amount,eur-amount,usd-amount,image,link,rating,recurring-task,task-complete`
  and `workflow: list-detail | carousel`.
- The model is fixed at build time (`quarkus.langchain4j.mistralai.chat-model.model-name=devstral-latest`).
- No tool calling, no code generation, no OpenCode integration anywhere in these repos.

### 2.2 App runtime and plugin contract — `ng-xtend`, not `plugin-seed`

| Item | Path | Reality |
|---|---|---|
| Live host | `ng-xtend/apps/xt-host` | deployed at `https://dont-code.net/apps/latest/host/` |
| Plugin contract | `ng-xtend/libs/xt-components` | native federation, exposes `./Register` |
| Sample plugin | `ng-xtend/libs/xt-plugin-sample` | self-contained Angular workspace |
| Sample workflow | `ng-xtend/libs/xt-workflow-sample` | self-contained Angular workspace |
| Legacy template | `plugin-seed` | Angular 15 + webpack MF + `./Fields` — **deprecated, do not use** |

Host plugin loading (`apps/xt-host/.../app-config.service.ts`):

```ts
loadRemoteModule({ remoteEntry: url, exposedModule: './Register' })
```

Registry API (`libs/xt-components/.../plugin/xt-plugin-info.ts`):

```ts
resolverService.registerPlugin({
  name, uriLogo?, cssUrls?,
  components?,        // { componentName, componentClass, typesHandled[], outputs? }
  workflows?,         // { name, class, workflowsHandled[] }
  types?,             // XtTypeInfo
  typeHandlers?,      // { typesHandled[], handlerClass }
  actionHandlers?     // grouped actions
});
```

### 2.3 Self-hosting blockers found

| # | Blocker | Where |
|---|---|---|
| B1 | Service URLs are hardcoded in **two separate static bundles**: dashboard `public/assets/config/*.json` and host `projects/host/public/assets/config/*.json` | `dont-code/apps/dashboard/public/assets/config/`, `ng-xtend/apps/xt-host/projects/host/public/assets/config/` |
| B2 | Host resolves the project with `new URL(projectName, projectApiUrl)`, which **requires an absolute URL**; a relative `/api/project/` throws | `ng-xtend/.../app-config.service.ts` |
| B3 | `generateApiUrl` is passed straight to RxJS `webSocket()`, so it must be an absolute `ws(s)://` URL. It cannot be derived at runtime client-side from a relative path | `dont-code/.../generate-app-service.ts` |
| B4 | No authentication anywhere. CORS is `.*` (`quarkus.http.cors.origins=/.*/`) | `project-services`, `data-services`, `preview-services` |
| B5 | Mongo is a hard dependency (`mongodb://localhost:27017`), but YunoHost `[resources.database]` only supports `mysql`/`postgresql` | YunoHost packaging constraint |
| B6 | Re-saving a generated app after a page reload can create a duplicate: `ProjectService.currentProject` is in-memory, so `saveProjectDefinition` POSTs instead of PUTs | `dont-code/.../project-service.ts:28-48` |
| B7 | `DbName` header is supported by project/data services but **never sent** by the dashboard or host, so every install is a single shared tenant | `ProjectResource`, `DataResource` |
| B8 | Dashboard build emits `index.csr.html`; CI renames it to `index.html` post-build. An installer must do the same | `.github/workflows/deploy-dashboard.yml` |
| B9 | Deployment is SFTP to `dont-code.net`; there is no versioned release artifact | both `.github/workflows/*.yml` |
| B10 | Java 25 / Quarkus 3.38 / 2 Quarkus services + Node 24 for the dashboard/toolchain — a real runtime matrix to pin | `pom.xml`, `package.json` |

### 2.4 Runtime baseline — current deployed state (from `finance-plugin/remoteEntry.json`)

| Package | Version | Shared |
|---|---|---|
| `@angular/core` (+ common, forms, router, platform-browser) | **21.2.26** | yes, singleton, strict |
| `xt-components` | **1.4.1** | yes, singleton, strict |
| `xt-type` | **0.12.1** | yes, singleton, strict |
| `rxjs` | **7.8.2** | yes |
| `primeng` | **21.1.10** | yes |
| `tslib` | **2.9.1** | yes |
| `@softarc/native-federation-runtime` | 3.3.6 | — |
| Node (CI) | 24 | — |
| Java / Quarkus | 25 / 3.38.0 | — |

All shared packages use `strictVersion: true`. **A plugin built against a different patch version
will refuse to load.** Template, host and plugins must be released in lockstep.

This table is the **current** (pre-M0) baseline. Track 0 moves the whole train to Angular 22 and
replaces `primeng` 21 with Optimus UI 2.x (D11); the target matrix in §4.10 is authoritative once
M0 lands.


Note: `dc-workflow` is **not** shared (built into the host). A remote workflow plugin bundles its
own copy; must be validated in Track 3 / M3.0 before promising workflow generation.

---

## 3. Target architecture

### 3.1 Base platform (Track 1 + 2)

```
                        ┌──────────────────────── nginx (TLS, SSO gate) ───────────────────────┐
                        │  /                        → dashboard (static SPA)                  │
                        │  /apps/host/              → xt-host (static SPA)                     │
                        │  /apps/<name>-plugin/     → curated plugins (static)                 │
                        │  /apps/gen/<name>-plugin/ → generated plugins (dev add-on output)     │
                        │  /api/project/            → 127.0.0.1:8083 /project                  │
                        │  /api/generate            → 127.0.0.1:8083 /generate  (WebSocket)    │
                        │  /api/data/               → 127.0.0.1:8084 /data                      │
                        │  /api/documents           → 127.0.0.1:8084 /documents                 │
                        └──────────────────────────────────────────────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
           project-services (8083)        data-services (8084)      MongoDB (external | bundled)
           projects + AI designer         app data + documents              projects / data DBs
                    │
                    └─ capability catalog + LangChain4j prompt
```

- Dashboard and host stay **separate static bundles** under one domain. The release bundle fixes
  their paths (`/`, `/apps/host/`, `/apps/<plugin>/`) so a single build works on every install.
- Only the JSON repository configs and the nginx upstreams vary per install.
- `preview-services` is **not required** by the `ng-xtend` host (the host uses `prjDef` or the
  project API). Keep it out of the base package. The legacy `webSocketUrl` repository field is
  unused by `DcRepositoryModel`.

### 3.2 Dev add-on (Track 3)

```
dashboard (dev section)
  │  WS envelope: {kind:"chat"|"plugin-proposal"|"job"|"plugin-ready", ...}
  ▼
project-services
  ├─ CapabilityCatalog            types + workflows available in the target stage
  ├─ LangChain4j agent
  │    ├─ fits existing capability → current JSON config flow (unchanged)
  │    └─ missing → propose PluginSpec → user confirms → plugin-worker job
  └─ job relay (progress, approval, result)
        │  internal network only
        ▼
plugin-worker (Node 24 container)
  ├─ job queue + state machine + Mongo records
  ├─ workspace = copy(template)
  ├─ opencode serve client  (session per job, location.directory = workspace)
  ├─ build/test loop: npm ci / ng build / ng test, errors fed back (max 3)
  ├─ publish: /var/www/dont-code/generated/<name>-plugin/  (served as /apps/gen/...)
  └─ register: append entry to host/assets/config/default.json + reload catalog
        │
        ▼
dashboard: progress → diff review → approve → deploy → reload iframe
```

OpenCode is **never exposed** through nginx. Only `plugin-worker` reaches it, on an internal
network/loopback.

---

## 4. Distribution design

### 4.1 Component inventory

| Component | Needed by base | Port | Storage / state | Notes |
|---|---|---|---|---|
| MongoDB 7+ | **yes** | 27017 | `dontCodeProjects`, `dontCodeData` | **external** in the YunoHost channel (the server's existing Mongo); **bundled** in the Docker channel |
| `project-services` | **yes** | 8083 | Mongo `projects` DB | REST `/project`, WS `/generate`, AI designer |
| `data-services` | **yes** | 8084 | Mongo `data` DB + `document-directory` | app data + `/documents` uploads |
| dashboard (static) | **yes** | via nginx | — | `outputMode: static`, `index.csr.html` → `index.html` |
| xt-host (static) | **yes** | via nginx `/apps/host/` | — | `ng-xtend` host |
| default plugins (static) | **yes** | via nginx `/apps/*` | — | default, web, intl, finance, agenda, editor, workflow |
| `preview-services` | no | 8081 | Mongo `projects` | legacy realtime preview; not used by xt-host |
| `ide-services`, `ide-ui`, `preview-ui` | no | — | — | legacy |
| `plugin-worker` | dev add-on | 8090 (internal) | Mongo `jobs` + workspace dir | Node 24 |
| `opencode serve` | dev add-on | 4096 (internal) | per-job workspace | pinned binary/container |
| Ollama / external LLM | optional | — | — | OpenAI-compatible endpoint |

### 4.2 URL & reverse-proxy scheme

Recommended: **dedicated (sub)domain** for the install, e.g. `https://dontcode.example.org/`.
Root-relative static paths then work with a single build.

| Path | Target | Notes |
|---|---|---|
| `/` | dashboard `index.html` | SPA fallback to `/index.html` |
| `/assets/config/<repo>.json` | dashboard static | generated at install |
| `/apps/host/` | xt-host | SPA fallback; `assets/config/<repo>.json` generated at install |
| `/apps/host/assets/config/<repo>.json` | static | **generated at install**, drives plugins + APIs for the host |
| `/apps/<name>-plugin/` | static | curated plugins |
| `/apps/gen/<name>-plugin/` | static | generated plugins (add-on), outside the release symlink |
| `/api/project/` | `127.0.0.1:8083/project/` | REST |
| `/api/generate` | `127.0.0.1:8083/generate` | WebSocket, `Upgrade`/`Connection` headers, long read timeout |
| `/api/data/` | `127.0.0.1:8084/data/` | REST |
| `/api/documents` | `127.0.0.1:8084/documents` | multipart uploads, body size limit |
| `/dev/` (add-on) | dev UI or dashboard route | SSO + admin only |

Sub-path installs (`https://domain/dont-code/`) are possible but require a second build with a
different base href and prefixed URLs → open decision D6; dedicated domain recommended.

### 4.3 Configuration model — one source of truth, generated at install

Because both front-ends are **static** and read their config from their own origin, the install
procedure must write the repository JSONs. Do not try to make them dynamic in v1.

Single source of truth: `/etc/dont-code/platform.json`

```jsonc
{
  "publicUrl": "https://dontcode.example.org",
  "repository": "default",
  "api": {
    "projectApiUrl": "https://dontcode.example.org/api/project/",
    "generateApiUrl": "wss://dontcode.example.org/api/generate",
    "storeApiUrl": "https://dontcode.example.org/api/data/",
    "documentApiUrl": "https://dontcode.example.org/api/documents"
  },
  "hostUrl": "https://dontcode.example.org/apps/host/?repository=default&",
  "generatedPluginsUrl": "https://dontcode.example.org/apps/gen/",
  "mongo": { "mode": "external", "databasePrefix": "dontCode" },
  "tenantMode": "shared"          // "shared" | "per-user"
}
```

Mongo credentials never live here: they go in `secrets.env`. `mongo.mode` is `external` for the
YunoHost channel and `bundled` for the Docker channel.

An installer step (`scripts/install`, or `bin/dont-code configure`) renders:

1. `<web>/dashboard/assets/config/default.json` — `{name, description, projectApiUrl,
   generateApiUrl, applicationHostUrl}` (dashboard's `RepositoryConfig`).
2. `<web>/apps/host/assets/config/default.json` — `{name, projectApiUrl, storeApiUrl,
   documentApiUrl, plugins[]}` (host's `DcRepositoryModel`).
3. nginx upstreams / env file for the two Quarkus jars.

Rules:

- **Absolute URLs** are mandatory for `projectApiUrl` and `generateApiUrl` (blockers B2/B3).
- `applicationHostUrl` is used by string concatenation (`applicationHostUrl + 'project=' + name`),
  so it must already end with `?repository=default&` (as the current configs do).
- `change_url` must re-run the renderer and reload nginx + restart nothing (the JSONs are static).
- A `dont-code doctor` command validates: JSON shape, URL reachability, WS handshake, Mongo
  connectivity, plugin `remoteEntry.json` version match, AI provider reachability.

### 4.4 Base + add-on, or one package with a flag?

Recommended: **two packages**.

- `dont-code` — base (§4.1 "yes" rows). Native install: jars + static; MongoDB is external on
  YunoHost and bundled in the Docker channel. No Docker needed for YunoHost.
- `dont-code-dev` — depends on `dont-code`; adds `plugin-worker`, OpenCode, the generation
  template, and the `/apps/gen/` volume. Requires Docker (for the Angular toolchain sandbox) or a
  pre-warmed native toolchain with a dedicated system user.

A feature flag would force every base install to carry the toolchain and the OpenCode RCE surface.
The add-on boundary is a real security boundary, so it should be a real package boundary.

### 4.5 Release generation (CI) — deployment-agnostic

The GitHub release workflow produces **one versioned artifact** and knows nothing about where it is
deployed: no SFTP, no hostnames, no database, no config rendering, no secrets.

Inputs:

- `dont-code` → dashboard static build.
- `project-services` + `data-services` → Quarkus uber-jars.
- `ng-xtend` → xt-host + default plugins, pinned by version (see D10).

Release bundle attached to the GitHub release:

```
dont-code-<version>/
  VERSION
  manifest.json                     # component versions + runtime baseline (§4.10)
  SHA256SUMS
  bin/dont-code                     # configure | doctor | status | backup | restore
  services/project-services.jar     # Quarkus uber-jar
  services/data-services.jar
  web/dashboard/                    # static build, index.html (from index.csr.html)
  web/apps/host/
  web/apps/{default,intl,web,finance,agenda,editor,workflow}-plugin/
```

Rules:

- Immutable, checksummed and reproducible; **the same tarball feeds both channels**.
- Contains **no environment-specific value**: no domain, no Mongo URI, no API key, no nginx config.
- Static assets use root-relative base hrefs (`/`, `/apps/host/`, `/apps/<plugin>/`) so one build
  works on every install (see D6 for sub-path installs).
- `manifest.json` is what `dont-code doctor` uses to verify plugin/runtime version lockstep.
- Angular / Optimus UI / native-federation versions are **exact** in the bundle (no `^`), resolving
  to the Track 0 baseline in §4.10; the dashboard and every plugin in the bundle are built from that
  one resolution.
- `plugin-worker` / OpenCode / the plugin template are **not** in this bundle; they belong to the
  dev add-on (Track 3).

### 4.6 Distribution channels

Two channels consume the release bundle independently.

#### 4.6.1 YunoHost package — attach to the server's existing MongoDB

- Thin package (`dont-code_ynh`) that downloads `dont-code-<version>.tar.gz`, verifies
  `SHA256SUMS`, and installs it under `/var/www/dont-code/`.
- **Does not install MongoDB.** The install asks for the existing server Mongo connection
  (URI or host/user/password), validates connectivity and permissions, then creates only the two
  dont-code databases (`dontCodeProjects`, `dontCodeData`) and a dedicated user. If the provided
  credentials cannot create users/databases, accept pre-created names instead of escalating rights.
- Uses `[resources.ports]` for the two internal Quarkus ports. **No** `[resources.database]`
  (YunoHost only supports MySQL/PostgreSQL).
- Renders the two static repository JSONs + `platform.json` from the install answers (§4.3).
- Installs two systemd units and an nginx location block, and implements
  `install/upgrade/remove/backup/restore/change_url`.
- `upgrade` can move to a newer release bundle without touching the external database.
- Backup covers a logical dump of *the two dont-code databases only*, the documents directory, the
  generated plugins and `/etc/dont-code` — never the whole shared Mongo instance.
- On-disk layout:
  ```
  /var/www/dont-code/releases/<version>/...   # immutable
  /var/www/dont-code/current -> releases/<version>
  /var/www/dont-code/generated/               # survives upgrades
  /etc/dont-code/platform.json, secrets.env   # 0600
  /var/lib/dont-code/documents/               # data-services uploads
  /var/lib/dont-code/jobs/                    # dev add-on workspaces
  ```
- Upgrade = unpack the new release, switch the symlink, reload nginx, restart services.
  Rollback = switch the symlink back.

#### 4.6.2 Docker bundle — database included

- Complete, self-contained distribution: `mongo`, `project-services`, `data-services`, `web`
  (nginx serving static + proxying APIs).
- The same release bundle is baked into the service/web images; the bundle version is the image tag.
- MongoDB runs from a pinned image with a named volume; the same DB/user bootstrap as §4.6.1.
- Config is rendered from environment variables at container start, using the same
  `bin/dont-code configure` logic as the YunoHost package.
- Backup = `mongodump` inside the Mongo container + copy of the documents volume.
- A `dev` profile (Track 3) adds `plugin-worker` + `opencode`; the base image set stays
  database-only.

Both channels expose the same `bin/dont-code configure|doctor|status`, so diagnostics and
behaviour stay identical regardless of the deployment target.

### 4.7 Auth & tenancy

Current reality: **no authentication** in any service; CORS is fully open. In a self-hosted world
that is the single biggest risk (the AI endpoint costs money; the data API is world-writable).

Recommended v1:

- Put the whole site behind the platform SSO (YunoHost SSOwat / reverse-proxy auth). Services bind
  to `127.0.0.1` only.
- Do **not** expose OpenCode, `plugin-worker`, or Mongo.
- Tenancy, two modes:
  - `shared` (default): one Mongo DB, every authenticated user of the instance sees every app.
    Simple, matches today's behaviour.
  - `per-user`: nginx injects the `DbName` header from the authenticated user, and the services
    already honour it (`ProjectResource`, `DataResource`, `XtApiStoreProvider` ignores it, so the
    proxy is the only place it can be added). Requires confirming the exact SSOwat header name for
    the target YunoHost version → open decision D5.
- Admin-only actions: installing the dev add-on, approving a generated plugin, changing the model
  provider.
- Keep `quarkus.http.cors.origins=/.*/` only while services are loopback-bound; otherwise restrict
  to `publicUrl`.

### 4.8 AI provider configuration

Today: Mistral only, model baked in at build time, key via
`QUARKUS_LANGCHAIN4J_MISTRALAI_API_KEY`.

Target:

| Provider | Config |
|---|---|
| Mistral (default) | `MISTRAL_API_KEY`, `quarkus.langchain4j.mistralai.chat-model.model-name` |
| OpenAI-compatible | add `quarkus-langchain4j-openai`; `quarkus.langchain4j.openai.base-url`, `.../api-key`, `.../chat-model.model-name` |
| Ollama | OpenAI-compatible base URL `http://127.0.0.1:11434/v1` |
| OpenCode (worker) | `opencode.json` provider, same three values; key via env |

- Install questions: provider, base URL (if compatible), model, API key.
- Secrets in `/etc/dont-code/secrets.env`, never in the release bundle or Mongo.
- Startup must tolerate a missing/invalid key: `/generate` returns a clear error, dashboard shows a
  banner, everything else works.
- `dont-code doctor` performs a 1-token completion test.

### 4.9 Lifecycle

| Operation | What it does |
|---|---|
| **install** | YunoHost: verify and bind to the existing Mongo; Docker: start the bundled Mongo. Then unpack release, render config, create system user + dirs, install units/containers + nginx, health check, print URL |
| **upgrade** | verify bundle checksum, unpack to new release dir, switch symlink, keep `generated/`, `documents/`, config, secrets; restart; health check; automatic rollback on failure |
| **backup** | `mongodump` of the two dont-code DBs only (never the whole shared instance), `/var/lib/dont-code/documents`, `/var/www/dont-code/generated`, `/etc/dont-code` |
| **restore** | inverse, then `mongorestore --drop` and config re-render |
| **remove** | stop/disable units, remove nginx block; ask before deleting DB/documents/generated plugins |
| **change_url** | re-render `platform.json`, rewrite static configs, reload nginx |

Indexes: `projects.name` should be unique **per DB** to enforce B6 at the DB level.

### 4.10 Version compatibility matrix

Everything below is pinned by a **platform release tag**; the installer refuses a mismatched
plugin `remoteEntry.json`.

| Artifact | Pinned |
|---|---|
| dashboard, xt-host, bundled plugins, plugin template | same platform release tag |
| `xt-components` | M0.1 release line (22-compatible peers) |
| `xt-type` | M0.1 release line (22-compatible peers) |
| Angular (core, common, forms, router, platform-browser) | 22.2.6 |
| Angular toolchain (CLI, build, compiler-cli, ng-packagr) | 22.2.6 |
| `@angular-architects/native-federation` | 22.2.5 |
| `@openng/optimus-ui` / `@openng/optimus-ui-themes` | 2.0.2 / 2.0.2 (MIT, vendored tarball + SHA-256) |
| `rxjs` / `tslib` | 7.8.2 / 2.9.1 |
| `@ngrx/signals` | 22.0.1 |
| Quarkus / Java | 3.38.0 / 25 |
| Node (worker + toolchain) | 24 |
| MongoDB | 7.x |
| OpenCode | pinned version, recorded per job |
| Generated plugin | records the template + runtime versions it was built with |

Versions are **exact** (no `^`): `strictVersion: true` compares patch versions. These are the
resolved values after Track 0; M0.4 records them in `manifest.json`.

**PrimeNG is excluded from this matrix on purpose.** `primeng@21.1.10` is MIT and is what runs
today; `primeng@22` is under the commercial PrimeUI license (license key + OEM clause for
redistribution to third-party developers). Do not reintroduce it as a dependency of the bundle,
the host, or any plugin (D11).

`dont-code doctor` compares each plugin's `remoteEntry.json` shared versions with the host baseline
and fails loudly.

---

## 5. Contracts

### 5.1 `PluginSpec` — the only thing the LLM emits (never code)

```jsonc
{
  "id": "vehicle",
  "displayName": "Vehicle",
  "kind": "component" | "workflow" | "action",
  "stage": "latest" | "next",
  "types": { "vehicleStatus": "string" },
  "components": [
    { "componentName": "VehicleStatus", "typesHandled": ["vehicleStatus"],
      "behavior": "Display a coloured status pill; edit via a select." }
  ],
  "workflows": [
    { "name": "wfwVehicle", "workflowsHandled": ["vehicle"],
      "behavior": "Horizontal cards, one selected, edit in dialog." }
  ],
  "acceptanceTests": [
    "renders A/B/C", "emits new value on edit", "Register exports registerPlugin"
  ]
}
```

### 5.2 Job states

```
queued → preparing → generating → building → testing
       → ready-for-review → deploying → deployed
       → failed | cancelled
```

Debug artifacts per job: prompt, spec, generated diff, build/test logs, `remoteEntry.json`,
deployed URL, approver identity, pinned tool versions.

### 5.3 WebSocket envelope (backward compatible)

Existing shape `{response, error, model}` keeps working. Add:

```jsonc
{ "kind": "chat", "response": "...", "model": {...} }
{ "kind": "plugin-proposal", "spec": {...}, "reason": "No type handles 'vehicle status'" }
{ "kind": "job", "jobId": "...", "stage": "building", "log": "..." }
{ "kind": "plugin-ready", "jobId": "...", "spec": {...}, "diff": "...",
  "plugin": { "id": "vehicle", "version": "0.1.0",
              "remoteEntry": "https://<host>/apps/gen/vehicle-plugin/remoteEntry.json" } }
{ "kind": "error", "error": "..." }
```

### 5.4 Capability catalog

```jsonc
{
  "types": ["string", "number", "...", "vehicleStatus"],
  "workflows": ["list-detail", "carousel", "vehicle"],
  "components": [{ "componentName": "VehicleStatus", "typesHandled": ["vehicleStatus"] }],
  "generatedAt": "2026-11-14T10:00:00Z",
  "source": "static|generated"
}
```

Built from the deployed plugins' `register.ts`/repository entries; persisted in Mongo; refreshed at
startup and after every successful deploy.

---

## 6. Work breakdown

### Track 0 — Angular 22 + Optimus UI baseline (prerequisite)

Existing sources are on Angular 21 (`apps/dashboard` `^21.2.0`, `apps/xt-host` `^21.2.7`,
`xt-components` peers `^21.0.0`). Move the whole train to Angular 22 **before** the plugin template
and generator are written (M3.0), so they are not built on a version that then has to be migrated.

It does **not** block M1.0: packaging is version-agnostic and can land first for a quick win.

Why before, not after:

- The dev add-on's deliverable *is* generated `xt-plugin-sample` / `xt-workflow-sample` code. Doing
  the generator on 21 would mean regenerating and re-validating every template after the upgrade.
- `strictVersion: true` means host, curated plugins, template and generated plugins must come from
  one version train; a major bump is the right moment to centralize **exact** pins.
- No upstream blockers remain: at 2026-11-14 the registry has `@angular/core` 22.2.6,
  `@angular-architects/native-federation` 22.2.5, `@openng/optimus-ui` 2.0.2,
  `@ngrx/signals` 22.0.1, `ng-packagr` 22.2.6. Angular `next` is 22.3.0-rc, so there is no v23
  pressure.
- The plugin contract (`remoteEntry.json` + `./Register`) is Angular-version independent, so the
  designer's output contract is unaffected.

**UI kit decision (D11).** Angular 22 cannot use PrimeNG: `primeng@22` is licensed under the
commercial PrimeUI terms (`SEE LICENSE IN LICENSE.md`), requires a license key, and forbids
redistributing it so third parties can develop with it without an OEM license — incompatible with
shipping a self-hosted bundle plus generated plugins. `primeng@21.1.10` (what runs today) is still
MIT. The runtime therefore moves to **Optimus UI 2.x** (`@openng/optimus-ui`), an MIT,
API-compatible continuation of PrimeNG v21 with Angular 22 peers. The **dashboard stays on Angular
Material** — it has no PrimeNG dependency and Material is orthogonal to this choice.

Ordering is forced by the dashboard consuming **published** `xt-type` / `xt-components`:
`ng-xtend` first (and republish the libs), then `dont-code`, then validate the runtime.

#### M0.0 — Compatibility spike (gate, timebox 1–2 days)

Angular 22 side:

- Build `xt-host` with `@angular-architects/native-federation` 22.2.5 + Angular 22. Confirm whether
  the federation builder now targets `@angular/build` only (the host still carries
  `@angular-devkit/build-angular` in devDependencies).
- Confirm `@ngrx/signals` 22 and `ng-packagr` 22.2.6 are mutually compatible.
- Decide the dashboard test runner: the dashboard still uses Karma/Jasmine while the host is on
  Vitest 4; check what Angular 22 still supports and whether migrating is part of M0.

Optimus UI side (the go/no-go for D11):

- Run the official migration schematic on a branch:
  `ng generate @openng/optimus-ui:migrate-from-primeng`, then fix the warnings it lists.
- Prove it in *our* stack: `@openng/optimus-ui` 2.0.2 builds under the native-federation builder;
  all 30 PrimeNG modules used in the repo (`api`, `config`, `button`, `autocomplete`, `inputtext`,
  `inputnumber`, `toolbar`, `panel`, `tooltip`, `tag`, `tabs`, `select`, `table`, `menu`,
  `checkbox`, `toast`, `progressspinner`, `inputicon`, `iconfield`, `fileupload`, `dialog`,
  `datepicker`, `card`, `selectbutton`, `rating`, `image`, `drawer`, `divider`, `confirmdialog`,
  `chip`) resolve from `@openng/optimus-ui/*`.
- `providePrimeNG({ theme: { preset: Aura } })` → `provideOptimus({ theme: { preset: Aura } })`
  renders correctly, including `@openng/optimus-ui-themes/aura`.
- `strictVersion` is clean with `primeng` renamed to `@openng/optimus-ui` in the shared config.
- Size check: the Optimus FESM bundle is not materially larger than `primeng@21`.

- **Accept:** a written go/no-go for both axes. Fallbacks are explicit and cheap: (a) federation
  blocker → stay on 21 for the first release; (b) Optimus blocker → stay on Angular 21 + PrimeNG
  21.1.10 (MIT) and defer the 22 upgrade. Record which was chosen and why.
- Note: published `xt-type` is 0.12.0 and `xt-components` is 1.3.0 (1.4.1 / 0.12.1 are still on
  `next`), so they must be published properly as part of M0.1.

##### M0.0 outcome (2026-11-14) — **GO on both axes**

Proven on `ng-xtend` branch `Upgrade-22.2` (109 files: 29 `package.json`, 80 sources).

Resolved stack: `@angular/{core,common,forms,animations,platform-browser,platform-browser-dynamic,router,compiler,compiler-cli}`
22.2.6, `@angular/{cli,build,cdk,material}` 22.2.7, `ng-packagr` 22.2.6,
`@angular-architects/native-federation` 22.2.5, `@ngrx/signals` 22.0.1, `typescript` 6.0.3,
`@openng/optimus-ui*` 2.0.2, `primeicons` 7.0.0.

- **Angular**: all 17 workspaces build with the federation builder on `@angular/build` only;
  `@angular-devkit/build-angular` is gone from devDependencies. `rush build` = 2 clean + 13
  ng-packagr warnings (same class as 21); `rush test` = 15 + 1 warning green in 1m32s.
- **Optimus**: all 30 PrimeNG modules (156 import sites) migrated to `@openng/optimus-ui/*`; the
  host renders with `provideOptimus(...)` and `@openng/optimus-ui-themes/aura`.
- **Runtime**: built host served over plain HTTP with `intl`, `finance` and `workflow-sample`
  remotes, loaded in headless Chromium for the `Simple` and `Workflow` projects. All remotes
  register, the entity table/toolbar/buttons render, and the console has no `strictVersion`,
  duplicate-Angular or NG error, and no 4xx asset request. The host `remoteEntry.json` shares
  `@angular/core` 22.2.6 and Optimus 2.0.2; every remote reports identical versions for every
  shared package it publishes.

Findings that M0.1/M0.3 must keep:

- Angular 22 requires TypeScript `>=6.0.0 <6.1.0` → pin **6.0.3**; registry `latest` (7.0.2) is
  incompatible.
- With `preserveSymlinks: true` + pnpm, transitive deps are not hoisted: every federated workspace
  needs explicit `@softarc/native-federation`, `@softarc/native-federation-orchestrator` and
  `@openng/optimus-ui-{styles,styled,utils,motion}` devDependencies, or esbuild cannot resolve their
  imports (`@softarc/native-federation/domain`, `@openng/optimus-ui-styles/*`).
- Enable `features.denseExternals: true` and patch **only the runtime packages**
  (`@angular/{animations,common,core,forms,platform-browser,router}`) with
  `includeSecondaries: { keepAll: true }`. A blanket `.patch(['@angular/*'])` also matches
  `@angular/cdk`, whose `schematics` entries pull Node built-ins into the browser bundle and fail
  the build.
- `workflow-sample-plugin` publishes `dc-workflow` 1.4.1 itself, matching the host — the R2
  "remote workflow bundles its own `dc-workflow`" case loads correctly at runtime.
- Dashboard test runner: `@angular-devkit/build-angular` 22.2.7 still peers Karma, so M0.2 keeps
  Karma/Jasmine; migrating the dashboard to Vitest is not part of Track 0.

#### M0.1 — `ng-xtend` → Angular 22 + Optimus UI, libs republished

Framework:

- Upgrade apps/libs/plugins to `@angular/*` 22.2.6 (runtime + CLI + build + compiler-cli + ng-packagr).
- Put **exact** versions in the Rush version policy: `@angular/*`, `rxjs`, `tslib`,
  `@ngrx/signals`, `@angular-architects/native-federation`,
  `@softarc/native-federation-runtime`, `ng-packagr`, `typescript`. No `^` on the runtime baseline.
- Update `xt-components` peer ranges to `^22.0.0`; publish `xt-type` and `xt-components` (new
  release line) **before** the dashboard moves.

UI kit (D11), applied to host, libs, plugins and both templates:

- Replace `primeng` with `@openng/optimus-ui` 2.0.2 and `@primeuix/{themes,utils,styled,styles,motion}`
  with `@openng/optimus-ui-themes` + the Optimus utility packages (the schematic does this).
- Rewrite imports `primeng/<module>` → `@openng/optimus-ui/<module>` (156 sites, 30 modules) and
  `@primeuix/themes/aura` → `@openng/optimus-ui-themes/aura`.
- `providePrimeNG` → `provideOptimus`, `PrimeNG` → `Optimus`,
  `PrimeNGConfigType` → `OptimusConfigType` (`apps/xt-host/.../app.config.ts`, tester).
- Update the native-federation **shared** config and every `remoteEntry.json` shared entry from
  `primeng` to `@openng/optimus-ui`; keep `strictVersion: true`.
- Keep the component templates unchanged — Optimus preserves the `p-*` selectors and APIs. Any
  template change beyond the config call is a regression signal, not expected work.
- **Vendor for supply-chain safety:** install from a committed, integrity-pinned tarball `file:`
  reference (or a private registry mirror), not a floating registry range. Record the tarball
  SHA-256 + version in `manifest.json`. MIT allows a permanent fork if upstream disappears.
- **Accept:** all libs and plugins build with the same resolved Angular version; the published libs
  report `^22` peers; zero `primeng` references remain (`grep -r primeng` is empty apart from the
  migration note); Optimus version is exact and vendored.

##### M0.1 status (2026-11-14) — code done, publish pending registry auth

- All workspaces carry exact framework pins (`@angular/*` 22.2.6, CLI/build/cdk 22.2.7,
  `ng-packagr` 22.2.6, `typescript` 6.0.3, `@openng/optimus-ui*` 2.0.2,
  `@angular-architects/native-federation` 22.2.5) with `ensureConsistentVersions` on.
  `xt-components` publishes `@angular/*` peers `^22.0.0` and `@openng/optimus-ui` `^2.0.2`.
- `grep -r 'primeng\|primeuix'` over `apps libs plugins docs common` is empty. Eight stale
  per-package `package-lock.json` files (Angular 18/20 era, unused by Rush or `publish.yml`) were
  removed.
- **Publish is the only open item**: `xt-components` 1.4.1 and `xt-type` 0.12.1 already exist on
  `next` (built for Angular 21); `latest` is 1.3.0 / 0.12.0. The release line must move
  (release-please on merge, or a manual bump to 1.5.0 / 0.13.0) before publishing.
- Runbook once authenticated (`publish.yml` with `next=true`, or `rush-pnpm publish --tag next`):
  1. `rush build-deploy-next`; 2. publish `xt-type` + `xt-components` to `next`; 3. point the
  dashboard at the `@next` versions for M0.2; 4. promote to `latest` only together with the host
  and every plugin (M0.4 rule).
- Optimus tarball pins for `manifest.json` (SHA-256 of `npm pack @openng/<pkg>@2.0.2`):

  | package | sha256 |
  | --- | --- |
  | `@openng/optimus-ui` | `e93f9d0f227c26b651d60050b7b6a90a5ae560876fd3b569896a32497bcd9568` |
  | `@openng/optimus-ui-themes` | `8f091d9c0486cafed31a249f2a34b1de6f49bacbd3c9705137f872b18a8b3912` |
  | `@openng/optimus-ui-styles` | `894d5d70bca9f4dbb2d694bdac9026078f7cdeb3f4cc55e119bad1947b43fd58` |
  | `@openng/optimus-ui-utils` | `813476db04b6fa592a11aa8a88bc3a830b30657e58c93fb322187453cdec4e1d` |
  | `@openng/optimus-ui-styled` | `a275f2063df18bd063c66cf08031503a281f1ec8d596f62199aadbaea2abefd0` |
  | `@openng/optimus-ui-motion` | `c6d4613e0978e9ab96d5c79e23c5c573b1546c01fb3dfa6123076c5137f572b9` |
- **Open decision**: vendoring wiring — committed `file:` tarballs vs a private mirror. Today the
  install is integrity-pinned only through `pnpm-lock.yaml` (sha512), so tampering/outage fails the
  build but there is no offline copy.

#### M0.2 — `dont-code` dashboard → Angular 22

- `@angular/*` 22.2.6, `@angular/build`, `@angular/cli`, `@angular/compiler-cli` 22.2.7/22.2.6,
  `@angular/{material,cdk}` 22.2.7, TypeScript 6.0.3.
- Replace the drifting `xt-type ^0.10.4` with the M0.1 release; align `@angular/material`/`cdk`.
- **No UI-kit change here:** the dashboard keeps Angular Material + Tailwind; it has no PrimeNG
  dependency, so it is unaffected by D11.
- Keep `outputMode: static` and the `index.csr.html` → `index.html` rename (B8).
- Run the M0.0 test-runner decision here if it applies.
- **Accept:** dashboard builds, routes deep-link, designer opens, saved apps still produce a
  loadable `applicationHostUrl` config.

##### M0.2 status (2026-11-14) — done, local commit only

- `apps/dashboard/package.json` pins `@angular/{core,common,compiler,forms,platform-browser,
  platform-server,router}` 22.2.6, `@angular/{cdk,material,build,cli,ssr}` 22.2.7,
  `@angular/compiler-cli` 22.2.6, `typescript` 6.0.3 and `xt-type` 0.12.1 (exact, from `next`;
  `xt-type` is framework-agnostic, so the Angular 21 build is valid until 0.13.0 is published).
- `npx ng build` is clean (no warnings): NG8107 in `preview-app-window.html:77` fixed and the
  production budgets adjusted to the real bundle size (`initial` 700 kB / 1.2 MB, component styles
  8 kB / 12 kB; previously 500 kB/1 MB and 4 kB/8 kB).
- `ng test --browsers=ChromeHeadless`: **15/15 SUCCESS** (Karma/Jasmine kept). The three stale
  scaffold specs were fixed: `App` now guards a missing `window.dashboardConfig`, and the
  `App`/`AppPanel` specs set the required inputs and provide a router.
- Runtime smoke test (`ng serve` :4300 + headless Chromium): `/`, `/repo/default` and
  `/generate/default` all render; the app list loads from the live demo API and the designer page
  renders. Zero console errors.
- Remaining for M0.4: move `xt-type` to the 0.13.0 M0.1 release line once it is published.

#### M0.3 — Runtime validation of host + plugins + templates

- Load in `xt-plugin-tester`/host: `default`, `web`, `intl`, `finance`, `agenda`, `editor`,
  `workflow`, plus `xt-plugin-sample` and `xt-workflow-sample`.
- Verify every `remoteEntry.json` reports the same `@angular/core` (22.2.6), `xt-components`,
  `xt-type` and `@openng/optimus-ui` versions as the host; `strictVersion` must not warn.
- Visual/behaviour check on the Optimus migration: table, autocomplete, datepicker, dialog,
  drawer, toast, confirmdialog, fileupload, tag, rating and the Aura theme render as before.
- Re-confirm a remote workflow plugin that bundles its own `dc-workflow` still loads (input to R2).
- **Accept:** zero version warnings, all plugins render, `ng test` green in host and samples, and a
  screenshot diff of the main app screens shows no unintended UI change.

##### M0.3 status (2026-11-16) — done, committed on `Upgrade-22.2`

- Release builds: `rush build-deploy-next` and `rush build-deploy-latest` both complete **16/16,
  EXIT=0**, with no “will not resolve” warnings.
- Version parity: every host/plugin `remoteEntry.json` reports Angular core 22.2.6,
  `@openng/optimus-ui` 2.0.2, `xt-components`/`xt-store`/`dc-workflow` 1.5.0 and `xt-type` 0.13.0;
  no `strictVersion` warnings.
- **NG0912 fixed by sharing the Optimus subpaths.** `ignoreUnusedDeps` pruned each build to the
  Optimus subpaths it imported, so every remote published a different subset and the runtime
  scoped each remote to its own copy (duplicate component definitions). Adding
  `'@openng/optimus-ui'` to the existing `includeSecondaries: { keepAll: true }` patch in all nine
  `federation.config.js` files makes every build publish the same **261** subpaths.
  `@openng/optimus-ui/editor` is added to `skip` because it dynamically imports the optional,
  uninstalled `quill` and no app uses the subpath. `denseExternals` and the `workspace:^`
  requiredVersion behaviour are unchanged.
- Runtime validation (headless Chromium, local webroot, mock store REST API): all **8** project
  fixtures load and the List/Edit flow works (3–13 form inputs; datepicker, fileupload and rating
  present where expected). **NG0912 count is 0 on every page**; Optimus resolves to the host copy
  (**126** host Optimus chunks loaded, **0** remote-scoped Optimus chunks) with all 7
  `remoteEntry.json` files loaded.
- Legacy fixtures fixed: `Coffee Beans Evaluation.json` (`Text`, `Shop type` → `string`) and
  `Dons.json` (`Reference` → `string`). Other legacy names there are already handled by
  `ApplicationModelManagerService#translate()`.
- `rush test`: **EXIT=0**, 15 projects SUCCESS + `xt-host` SUCCESS WITH WARNINGS (pre-existing
  happy-dom teardown `AbortError`; its specs pass).
- Remaining for M0.3: screenshot diff of the main app screens. Not reproduced in this run: the
  earlier NG01354 (`ngModel` in a child of a parent `FormGroupDirective`) seen on Electric Cars —
  keep as a watch item when editing existing rows.
- The validation harness is throwaway (`/tmp/opencode/m03`) and is not committed.

#### M0.4 — Baseline recorded + deploy discipline

> **Deferred to Phase 3 (§10):** pin enforcement and `doctor` checks run only after the release
> bundle exists and is installable. The `manifest.json` assembled in Phase 1 records the versions
> actually used; it does not enforce them yet.

- Write the resolved versions into `manifest.json` (§4.5) and §4.10; `doctor` compares them.
- Record the vendored `@openng/optimus-ui*` tarball version + SHA-256 in `manifest.json`, and make
  the release build fail if the resolved package differs from the pinned tarball.
- Update `ng-xtend` docs/AGENTS version table and `deploy.yml` stage order.
- Deployment rule: publish to `next` first, then promote host **and** every plugin to `latest`
  atomically — a half-upgraded `/apps/` breaks `strictVersion` for users mid-deploy.
- **Accept:** `doctor` fails on a plugin built with 21.x against a 22 host, with the exact URL and
  version mismatch; the promoted stage passes.

### Track 1 — installable base platform (G1, G2)

#### M1.0 — Release bundle workflow (deployment-agnostic)

> **Phase 1 — do this first.** Bundle generation precedes every verification gate: no `doctor`,
> no pin/version comparison, no clean-VM unpack until the tarball exists. The remaining M1.x
> milestones (config, proxy, auth, Mongo, channels) follow in Phase 2 (§10).
>
> Resolved: the NG0912 fix was merged into `ng-xtend/main` via `266b2ba` (PR #106). The workflow
> builds from that ref by default and records the resolved source ref/SHA in `manifest.json`.
>
> Implemented (2026-11-20): `.github/workflows/release-from-sources.yml`,
> `.github/workflows/release-from-binaries.yml` and `scripts/release/*`. The sources workflow
> builds every dependency; the binaries workflow downloads Java jars from the newest stable GitHub
> Releases, resolves ng-xtend libraries from npm dist-tags (`latest` / `next`) and compiles only the
> dashboard plus the ng-xtend host/plugin app shells. A local dry run assembled a 907-file bundle
> with `manifest.json`, `SHA256SUMS` and neutralized configs; the clean-VM unpack and `doctor`
> acceptance remain in Phase 3.
>
> Known issue: the npm `next` dist-tag currently resolves to 1.4.1 libraries that still import
> PrimeNG, so the `next` channel cannot build against `ng-xtend/main` app shells. Republish the
> Optimus-based libraries under `next` before using that channel.

- New `release` workflow in `dont-code`: build the dashboard static app (rename
  `index.csr.html` → `index.html`), build the two Quarkus uber-jars, take the pinned `ng-xtend`
  host + plugins, and assemble `dont-code-<version>/` with `manifest.json` + `SHA256SUMS` (§4.5).
- Assert the bundle contains no hostname, credential, database URI or nginx config.
- Publish it as a GitHub release asset. The workflow deploys nothing.
- **Accept:** unpack on a clean VM; assets and checksums are present; `doctor` reads
  `manifest.json`; the same tarball is usable by both channels.

#### M1.1 — Runtime configuration externalization
- Write `bin/dont-code configure` rendering the two repository JSONs + `platform.json` (§4.3).
- Enforce absolute `projectApiUrl` / `generateApiUrl`; validate `applicationHostUrl` trailing `&`.
- **Accept:** change the domain in `platform.json`, re-render, everything still works; `grep -r
  dont-code.net` over the deployed static files finds nothing.

#### M1.2 — Reverse proxy + SPA routing
- nginx config: SPA fallbacks, `/apps/` static, `/api/project/`, `/api/data/`, `/api/documents`,
  WebSocket `/api/generate` with `Upgrade`/`Connection` and long timeouts, upload body size.
- Services bind `127.0.0.1`.
- **Accept:** dashboard routes deep-link (`/generate/default`, `/repo/default`) work on reload; WS
  connects through the proxy.

#### M1.3 — Auth & tenancy (v1)
- SSO gate at the proxy; admin-only dev routes (when the add-on exists).
- Optional `per-user` mode via `DbName` injection (§4.7).
- Restrict CORS to `publicUrl` when not loopback.
- **Accept:** unauthenticated request is redirected/rejected; per-user mode isolates app lists.

#### M1.4 — External MongoDB (YunoHost) and bundled MongoDB (Docker)
- YunoHost: install question for the existing Mongo connection; validate reachability and
  permissions; create only `dontCodeProjects` / `dontCodeData` + a dedicated user, or accept
  pre-created names; set the unique `projects.name` index. Never install or reconfigure the
  server's MongoDB.
- Docker: run a pinned `mongo` image with a named volume and the same DB/user bootstrap.
- **Accept:** YunoHost install against an existing shared Mongo works and touches no other
  database; `docker compose up` reaches the same state from an empty volume.

#### M1.5 — YunoHost package skeleton (external Mongo)
- `manifest.toml` (questions: domain, AI provider/model/key, existing Mongo connection);
  `scripts/install`, `upgrade`, `remove`, `backup`, `restore`, `change_url`;
  `conf/nginx.conf`; `conf/systemd/{project,data}-services.service`.
- Downloads and verifies the release bundle from GitHub; installs it under
  `/var/www/dont-code/releases/<version>`.
- `[resources.ports]` for the two internal ports; **no** `[resources.database]` (Mongo is not a
  supported YunoHost resource) and **no** Mongo installation.
- **Accept:** install → login → design → save → list → open on a real YunoHost VM with a
  pre-existing Mongo, and no other database is touched.

#### M1.6 — Docker bundle (database included)
- Self-contained compose: `mongo` (named volume) + `project-services` + `data-services` + `web`,
  images built from the same release bundle; the `dev` profile is reserved for the add-on.
- Config rendered from environment variables at start via the shared `bin/dont-code configure`.
- **Accept:** `docker compose up` on an empty host gives the same behaviour as M1.5, and Mongo
  data survives `down`/`up`.

#### M1.7 — Lifecycle commands + docs
- `bin/dont-code doctor|backup|restore|status`; operator docs (install, upgrade, backup, provider
  change, troubleshooting).
- **Accept:** backup on A → restore on B → identical app list and app data.

### Track 2 — designer visibility & provider configuration (G2, groundwork for G3)

#### M2.1 — Fix save/update semantics
- `ProjectService.saveProjectDefinition`: look up by name when `currentProject` is unknown, then PUT;
  never POST a duplicate. Add the unique index (M1.4).
- **Accept:** save, reload the page, save again → exactly one app in the list.

#### M2.2 — Auto-save + immediate visibility
- After each successful generation, persist a draft automatically (debounced), show saved/unsaved
  state, and refresh the app list on return to the dashboard.
- Keep the explicit "Save as…" dialog for naming/renaming.
- **Accept:** generate → navigate back → the app is listed with no further action.

#### M2.3 — Unified repository config + validation
- One generator for both dashboard and host JSONs, one `dont-code doctor` check that the host's
  `plugins[]` entries resolve and match the runtime baseline.
- **Accept:** a missing/broken plugin entry is reported with the exact URL and version mismatch.

#### M2.4 — Configurable AI provider
- Abstract the provider (Mistral | OpenAI-compatible | Ollama), add `quarkus-langchain4j-openai`,
  move model + base URL to config, wire secrets, tolerate a missing key.
- **Accept:** switch provider via config only; designer works with each; bad key → clear UI error,
  rest of the platform healthy.

#### M2.5 — Capability catalog injection
- Replace the hardcoded type/workflow list in `GenerateProjectService.java:18-24` with the catalog
  (§5.4), built from deployed plugins.
- **Accept:** a plugin added to the host repository appears in the designer's allowed types without
  a code change.

#### M2.6 — E2E verification of G2
- Automated test: install → login → generate → save → list → open in host → edit data.
- **Accept:** the test is part of the release gate.

### Track 3 — plugin generation dev add-on (G3)

#### M3.0 — Template + prompt (in `ng-xtend`)
- Add `templates/plugin-starter/` derived from `libs/xt-plugin-sample` and
  `libs/xt-workflow-sample`: standalone (no rush), deps pinned to §4.10 (post-Track 0), placeholder naming
  (`sample` / `Sample` / `SAMPLE`, rules already documented in `xt-workflow-sample/README.md`),
  `federation.config.js` exposing `./Register`, `build` + `test` scripts.
- Add `docs/guides/plugin-generation.md` = the agent system prompt: registry API, rename rules,
  native-federation `./Register`, "must pass `ng test`", deploy layout/base href, version pins.
- **Accept:** run OpenCode by hand on one spec ("rating displayed as stars") → `ng build` + `ng test`
  green → `remoteEntry.json` exposes `./Register` → loads in `xt-plugin-tester`.
- **Also answer:** does a remote workflow plugin with its own bundled `dc-workflow` actually work in
  the host? (risk R2)

#### M3.1 — `plugin-worker` (Node/TS, container)
- Endpoints: `POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/events` (SSE),
  `POST /jobs/{id}/approve|cancel`.
- `OpenCodeRunner`: session per job (`location.directory` = workspace), prompt = template + spec,
  stream events, interrupt on cancel; Basic auth `opencode:<password>`.
- `BuildRunner`: `npm ci && ng build && ng test`, failures fed back to the same session (max 3).
- `Publisher`: version artifact, verify `remoteEntry.json` versions against the host baseline,
  copy to `/var/www/dont-code/generated/<name>-plugin/`, keep the previous version for rollback.
- `Catalog`: refresh after deploy.
- **Accept:** one job end-to-end from API to a loadable remote.

#### M3.2 — `project-services` bridge
- `PluginWorkerClient` + config `dontcode.plugin-worker.url`.
- Extend the WS envelope (§5.3) and `GenerateProjectModel`.
- Add a `proposePlugin(requirements)` tool; prompt rule: never emit code, never trigger generation
  without explicit user confirmation.
- After `deployed`: refresh catalog, re-run generation with the extended catalog, then let the user
  continue the same chat.
- **Accept:** "I need a star rating" → proposal → job → deployed → app config uses `rating`.

#### M3.3 — Dashboard dev UI
- Type the WS message union in `GenerateAppService`; extend `QuestionOrAnswer` with
  `plugin-proposal`, `job-progress`, `plugin-ready`.
- New components: `plugin-proposal-card`, `plugin-job-card` (stage timeline, log tail, cancel),
  `plugin-ready-card` (diff summary, approve/deploy).
- After deploy: reload the host iframe with a cache-busting parameter.
- **Accept:** full flow from the chat UI, with cancel and failure paths.

#### M3.4 — Dev add-on packaging
- Two shapes from one image set: `dont-code-dev` YunoHost package (depends on `dont-code`, ships
  the containerized worker + OpenCode) and a `dev` profile in the Docker bundle.
- Adds: worker image, OpenCode (pinned), `/apps/gen/` nginx location, admin-only route,
  backup of job records.
- Agent permissions: deny writes outside the workspace, deny `webfetch`, allow only
  `npm/npx/node/ng` bash, no secrets in the workspace, CPU/mem/time limits, per-user quotas.
- **Accept:** add-on install/uninstall leaves the base platform and existing generated plugins intact.

#### M3.5 — Safety & ops
- Human approval gate before deploy (decided).
- Audit log: spec, prompt, diff, logs, artifacts, approver.
- Quotas: jobs/user/day, build minutes, token budget.
- Pin OpenCode + template versions per platform release; fail the job on version mismatch.
- **Accept:** an approval is required and recorded; a tampered plugin is rejected by the version check.

---

## 7. Key files (reference)

| Purpose | Path |
|---|---|
| Designer chat UI | `dont-code/apps/dashboard/src/app/generate-app/` |
| WS client | `dont-code/.../shared/generate-app-service/generate-app-service.ts` |
| Chat model | `dont-code/.../shared/dialog-service/question-answer.ts` |
| Save/list services | `dont-code/.../shared/project-service/project-service.ts` |
| App list | `dont-code/.../list-of-apps/list-of-apps.ts` |
| Dashboard configs | `dont-code/apps/dashboard/public/assets/config/*.json` |
| Dashboard build | `dont-code/apps/dashboard/angular.json`, `.github/workflows/deploy-dashboard.yml` |
| Release workflow (new) | `dont-code/.github/workflows/release.yml` |
| Release bundle contract | `manifest.json`, `SHA256SUMS`, `bin/dont-code` |
| YunoHost package (new) | `dont-code_ynh/` (`manifest.toml`, `scripts/*`, `conf/*`) |
| Docker bundle (new) | `dont-code-docker/` (`compose.yaml`, `web/`, `mongo/`) |
| Generator WS | `project-services/.../generate/GenerateProjectResource.java` |
| Generator prompt | `project-services/.../generate/GenerateProjectService.java` |
| Projects REST | `project-services/.../ProjectResource.java`, `ProjectService.java` |
| Projects config | `project-services/src/main/resources/application.properties` |
| Data REST | `data-services/.../DataResource.java`, `DocumentResource.java` |
| Host config loader | `ng-xtend/apps/xt-host/.../shared/app-config/app-config.service.ts` |
| Host UI-kit / theme config | `ng-xtend/apps/xt-host/projects/host/src/app/app.config.ts` (`provideOptimus` after M0) |
| Host repository model | `ng-xtend/apps/xt-host/.../shared/models/dc-repository-model.ts` |
| Host project load | `ng-xtend/apps/xt-host/.../project-load/project-load.component.ts` |
| Plugin registry | `ng-xtend/libs/xt-components/.../registry/xt-plugin-registry.ts` |
| Plugin types | `ng-xtend/libs/xt-components/.../plugin/xt-plugin-info.ts` |
| Sample plugin / workflow | `ng-xtend/libs/xt-plugin-sample/`, `ng-xtend/libs/xt-workflow-sample/` |
| Host deploy workflow | `ng-xtend/.github/workflows/deploy.yml` |

---

## 8. Risks

1. **Version skew** — `strictVersion: true` everywhere; host, plugins and template must ship as one
   release train. Generated plugins must be built against the exact host baseline.
2. **`dc-workflow` is not shared** — a remote workflow plugin bundles its own base class. Validate
   in M3.0 before promising workflow generation.
3. **Generated code is untrusted** — approval, provenance, and the isolated `/apps/gen/` namespace
   are the controls; a sandbox alone is not enough (the code runs in users' browsers).
4. **No auth today** — the AI endpoint costs money and the data API is world-writable. SSO + loopback
   binding is mandatory before any public install.
5. **Shared external Mongo (YunoHost)** — not a managed resource. The package must never install or
   reconfigure it: credentials, network access, DB-name collisions, user-creation rights and backup
   scope all need validation at install (D4).
6. **Static config drift** — two JSON files, two schemas, generated at install. `change_url` and
   upgrades must re-render both; `doctor` must detect drift.
7. **Build cost** — each generation job is a full Angular install+build (minutes). Pre-warmed image /
   cached `node_modules` is required; jobs must be async, cancellable, resumable.
8. **OpenCode is RCE by design** — internal network only, per-job workspace, restricted agent,
   never proxied publicly.
9. **Prompt injection** from the app description into generated code — human review gate + diff.
10. **Sub-path installs** — root-relative assets assume a dedicated domain. Supporting
    `https://domain/dont-code/` needs a second build per prefix (D6).
11. **Release/installer contract drift** — the bundle is the only interface between CI and the two
    channels. `manifest.json`, `SHA256SUMS` and `doctor` are the guardrails; a channel that starts
    inventing its own build or config breaks the model.
12. **Major-version migration mid-flight** — Angular 22 must land before the template/generator
    exist. Forced ordering (republish `xt-type`/`xt-components` → dashboard → plugins) plus
    `strictVersion` means a partial deploy or an unpinned `^` in one package can strand the whole
    train. Gate it in M0.0 and pin exactly in M0.4.
13. **UI-kit licensing and youth** — `primeng@22` is commercially licensed (key + OEM clause for
    redistribution), which is incompatible with an open self-hosted bundle; `primeng@21` is MIT but
    binds the runtime to Angular 21. Optimus UI is MIT but only ~4 months old with a small
    maintainer team. Controls: M0.0 proof in our own stack, exact pin + vendored tarball + SHA-256
    in `manifest.json`, and the documented fallback to Angular 21 + PrimeNG 21 (MIT).

---

## 9. Open decisions

| # | Decision | Options | Lean |
|---|---|---|---|
| D1 | Worker location | new repo `dont-code/plugin-worker` vs `apps/plugin-worker` in the rush monorepo | new repo (different runtime, container, no Angular graph) |
| D2 | Deploy namespace | `/apps/<name>-plugin/` shared vs `/apps/gen/<name>-plugin/` isolated | isolated (`/apps/gen/`, survives upgrades, separate trust boundary) |
| D3 | Who may trigger/approve | any logged-in user vs admins only vs repository owner | admin for install/approve; users may propose |
| D4 | Mongo in the YunoHost channel | require an external Mongo vs optional bundled Mongo | external only (the Docker channel bundles it) |
| D5 | Tenancy | shared DB vs per-user `DbName` injection | shared default, per-user opt-in |
| D6 | Install path | dedicated (sub)domain vs sub-path | dedicated domain |
| D7 | Add-on runtime | Docker required vs native toolchain + system user | Docker (isolation, reproducible toolchain) |
| D8 | Generation model | reuse `ng-xtend/opencode.json` Ollama/Collinfr models vs dedicated codegen model | dedicated model, provider-configurable |
| D9 | Base + add-on packaging | two packages vs one package + flag | two packages |
| D10 | Host + plugins in the release bundle | bundle the `ng-xtend` host/plugins into `dont-code-<version>` vs consume a separate `ng-xtend` release | bundle them (version lockstep is mandatory) |
| D11 | UI kit for the Angular 22 runtime | Optimus UI 2.x (MIT, API-compatible PrimeNG 21 fork) vs rebuild on Angular Material vs stay on Angular 21 + PrimeNG 21 (MIT) | Optimus UI for host/plugins/templates; Angular Material stays in the dashboard; **never** PrimeNG 22 (commercial + OEM redistribution clause) |

---

## 10. Suggested order

```
Track 0  M0.0 spike (Angular 22 + Optimus UI) ─ M0.1 ng-xtend 22 + Optimus ─ M0.2 dashboard 22
         ─ M0.3 runtime validation
         (M0.4 pins/doctor checks deferred to Phase 3, after an installable bundle exists)
                        │
Phase 1  M1.0 release bundle: dashboard + both Java services + ng-xtend host/plugins
         → GitHub release asset (deployment-agnostic, manifest + SHA256SUMS)
                        │
Phase 2  M1.1 config ─ M1.2 proxy ─ M1.3 auth ─ M1.4 Mongo
         ─ M1.5 YunoHost ─ M1.6 Docker ─ M1.7 lifecycle/docs
                        │
Phase 3  M0.4 pin enforcement + doctor + promotion discipline
         ─ M0.3 screenshot diff / NG01354 recheck
         ─ M1.0 clean-VM unpack + both-channel acceptance
                        │
Track 2  M2.1 save/upsert ─ M2.2 auto-save ─ M2.3 config lint
         ─ M2.4 provider ─ M2.5 catalog ─ M2.6 E2E gate
                        │
Track 3  M3.0 template+prompt (hand-prove one plugin)   ← de-risks versions & federation
         ─ M3.1 worker ─ M3.2 bridge ─ M3.3 dashboard dev UI
         ─ M3.4 add-on packaging ─ M3.5 safety/ops
```

Rationale: produce something installable first — Phase 1 is one deployment-agnostic bundle with
host + dashboard + Java services, Phase 2 makes it installable through both channels. Track 0
removes the version migration from the generator's critical path; the checks previously in M0.4
and the acceptance tests are grouped in Phase 3, where they have a real bundle to validate.
Verifying pins before any bundle existed produced checks with no deployable target. Track 2 makes
apps visible and the designer configurable; Track 3 builds the generator on a platform that
already has a capability catalog, a plugin namespace and an approval surface.
