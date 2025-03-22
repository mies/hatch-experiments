# Changelog API Handoff Document

This document outlines the implementation for a Changelog API that listens for GitHub release events on a specific repository and sends out a changelog email immediately when a new release is detected.

## Overview

The API will be built using Hono on Cloudflare Workers. It will expose a webhook endpoint that listens for GitHub release events. Once a release event is received and verified, the API will extract relevant release information (such as release title, version, release notes, and URL) and generate a changelog email. The email will then be sent to a predefined address via Resend.

## Technology Stack

- **Edge Runtime**: Cloudflare Workers
- **Framework**: Hono (TypeScript API framework, similar to Express.js)
- **Email Service**: Resend

## Environment Variables / Configuration

The following environment variables will need to be configured in Cloudflare Worker:

- GITHUB_WEBHOOK_SECRET: Secret for verifying the GitHub webhook signature.
- RESEND_API_KEY: API key for sending emails via Resend.
- EMAIL_FROM: The email address to use as the sender in the Resend API.
- EMAIL_TO: The predefined recipient email address for the changelog.

Additional configuration:

- Repository configuration: Hard-code the specific GitHub repository information (owner/repo) in the code if needed for extra verification.

## Implementation Steps

1. ### Set Up Webhook Endpoint
   - Create a new Cloudflare Worker project using Hono.
   - Define an endpoint (e.g., `/github-webhook`) that accepts POST requests from GitHub.
   - Configure GitHub to send release events (webhooks) to this endpoint.

2. ### Verify GitHub Webhook
   - Implement signature verification using the `GITHUB_WEBHOOK_SECRET` to ensure that the incoming payload is authentic.
   - Use the appropriate hashing (e.g., HMAC with SHA-256) method to verify the X-Hub-Signature-256 header in the request.

3. ### Parse the Release Event
   - Ensure that the webhook event is specifically a "release" event.
   - Extract the release details from the payload. Key details include:
     - Release title
     - Tag name / version
     - Release notes (body)
     - URL to the release
   - Optionally, validate that the release is from the specific repository if needed (by checking repository name/owner).

4. ### Generate the Changelog Email
   - Format the extracted information into a well-structured changelog email content. For example:
     - Subject: "New Release: <Release Title>"
     - Body: Include version, release notes, URL, etc.

5. ### Send Email via Resend
   - Create a function that uses the Resend API to send emails.
   - Construct the API request with the email content, using the following details:
     - From: EMAIL_FROM
     - To: EMAIL_TO
     - Subject: Dynamically generated subject using the release title.
     - Body: The formatted changelog.
   - Use fetch (or an HTTP client) from within Cloudflare Workers to call the Resend API endpoint.
   - Handle any errors or edge cases from the Resend API response.

6. ### Error Handling & Logging
   - Ensure that all steps have proper error handling, returning appropriate HTTP responses to GitHub (for example, 200 for successful processing, 400/500 for errors).
   - Log errors and important events for debugging, using Cloudflare Workers logging facilities.

7. ### Testing
   - Simulate GitHub release events locally or in a staging environment.
   - Verify that the endpoint correctly validates the webhook signature, parses event payload, and sends out the email via Resend.
   - Test error handling cases (invalid payload, email service failure, etc.).

8. ### Deployment & Monitoring
   - Deploy the Cloudflare Worker using wrangler or via the Cloudflare dashboard.
   - Monitor the deployment logs to ensure the API is functioning as expected.
   - Optionally, set up alerts for webhook failures or email sending issues.

## Additional Considerations

- Consider rate limiting or additional security measures if the endpoint might be exposed more widely in the future.
- Document the API endpoint and configuration steps for future developers or maintainers.

By following this implementation plan, a developer should be able to set up and deploy a changelog API that listens for GitHub release events and sends an immediate changelog email through Resend.