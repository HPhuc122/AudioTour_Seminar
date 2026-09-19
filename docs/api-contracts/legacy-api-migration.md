# Legacy API migration plan

The prior `VinhHy_AudioTour` backend is an ASP.NET API backed by SQL Server. Its HTTP contract, DTO fields, business rules, and data model are reusable; its C# implementation must be rewritten for this Python layout.

## Response compatibility

Preserve the existing client envelope: `{ "success": true, "message": "Success", "data": {} }`. Validation failures return `success: false` with an `errors` object.

## Service ownership

| New service | Reusable legacy API groups |
| --- | --- |
| `auth-service` | `/api/v1/auth/login`, `/refresh`, `/register`, `/register-device`; users, roles, JWT, devices |
| `content-service` | public tours/POIs, `pois`, `qr`, languages, translations, media metadata |
| `narration-service` | narration drafts, approval, translation/TTS, upload audio, narration logs |

## Required layering

```text
api/router -> schemas -> service -> repository -> SQL Server
```

Do not access SQL Server from FastAPI routes. The first migration scope is Auth, Public Tours/POIs, QR and Narration. Payment simulation, offline sync, analytics and CMS file storage are deferred until their repository adapters and integration tests are ready.
