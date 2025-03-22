# Filesharing & File Upload API Implementation Plan

This document provides detailed implementation instructions for a file upload and sharing API using Cloudflare Workers and Hono. The API will allow users to upload images and PDFs (up to 2GB) and receive an email with a unique link that expires after two weeks. Files will be stored in Cloudflare R2, and metadata will be stored in Cloudflare D1 using Drizzle as the ORM. Email delivery will be handled by Resend.

---

## 1. Technology Stack

- **Backend Framework:** Hono (TypeScript API framework similar to Express.js)
- **Edge Runtime:** Cloudflare Workers
- **Object Storage:** Cloudflare R2
- **Database:** Cloudflare D1 (with Drizzle as the type-safe SQL query builder/ORM)
- **Email Service:** Resend

---

## 2. API Endpoints

### a. POST /upload

- **Purpose:** Accept file uploads (images and PDFs) along with a user email.
- **Payload:** Multipart form-data containing:
  - File (validated to be an image or PDF, with max size 2GB)
  - Email (string)

- **Process:**
  1. Validate provided file:
     - Check MIME type for images (i.e. image/jpeg, image/png, etc.) and application/pdf for PDFs.
     - Enforce the 2GB max size limit.
  2. Generate a unique identifier/token for the file. Use a UUID or similar random token.
  3. Determine an expiration timestamp, two weeks from the upload time.
  4. Upload the file to Cloudflare R2 using a predefined bucket binding (e.g., the R2 bucket can be accessed via environment variable binding from wrangler.toml).
  5. Insert a record into the Cloudflare D1 database containing file metadata:
     - ID (unique token)
     - Email
     - Original file name
     - MIME type
     - File size
     - Upload timestamp
     - Expiration timestamp
  6. Generate a unique file access URL (e.g. https://yourdomain.com/file/{ID}).
  7. Use Resend to send an email to the provided address containing the unique file access URL and any additional instructions.
  8. Return a JSON response with details about the upload and the URL.

### b. GET /file/:id

- **Purpose:** Retrieve the file if the link has not expired.
- **Process:**
  1. Accept the unique file identifier as a URL parameter.
  2. Query the Cloudflare D1 database (using Drizzle) to get metadata for the file.
  3. Check if the current timestamp is before the expiration timestamp.
  4. If valid, fetch the file from Cloudflare R2 and stream it back to the user.
  5. If expired, return an error message or status indicating that the link is no longer valid.

---

## 3. Database Schema

Using Drizzle, define a table (e.g., `files`) with the following fields:

- id: string (primary key)
- email: string
- original_filename: string
- mime_type: string
- file_size: number
- upload_timestamp: datetime
- expiration_timestamp: datetime
- r2_object_key: string (the key used to store/retrieve file from Cloudflare R2)

---

## 4. Email Integration

- **Service:** Resend
- **Flow:** Upon successful upload, trigger a function to send an email to the user.
  - Email content should include:
    - A friendly message confirming the file upload.
    - The unique download link (e.g. https://yourdomain.com/file/{id}).
    - Information that the link will expire in two weeks.

---

## 5. Cloudflare Workers Setup

- Create a new Cloudflare Worker project using Wrangler.
- Configure environment bindings:
  - Bind the Cloudflare R2 bucket in `wrangler.toml` (e.g., `BUCKET_NAME`).
  - Bind Cloudflare D1 database connection.
  - Any secret keys required for Resend (API key) should be injected via environment secrets.

Example snippet for wrangler.toml:

```
name = "filesharing-api"
main = "dist/index.js"

[triggers]
  crons = []

[vars]
  RESEND_API_KEY = "your-resend-api-key"

[[r2_buckets]]
  binding = "R2_BUCKET"
  bucket_name = "your-bucket-name"

[[d1_databases]]
  binding = "D1_DB"
  database_name = "filesharing_db"
```

---

## 6. Implementation Considerations

- **File Validation:**
  - Implement robust error-handling for oversized or unsupported file types.
  - Return descriptive error messages if validation fails.

- **Security:**
  - Ensure that the file upload process does not allow executable code injection.
  - Use secure random generation for file tokens.
  - Validate and sanitize email addresses.

- **Performance:**
  - Consider streaming file uploads for better memory management when handling large files.
  - Use proper caching headers when serving files if applicable.

- **Maintenance:**
  - Plan for a cleanup job (e.g. a scheduled Cloudflare Worker) that removes expired file records from D1 and deletes the corresponding objects in R2.

- **Logging & Monitoring:**
  - Add logging for uploads, email sending, and file retrieval.
  - Integrate monitoring/alerting based on Cloudflare’s metrics or external logging services.

---

## 7. Testing

- Write unit tests for individual endpoints using a testing framework (e.g., Mocha or Jest for Worker projects).
- Integration tests for file upload and retrieval process.
- Test email delivery with Resend in a staging environment.
- Validate that expired links are handled correctly.

---

## 8. Deployment

- Use Wrangler to deploy to Cloudflare Workers.
- Ensure environmental variables are correctly set in production.
- Validate endpoint functionality post-deployment.

---

## 9. Summary

This implementation plan covers the creation of a file upload API with email notifications and unique access links that expire after two weeks. It uses Cloudflare Workers with the Hono framework, Cloudflare R2 for file storage, Cloudflare D1 with Drizzle for metadata persistence, and Resend for email notifications. Follow the outlined steps to ensure a robust, secure, and maintainable implementation.

Happy coding!