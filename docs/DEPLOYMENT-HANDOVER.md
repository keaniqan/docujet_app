# Docujet — Deployment Handover

**Domain:** `docujet.biz` · **Stack:** Next.js + Supabase · **Host:** Vercel

---

## 1. Ownership

Documation owns every layer after handover: the repository, the hosting, the database, and the
DeepSeek key. The developer keeps no production access.

## 2. Accounts

| Service | How it is obtained |
|---------|--------------------|
| GitHub | Client creates |
| Vercel | Client creates |
| DeepSeek | Client creates, key supplied in Step 3 |
| Supabase | Transferred from the developer (Step 2) |

---

## 3. Step 1 — Fork the repository

Source repository: **https://github.com/ibhazim1/docujet/**

1. Send the GitHub username to the developer. They grant it read access.

   > `[insert screenshot: the invitation email / GitHub notification accepting the repo invite]`

2. Open the repository and click **Fork** (top right).

   > `[insert 2 screenshots: (1) the Fork button on github.com/ibhazim1/docujet, (2) the "Create fork" form with the Documation account selected as owner]`

3. Confirm the fork is **private** — Settings → General → Danger Zone shows the visibility.

   > `[insert screenshot: the repository page showing the Documation account name and the "Private" badge]`

To pull in later updates from the developer: **Sync fork** on the fork's main page.

> `[insert screenshot: the "Sync fork" button]`

---

## 4. Step 2 — Receive the Supabase project

The database already holds the schema, the settings and the live data. Nothing is rebuilt.

1. Accept the developer's invitation to the Supabase organisation (**Owner** role).

   > `[insert screenshot: the Supabase invitation email, and the accept screen]`

2. Sign in and confirm you can open the project, its Table Editor, and Project Settings.

   > `[insert screenshot: the project dashboard as seen from the Documation account]`

3. Add Documation's payment method — **Organisation Settings → Billing**. Billing follows the
   organisation, so do this before the developer leaves.

   > `[insert screenshot: Organisation Settings → Billing, payment method form]`

4. Tell the developer to leave the organisation. Confirm the member list then shows Documation only.

   > `[insert screenshot: Organisation Settings → Team, member list after the developer has left]`

5. Copy these three values for Step 3:

   | Value | Where |
   |-------|-------|
   | `SUPABASE_URL` | Project Settings → Data API |
   | `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable |
   | `SUPABASE_SECRET_KEY` | Project Settings → API Keys → service_role |

   > `[insert 2 screenshots: (1) Project Settings → Data API showing the project URL, (2) Project Settings → API Keys showing both keys with the values blurred]`

**Order matters:** Documation must have Owner access and have confirmed step 2 before the developer
leaves. An organisation whose last Owner departs cannot be administered.

**The service_role key bypasses all database security.** It goes into Vercel and nowhere else —
never a browser, never a chat message.

Staff logins already exist in the project. The superadmin password is handed over with the keys;
further staff are managed in the app at `/superadmin/users`.

---

## 5. Step 3 — Deploy on Vercel

1. **Add New → Project**, import the forked repository. Framework preset **Next.js** is detected;
   leave every build setting at its default.

   > `[insert 2 screenshots: (1) the Vercel import screen listing the forked repo, (2) the configure screen showing Next.js detected]`

2. Add the environment variables **before** deploying.

   > `[insert screenshot: the Environment Variables section of the Vercel configure screen, one variable entered as an example]`

   **Required:**

   | Variable | Value |
   |----------|-------|
   | `SUPABASE_URL` | from Step 2 |
   | `SUPABASE_SECRET_KEY` | from Step 2 (service_role) |
   | `SUPABASE_PUBLISHABLE_KEY` | from Step 2 (publishable) |
   | `DEEPSEEK_API_KEY` | Documation's own key from platform.deepseek.com |

   **Optional:**

   | Variable | Value |
   |----------|-------|
   | `DEEPSEEK_MODEL` | leave unset — defaults to `deepseek-v4-flash` |

   **Do not set:** `CRM_TODAY`, `TRANSFORMERS_CACHE`, `SUPABASE_DB_PASSWORD`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VERCEL_URL`.

3. **Deploy.** If the build log contains `Could not pre-cache`, the chat assistant's model failed to
   download — redeploy.

   > `[insert screenshot: a successful deployment screen]`

The DeepSeek key can be changed later at `/superadmin/settings/system` without redeploying. A key
saved there overrides the one in Vercel.

---

## 6. Step 4 — Point the domain

1. In **Vercel → Project → Settings → Domains**, add `docujet.biz` and `www.docujet.biz`.

   > `[insert screenshot: Vercel Settings → Domains after adding the domain, showing the DNS records Vercel asks for]`

2. At the registrar, create:

   | Type | Name | Value |
   |------|------|-------|
   | A | `@` | `216.198.79.1` |
   | CNAME | `www` | the value shown on Vercel's Domains screen |

   > `[insert screenshot: the registrar's DNS record editor with both records entered]`

3. Wait for Vercel's Domains screen to show a green check — minutes, up to 48 hours. The HTTPS
   certificate is issued automatically.

   > `[insert screenshot: Vercel Domains screen with the valid-configuration check]`

---

## 7. End of contract

- [ ] Remove the developer's access to the source repository.
- [ ] Confirm the developer is absent from the Supabase organisation and the Vercel project.
- [ ] Rotate the Supabase service_role key and publishable key, update them in Vercel, redeploy.
- [ ] Change the superadmin password.
- [ ] Confirm at least two Documation staff hold superadmin at `/superadmin/users`.
- [ ] Take a Supabase backup.
