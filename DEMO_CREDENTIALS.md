# Tasty Corner development credentials

These accounts are for local development only. Change or remove them before any public deployment.

Restaurant code: `TASTY001`

| Role | Email | Phone | Password |
| --- | --- | --- | --- |
| Owner | `owner@tastycorner.demo` | `9876543210` | `Owner@123` |
| Manager | `manager1@tastycorner.demo` | `9876543211` | `Manager@123` |
| Manager | `manager2@tastycorner.demo` | `9876543212` | `Manager@123` |
| Manager | `manager3@tastycorner.demo` | `9876543213` | `Manager@123` |

Run `npm run db:seed` from `server` only after configuring a development `DATABASE_URL`. The seed is disabled when `NODE_ENV=production` and does not overwrite existing passwords.
