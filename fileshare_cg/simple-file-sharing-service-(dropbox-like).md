# Simple File Sharing Service Specification

This document outlines the design and implementation plan for a lightweight file sharing service. The core functionality of the service is to support file uploads (up to 2GB per file), and generate a unique link for each file that can be accessed publicly. There is no authentication, versioning, or permission management at this stage.

## 1. Technology Stack

- **Edge Runtime:** Cloudflare Workers
- **API Framework:** Hono.js (TypeScript based API framework similar to Express.js)
- **Blob Storage:** Cloudflare R2 for storing uploaded files
- **Optional Metadata Storage:** Cloudflare D1, coupled with Drizzle ORM, if you need to store file metadata and mapping information

## 2. Database Schema (Optional)

While it is not strictly necessary for this MVP, using a relational database (Cloudflare D1) can help store metadata such as file name, size, content type, and the unique file identifier for retrieval.

### 2.1. Files Table (Optional)

- id (INTEGER, Primary Key, Auto Increment or UUID if preferred)
- file_id (VARCHAR, Unique) - the unique identifier used in the file URL
- file_name (VARCHAR) - original file name
- content_type (VARCHAR) - MIME type of the file
- size (INTEGER) - file size in bytes
- uploaded_at (TIMESTAMP) - upload date and time
- r2_object_key (VARCHAR) - key/path to the file in Cloudflare R2

## 3. API Endpoints

The API endpoints will be grouped based on file operations.

### 3.1. Upload Endpoint

- **POST /upload**
  - Description: Accepts a file upload via a multipart form-data request. The endpoint validates the file (size <= 2GB) and stores it in Cloudflare R2. A unique file identifier is generated.
  - Expected Payload: Multipart form-data containing a file field (e.g., `file`)
  - Workflow:
    1. Validate the file exists in the request.
    2. Check the file size (ensure it does not exceed 2GB).
    3. Generate a unique file identifier (e.g., using a UUID or a short random string).
    4. Upload the file stream to Cloudflare R2, with the unique identifier as part of the object key.
    5. Optionally, if using Cloudflare D1, insert a record into the database containing file metadata and the R2 object key.
    6. Return a JSON response with the unique link for the file. For example:
       {
         "fileUrl": "https://your-domain.com/file/<unique-file-id>"
       }

### 3.2. File Retrieval Endpoint

- **GET /file/:fileId**
  - Description: Retrieves the file stored in Cloudflare R2 using the unique file identifier provided in the URL parameter.
  - Route Parameter: `fileId` - the unique identifier generated during upload
  - Workflow:
    1. Retrieve file metadata from Cloudflare D1 (if used) or directly use the fileId to construct the R2 object key.
    2. Stream or fetch the file from Cloudflare R2.
    3. Set appropriate HTTP headers (Content-Type, Content-Disposition, Content-Length) and return the file content in the response.

## 4. Integrations

- **Cloudflare R2:** for handling the blob storage of file uploads
- **Cloudflare D1 + Drizzle ORM (Optional):** for managing file metadata
- **Hono.js:** the API framework handling the HTTP request routing
- **Cloudflare Workers:** the deployment platform

## 5. Additional Notes

- Ensure the multipart form-data file upload is optimized for large file streaming. Consider using streaming APIs to avoid buffering entire files in memory.
- Validate the file size before processing the upload. If the file exceeds 2GB, return an appropriate error response.
- The unique file identifier should be random enough to avoid collisions.
- Depending on your security requirements, consider adding rate limiting or other edge safeguards.
- Ensure proper CORS configuration if the service is to be consumed from browsers.

## 6. Future Considerations

- Add authentication and permission control (e.g., using Clerk) to limit access or enable user-specific storage.
- Enhance the service to support file versioning.
- Expand file metadata storage to support search or file management features.
- Introduce file expiration and cleanup mechanisms for storage optimization.
- Monitor and log file operations for audit purposes and debugging.

## 7. Further Reading

For more in-depth examples using the HONC-stack (Hono.js, Drizzle ORM, Cloudflare D1, and Cloudflare Workers), you may refer to project templates and documentation available in the community.

---

This document should serve as a handoff for implementation. The developer is expected to set up the project structure, configurations, and integrations per the outlined specifications.
