# GitHub Pull Request LLM Code Reviewer API Implementation Plan

This document outlines the implementation plan for the automated code review API that listens for GitHub pull request events, extracts code changes, and uses OpenAI’s LLM to perform code analysis. The implementation will use the HONC stack (Hono, OpenAI, Neon, Clerk) on Cloudflare Workers.

---

## 1. Overview

The API will:

- Listen to GitHub webhook events for pull requests (opened, reopened, or synchronized).
- Validate and parse incoming webhook payloads.
- Retrieve changed file data from GitHub using the GitHub API.
- Generate a prompt that includes diffs or summaries of changes for code analysis by OpenAI.
- Send requests to the OpenAI API with the prompt and receive analysis output.
- (Optional) Post the automated review as a comment on the pull request using the GitHub API.

## 2. Architecture

- **API Framework:** Hono running on Cloudflare Workers
- **Webhook Endpoint:** Exposes a POST endpoint (e.g., `/webhook`)
- **Authentication & Security:** Validate incoming GitHub webhook signatures using a shared secret (stored as an environment variable).
- **External APIs:**
  - OpenAI API for LLM-driven code analysis
  - GitHub API for retrieving pull request details and posting review comments
- **Environment Variables** (to be set in Cloudflare Workers secrets):
  - GITHUB_WEBHOOK_SECRET
  - GITHUB_TOKEN (Personal Access Token with proper scopes)
  - OPENAI_API_KEY

## 3. Detailed Workflow

### 3.1. Webhook Endpoint Setup

- **Endpoint:** POST `/webhook`
- **Middleware:**
  - Validate the request comes from GitHub by verifying the signature in the `X-Hub-Signature-256` header using the `GITHUB_WEBHOOK_SECRET`.
  - Reject the request if signature verification fails.

### 3.2. Parse Webhook Payload

- Check if the event header (`X-GitHub-Event`) is set to `pull_request`.
- Parse the JSON payload to extract relevant details such as:
  - pull request number
  - repository details (owner, repo)
  - action (opened, reopened, synchronized)

### 3.3. Retrieve Changed Files / Diffs

- Use the GitHub API to fetch changed files and their diffs. For example, call:
  GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files

- Aggregate diff information (or code snippets) from each file. If the diff is too large, consider limiting the size or summarizing the diff.

### 3.4. Construct the OpenAI API Prompt

- Formulate a prompt that instructs the LLM to perform a thorough code analysis for review. Example prompt:

  "Perform a code review for the following diff. Highlight any potential issues, code smells, or areas for improvement. Provide clear suggestions where applicable. Diff:\n{DIFF_CONTENT}"

- Replace `{DIFF_CONTENT}` with the aggregated diff from step 3.3.

### 3.5. Call the OpenAI API

- Create a POST request to the OpenAI completions (or chat completions) endpoint using the `OPENAI_API_KEY`.
- Pass the prompt in the request body. For instance, if using Chat Completion with `gpt-3.5-turbo`, structure the messages accordingly.
- Handle errors and timeouts gracefully.

### 3.6. Process the Review Output

- Extract the code review analysis from the OpenAI response.
- (Optional) Check for thresholds (e.g., if critical issues are detected) to trigger further automated actions.

### 3.7. Post Review to GitHub (Optional)

- If you choose to automatically post the review to GitHub:
  - Use the GitHub API to create a comment on the pull request using the endpoint:
    POST https://api.github.com/repos/{owner}/{repo}/issues/{pull_number}/comments
  - Include the LLM analysis in the comment body.

### 3.8. Return Response

- Respond with an appropriate status code (e.g., 200 OK) once the process completes.
- Log events and errors for monitoring and troubleshooting.

## 4. Implementation Details

### 4.1. Directory Structure

A suggested directory structure:

```
/ (project root)
├── src/
│   ├── index.ts         // Main entry point with Hono server setup
│   ├── githubWebhook.ts // Module to handle GitHub webhook parsing and validation
│   ├── openaiReview.ts  // Module to interact with the OpenAI API
│   └── githubApi.ts     // Module to interact with the GitHub API (fetch diffs, post comments)
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2. Code Snippets

Below are some pseudocode samples to illustrate the core parts:

// In src/index.ts

/*
import { Hono } from 'hono';
import { handleGitHubWebhook } from './githubWebhook';

const app = new Hono();

app.post('/webhook', async (c) => {
  try {
    const result = await handleGitHubWebhook(c);
    return c.text(result, 200);
  } catch (err) {
    console.error('Error processing webhook:', err);
    return c.text('Internal Server Error', 500);
  }
});

export default app;
*/

// In src/githubWebhook.ts

/*
import { Context } from 'hono';
import { validateSignature } from './utils';
import { fetchPullRequestDiffs, postGitHubComment } from './githubApi';
import { generateReview } from './openaiReview';

export async function handleGitHubWebhook(c: Context) {
  // Validate signature
  const signature = c.req.headers.get('X-Hub-Signature-256');
  const payload = await c.req.text();
  if (!validateSignature(payload, signature)) {
    throw new Error('Invalid signature');
  }

  // Parse payload
  const event = c.req.headers.get('X-GitHub-Event');
  if (event !== 'pull_request') {
    return 'Event ignored';
  }

  const json = JSON.parse(payload);
  const action = json.action;
  if (!['opened', 'reopened', 'synchronize'].includes(action)) {
    return 'No review needed for this action';
  }

  const pullNumber = json.number;
  const { owner, name: repo } = json.repository;

  // Fetch diff or changed files
  const diff = await fetchPullRequestDiffs(owner.login, repo, pullNumber);

  // Create prompt and call the OpenAI API for review
  const review = await generateReview(diff);

  // Optionally, post the review back to GitHub
  await postGitHubComment(owner.login, repo, pullNumber, review);

  return 'Review processed and posted';
}
*/

// In src/openaiReview.ts

/*
export async function generateReview(diff: string) {
  const prompt = `Perform a code review for the following diff. Highlight any potential issues, improvements, or areas for refactoring:\n\n${diff}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
*/

### 4.3. Security Considerations

- Validate all incoming webhook requests.
- Do not log sensitive data such as API keys or webhook secrets.
- Use environment variables for secret storage.

### 4.4. Deployment

- Package the code as a Cloudflare Worker using Wrangler.
- Set environment variables via Wrangler configuration.
- Test using a local tunnel (e.g., using Cloudflare CLI) and GitHub’s webhook test functionality.

## 5. Testing

- **Unit Tests:** Write unit tests for modules (e.g., signature validation, diff fetching, and OpenAI integration).
- **Integration Tests:** Simulate GitHub webhook payloads and verify end-to-end flow.
- **Error Handling:** Test scenarios when external services (GitHub, OpenAI) fail.

## 6. Documentation & Next Steps

- Document API endpoints and expected payloads in a README.md file.
- Optionally, add a dashboard or logging interface for monitoring the API.
- Plan future enhancements (e.g., handling large diffs, supporting additional events).

---

This implementation plan should provide a thorough guideline to build an automated code review API that listens for GitHub pull request events, processes diffs via OpenAI, and optionally posts automated reviews. Feel free to iterate further on this design based on testing feedback and additional feature requirements.