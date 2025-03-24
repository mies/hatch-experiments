# Social Photo-Sharing API Implementation Plan

This document outlines the complete implementation plan for the Social Photo-Sharing API. The solution is built on Cloudflare Workers using the Hono API framework, and integrations include Cloudflare R2 for photo storage, Cloudflare D1 with Drizzle ORM for relational data, and Clerk for user authentication.

## Overview

Develop a RESTful API that allows users to:

- Upload photos without file restrictions
- Follow and unfollow other users (managing both following and followers lists)
- Like photos (each user can only like each photo once)

Users will have accounts with a username, email, and an optional profile picture (uploaded photo).

## Technology Stack

- **API Framework:** Hono (TypeScript API framework similar to Express.js)
- **Runtime:** Cloudflare Workers
- **Relational Database:** Cloudflare D1 with Drizzle ORM
- **Authentication:** Clerk
- **Blob Storage:** Cloudflare R2

## Database Schema

Use Cloudflare D1 with Drizzle ORM for a type-safe SQL query builder. The following tables should be defined:

1. **Users**
   - id (primary key, UUID or auto-increment integer)
   - username (string, unique)
   - email (string, unique)
   - profile_photo_url (string, nullable) – URL pointing to Cloudflare R2
   - created_at (timestamp)

2. **Photos**
   - id (primary key)
   - user_id (foreign key referencing Users.id)
   - photo_url (string) – URL of the uploaded photo in Cloudflare R2
   - caption (text, optional)
   - created_at (timestamp)

3. **Follows**
   - id (primary key)
   - follower_id (foreign key referencing Users.id)
   - followee_id (foreign key referencing Users.id)
   - created_at (timestamp)
   - Unique constraint on (follower_id, followee_id) to avoid duplicate follows

4. **Likes**
   - id (primary key)
   - user_id (foreign key referencing Users.id)
   - photo_id (foreign key referencing Photos.id)
   - created_at (timestamp)
   - Unique constraint on (user_id, photo_id) to enforce single like

## API Endpoints and Functionality

### 1. Authentication & User Management (Clerk)

Since Clerk handles authentication and basic user profile storage, you'll integrate Clerk’s middleware to:

- Secure endpoints
- Extract the authenticated user information (id, email, etc.)

Additional endpoints can be provided to update user profile data (e.g., upload a new profile photo to Cloudflare R2 and update Users.profile_photo_url in the database).

### 2. Photo Upload and Management

Endpoints:

- **POST /photos**
  - Description: Endpoint for an authenticated user to upload a photo.
  - Flow:
    1. Accept file upload (via multipart/form-data).
    2. Upload the file to Cloudflare R2.
    3. Record metadata in the Photos table (store the Cloudflare R2 URL, user_id, optional caption).
    4. Return the photo metadata and URL.

- **GET /photos/:id**
  - Description: Retrieve photo metadata, including likes count.
  
- **GET /users/:id/photos**
  - Description: List all photos belonging to a specific user.

### 3. Follow Functionality

Endpoints:

- **POST /follow**
  - Description: Allow an authenticated user to follow another user.
  - Payload: { "followee_id": "..." }
  - Ensure the follower_id is the authenticated user. Create a new record in the Follows table.

- **POST /unfollow**
  - Description: Allow an authenticated user to unfollow another user, removing the record from Follows.

- **GET /users/:id/followers**
  - Description: List users following the specified user.

- **GET /users/:id/following**
  - Description: List users that the specified user is following.

### 4. Like Photos Functionality

Endpoints:

- **POST /photos/:id/like**
  - Description: Allow an authenticated user to like a photo.
  - Ensure that a user only likes a photo once (use unique constraint in the Likes table). Respond with an error message if the like already exists.

- **DELETE /photos/:id/like**
  - Description: Allow an authenticated user to remove a like from a photo.

- **GET /photos/:id/likes** (Optional)
  - Description: Retrieve the total number of likes or list of users who liked the photo (if needed).

## Development Steps

1. **Project Setup**
   - Initialize a new Cloudflare Workers project using Wrangler.
   - Set up TypeScript with Hono as the API framework.

2. **Integrate Clerk for Authentication**
   - Install the Clerk SDK and configure middleware in Hono routes.
   - Ensure all secure endpoints require authentication.

3. **Database Setup**
   - Connect to Cloudflare D1 and configure Drizzle ORM.
   - Define the database schema for Users, Photos, Follows, and Likes.
   - Write migration scripts if needed to initialize the database schema.

4. **Integrate Cloudflare R2 for Photo Storage**
   - Configure R2 bucket access and API keys in Cloudflare Workers secrets.
   - Write utility functions to handle file uploads to R2 and generate public URLs.

5. **Implement Endpoints**
   - Build routes for user actions, photo uploads, following/unfollowing, and liking/unliking photos.
   - Ensure each route performs necessary validations (e.g., check that images exist, user permissions, and unique constraints).

6. **Testing and Error Handling**
   - Write unit and integration tests for each endpoint.
   - Handle error states clearly (e.g., invalid file formats, duplicate likes, trying to follow an already followed user).

7. **Deployment**
   - Use Cloudflare Wrangler to deploy the API to Cloudflare Workers.
   - Ensure all environment variables and secrets (e.g., Clerk API keys, D1 connection details, R2 credentials) are properly configured.

8. **Documentation and Future Enhancements**
   - Document API endpoints using tools like OpenAPI/Swagger if needed.
   - Consider adding rate limiting or caching strategies as the API scales.

## Additional Considerations

- Use Cloudflare Edge caching where appropriate.
- Monitor Cloudflare Workers logs and D1 query performance.
- Ensure secure handling of file uploads (validate file types even if no limits are set, to prevent malicious content uploads).

This implementation plan should guide the development of a robust social photo-sharing API using the specified technologies and integrations.