import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { files } from './db/schema';

// Define the Bindings for Cloudflare Workers. Here, DB is for D1 and R2 is for Cloudflare R2.
// R2Bucket is the default type for a Cloudflare R2 bucket binding.

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

// Root endpoint for a quick health check
app.get('/', (c) => {
  return c.text('File Sharing Service is running!');
});

// POST /upload - Handles file uploads via multipart form-data
app.post('/upload', async (c) => {
  // Parse the multipart form data
  const form = await c.req.parseBody();
  if (!form || !form.file) {
    return c.json({ error: 'File is required in form-data under the "file" field.' }, 400);
  }

  // We allow file field to be a single file or array. We'll support single file.
  const fileData = Array.isArray(form.file) ? form.file[0] : form.file;

  // Validate the file size (maximum 2GB)
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB in bytes
  if (fileData.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File size exceeds the maximum allowed limit of 2GB.' }, 400);
  }

  // Generate a unique file identifier
  const fileId = crypto.randomUUID();

  // Determine the R2 object key. For simplicity, we can use the fileId as basis
  const r2ObjectKey = `uploads/${fileId}-${fileData.name}`;

  // Upload file to Cloudflare R2.
  // Note: The fileData object contains the underlying file stream in the "stream" property if available.
  // Here we assume fileData.file is a Blob or File-like object, so we use its stream or arrayBuffer.
  const fileBody = fileData.data || fileData.file; // support both possible properties

  // We can use the streaming API if desired. For more info, see TODO comments below.
  await c.env.R2.put(r2ObjectKey, fileBody, {
    httpMetadata: { contentType: fileData.type || 'application/octet-stream' }
  });

  // Insert file metadata into the database using Drizzle ORM
  const db = drizzle(c.env.DB);
  await db.insert(files).values({
    fileId: fileId,
    fileName: fileData.name,
    contentType: fileData.type || 'application/octet-stream',
    size: fileData.size,
    uploadedAt: Date.now(),
    r2ObjectKey: r2ObjectKey
  });

  // Return the file URL in the response
  // Assuming the file can be accessed via the /file/:fileId endpoint
  return c.json({ fileUrl: `${c.req.url.replace(/\/upload.*$/, '')}/file/${fileId}` });
});

// GET /file/:fileId - Retrieves the file from R2 and streams it to the client
app.get('/file/:fileId', async (c) => {
  const fileId = c.req.param('fileId');
  if (!fileId) {
    return c.json({ error: 'fileId is required.' }, 400);
  }

  // Lookup file metadata from D1
  const db = drizzle(c.env.DB);
  const [fileRecord] = await db.select().from(files).where(eq(files.fileId, fileId));
  if (!fileRecord) {
    return c.json({ error: 'File not found.' }, 404);
  }

  // Retrieve the file from R2 using the stored object key
  const object = await c.env.R2.get(fileRecord.r2ObjectKey);
  if (!object) {
    return c.json({ error: 'File not found in storage.' }, 404);
  }

  // TODO: For advanced streaming support, refer to Hono's streaming helper: https://hono.dev/docs/helpers/streaming#streaming-helper
  // Return the file response with appropriate headers
  return c.body(object.body, 200, {
    'Content-Type': fileRecord.contentType,
    // Additional headers such as Content-Length or Content-Disposition can be added if needed
  });
});

// PUT /file/:fileId - Update file metadata (e.g., fileName)
app.put('/file/:fileId', async (c) => {
  const fileId = c.req.param('fileId');
  if (!fileId) {
    return c.json({ error: 'fileId is required.' }, 400);
  }

  const updateData = await c.req.json();
  if (!updateData.fileName) {
    return c.json({ error: 'fileName is required for update.' }, 400);
  }

  const db = drizzle(c.env.DB);
  // Update the fileName in the database
  const [updatedFile] = await db.update(files)
    .set({ fileName: updateData.fileName })
    .where(eq(files.fileId, fileId))
    .returning();

  if (!updatedFile) {
    return c.json({ error: 'File not found for update.' }, 404);
  }

  return c.json({ file: updatedFile });
});

// DELETE /file/:fileId - Delete the file from R2 and remove metadata from D1
app.delete('/file/:fileId', async (c) => {
  const fileId = c.req.param('fileId');
  if (!fileId) {
    return c.json({ error: 'fileId is required.' }, 400);
  }

  const db = drizzle(c.env.DB);
  // Find the file record first
  const [fileRecord] = await db.select().from(files).where(eq(files.fileId, fileId));
  if (!fileRecord) {
    return c.json({ error: 'File not found.' }, 404);
  }

  // Delete the file from R2
  await c.env.R2.delete(fileRecord.r2ObjectKey);

  // Delete the record from the database
  // Using the correct drizzle delete style
  await db.delete(files).where(eq(files.fileId, fileId));

  return c.json({ message: 'File deleted successfully.' });
});

export default app;
