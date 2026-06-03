# Supabase Auth Redirect Setup

If registration or password reset emails open a wrong page such as:

```txt
http://localhost:3000/auth
Sign in to Open WebUI
```

the Supabase Auth redirect URL is pointing to another local app. Change it in Supabase.

## Where to Change

In your Supabase project:

1. Open `Authentication`.
2. Open `URL Configuration`.
3. Set `Site URL` to the real URL where this app is deployed.
4. Add the same app URL to `Redirect URLs`.

Recommended production value after Cloudflare deploy:

```txt
https://your-cloudflare-pages-domain.pages.dev
```

or your custom domain:

```txt
https://your-domain.com
```

## Local Testing

Do not use `localhost:3000/auth` unless this app is actually running there.

For local testing, either:

- open the app after deploying to Cloudflare and use the Cloudflare URL, or
- run a local static server on a clear port and add that exact URL to Supabase redirect URLs.

Example local redirect:

```txt
http://localhost:5173/index.html
```

## Important

`file:///.../index.html` is not a good email confirmation redirect target. Supabase email links should return to an `http` or `https` URL.

