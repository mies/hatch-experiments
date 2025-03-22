# Haiku App Naming Service Implementation Plan

This document outlines the steps required to build an API-based app naming service that generates names reminiscent of Heroku's naming style, combining a randomly selected noun, a verb, and a number. The API will be built using Hono on Cloudflare Workers and will enforce authentication using Clerk.

## 1. Technology Stack

- **API Framework:** Hono (TypeScript-based, similar in syntax to Express.js)
- **Runtime:** Cloudflare Workers
- **Authentication:** Clerk
- **Language:** TypeScript

## 2. Project Structure

A suggested project file structure is as follows:

```
haiku-app-naming-service/
│
├── src/
│   ├── index.ts          // Main entry, sets up Hono server
│   ├── auth.ts           // Clerk authentication middleware
│   └── generator.ts      // Module for generating names
│
├── package.json
├── tsconfig.json
└── wrangler.toml         // Cloudflare Workers configuration
```

## 3. Setup and Dependencies

1. Initialize the project:
   - Run `npm init -y` in your project folder.

2. Install required packages:
   - Hono: `npm install hono`
   - Clerk (and any Clerk helpers for Workers if available): `npm install @clerk/clerk-sdk-node` (Note: Check Clerk docs for Cloudflare Worker integration specifics)

3. Setup TypeScript and Cloudflare Workers:
   - Configure your `tsconfig.json` to target the Cloudflare Workers environment.
   - Configure `wrangler.toml` with necessary settings (e.g., account_id, route, zone_id, etc.).

## 4. Clerk Authentication Integration

Since authentication is required, follow these steps to integrate Clerk:

1. Create an authentication middleware (`auth.ts`) that:
   - Extracts the `Authorization` header from the incoming requests.
   - Verifies the token using Clerk's JWT verification functionality.
   - Rejects requests with invalid or missing tokens with a 401 Unauthorized response.

2. Example pseudo-code for the middleware:

   ```typescript
   // auth.ts
   import { Context, Next } from 'hono';
   import { verifyToken } from '@clerk/clerk-sdk-node'; // Adjust based on actual Cloudflare Worker usage

   export async function clerkAuth(ctx: Context, next: Next) {
     const authHeader = ctx.req.headers.get('Authorization');
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       ctx.status(401);
       return ctx.json({ error: 'Unauthorized - Missing token' });
     }

     const token = authHeader.substring(7);
     try {
       // Adjust parameters as needed based on Clerk integration docs for Workers
       const verified = await verifyToken(token);
       if (!verified) {
         ctx.status(401);
         return ctx.json({ error: 'Unauthorized - Invalid token' });
       }
       // Optionally attach user details to the context
       ctx.req['user'] = verified;
       return next();
     } catch (error) {
       ctx.status(401);
       return ctx.json({ error: 'Unauthorized' });
     }
   }
   ```

## 5. Name Generation Logic

Create a module `generator.ts` that will handle generating the name. The name should have the format: `<noun> <verb> <number>`. 

1. Define two arrays: one for nouns and one for verbs (you can expand these lists as needed):

   ```typescript
   // generator.ts
   const nouns = [
     'cat', 'dog', 'apple', 'mountain', 'river', 'forest', 'cloud', 'star', 'ocean'
   ];

   const verbs = [
     'jumps', 'runs', 'flies', 'shines', 'flows', 'grows', 'sleeps'
   ];

   function getRandomElement<T>(arr: T[]): T {
     return arr[Math.floor(Math.random() * arr.length)];
   }

   export function generateHaikuName(): string {
     const noun = getRandomElement(nouns);
     const verb = getRandomElement(verbs);
     const number = Math.floor(Math.random() * 1000); // random number between 0 and 999
     return `${noun} ${verb} ${number}`;
   }
   ```

## 6. API Endpoint

Implement the API endpoint using Hono in `index.ts`.

1. Import the authentication middleware and the generator module.
2. Create a route, e.g., `GET /generate`, that:
   - Applies the Clerk authentication middleware.
   - Invokes the generator to produce a new name.
   - Returns the name in JSON format.

Example implementation:

```typescript
// index.ts
import { Hono } from 'hono';
import { clerkAuth } from './auth';
import { generateHaikuName } from './generator';

const app = new Hono();

// Protected route
app.get('/generate', clerkAuth, (ctx) => {
  const name = generateHaikuName();
  return ctx.json({ name });
});

// Optionally, you may add a health check endpoint
app.get('/', (ctx) => ctx.json({ status: 'ok' }));

export default app;
```

## 7. Deployment

1. Configure your `wrangler.toml` with the proper settings for Cloudflare Workers. Example:

   ```toml
   name = "haiku-app-naming-service"
   type = "javascript"
   account_id = "YOUR_ACCOUNT_ID"
   workers_dev = true
   compatibility_date = "2023-10-01"
   
   [build]
   command = "npm run build"
   
   [site]
   bucket = "./dist"
   ```

2. Build and deploy your project using Wrangler:
   - Build: `npm run build` (ensure your build script compiles TypeScript to JavaScript)
   - Publish: `wrangler publish`

## 8. Testing

Once deployed, you can test your API using curl. For example:

```bash
curl -H "Authorization: Bearer YOUR_VALID_CLERK_TOKEN" https://your-deployment.workers.dev/generate
```

The response should be a JSON object such as:

```json
{
  "name": "star runs 532"
}
```

## 9. Future Enhancements

- Expand the noun and verb lists to allow for more creative and varied names.
- Introduce additional parameters or customization options (e.g., specifying a seed, returning multiple names, etc.).
- Add logging and monitoring via Cloudflare or external tools.
- Package the API with proper error handling and rate limiting if necessary.

This concludes the implementation plan for the Haiku App Naming Service. Follow these steps to deliver a robust, authenticated API that can generate creative, haiku-like app names using Hono and Cloudflare Workers.