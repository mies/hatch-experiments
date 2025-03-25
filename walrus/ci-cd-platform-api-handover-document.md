# CI/CD Platform API Specification

This document outlines the detailed implementation plan for a CI/CD platform API. The API will primarily integrate with GitHub to listen for push and pull request events and trigger containerized pipeline jobs. Job definitions are stored in YAML format within the API. Authentication is enforced using API tokens, and all API endpoints and processes will be implemented using Cloudflare Workers with Hono.js.

## 1. Technology Stack

- **Edge Runtime:** Cloudflare Workers
- **API Framework:** Hono.js (TypeScript-based API framework similar to Express.js)
- **Database:** Cloudflare D1 (Serverless SQLite Edge Database)
- **ORM:** Drizzle (Type-safe SQL query builder and ORM)
- **Authentication:** API Token based auth (custom implementation, as roles are not required)
- **Container Execution:** Integration with container orchestrator / container runtime (jobs will run inside containers)
- **Version Control Integration:** GitHub (via webhooks)

## 2. Database Schema Design

The API will maintain a relational database with at least the following entities:

### 2.1. Users Table

Even though there are no roles, we need to store API tokens and related metadata for each user.

- id: INTEGER, Primary Key, Auto-Increment
- name: TEXT, User friendly name
- email: TEXT, Unique email identifier
- api_token: TEXT, Unique API token for authentication
- created_at: TIMESTAMP, Defaults to current time

### 2.2. PipelineConfigs Table

This table stores pipeline job definitions in YAML format.

- id: INTEGER, Primary Key, Auto-Increment
- name: TEXT, Name for the pipeline job
- description: TEXT, Optional description
- yaml_config: TEXT, The YAML configuration data
- created_by: INTEGER, Foreign Key referencing Users(id)
- created_at: TIMESTAMP, Defaults to current time

### 2.3. PipelineRuns Table

Stores information about each execution of a pipeline.

- id: INTEGER, Primary Key, Auto-Increment
- pipeline_config_id: INTEGER, Foreign Key referencing PipelineConfigs(id)
- triggered_by: TEXT, Identifier of the trigger (e.g., commit SHA, webhook event id, etc.)
- status: TEXT, Status of the run (e.g., pending, running, success, failed)
- logs: TEXT, Execution logs (aggregated output or pointer to blob storage if needed)
- started_at: TIMESTAMP, Nullable
- finished_at: TIMESTAMP, Nullable

## 3. API Endpoints

The API endpoints are categorized based on functionality. Each endpoint requires API token based authentication (e.g., via headers).

### 3.1. GitHub Webhook Handler Endpoints

- **POST /webhooks/github**
  - Description: Endpoint for listening to GitHub webhook events. Expected events include push and pull_request events. The endpoint will validate the event, extract commit/PR details, match the associated pipeline configuration if any, and trigger a new PipelineRun.
  - Expected Payload: GitHub webhook payload (structured JSON per GitHub specifications).

### 3.2. Pipeline Configuration Management Endpoints

Endpoints to create, update, retrieve, and delete pipeline job definitions.

- **POST /pipelines**
  - Description: Create a new pipeline job configuration. The payload should include a name, description (optional), and a YAML configuration string.
  - Expected Payload:
    ```json
    {
      "name": "Build Pipeline",
      "description": "Pipeline for building and testing",
      "yaml_config": "<YAML string>"
    }
    ```

- **GET /pipelines**
  - Description: Retrieve all pipeline configurations for an authenticated user.

- **GET /pipelines/:id**
  - Description: Retrieve details of a specific pipeline configuration.

- **PUT /pipelines/:id**
  - Description: Update an existing pipeline configuration.

- **DELETE /pipelines/:id**
  - Description: Delete a pipeline configuration.

### 3.3. Pipeline Run Management Endpoints

Endpoints to manage and query executions of pipeline jobs.

- **GET /runs**
  - Description: Retrieve a list of pipeline runs for the authenticated user. Support filtering by status, date, or pipeline id.
  - Query Params: status, pipeline_config_id, date ranges, etc.

- **GET /runs/:id**
  - Description: Retrieve detailed information about a specific pipeline run, including logs and timestamps.

- **POST /runs/:id/retry** (Optional)
  - Description: Trigger a retry for a failed or cancelled pipeline run.

## 4. Integrations

- **GitHub:**
  - The API will integrate with GitHub via a webhook endpoint to listen for push and pull request events. This integration will trigger the job executions.

- **Container Execution Environment:**
  - Jobs will be executed in containers. The API will interface with the container runtime/orchestrator (this could be an external service or an internal system) to start containers based on the pipeline configuration. The API should dispatch a job execution request with relevant parameters extracted from GitHub events and pipeline configuration.
  - Consider using a queueing mechanism (could be a Cloudflare Durable Object or an external queue) if jobs need to be queued before execution.

## 5. Additional Integrations

Any remaining integrations or services:

- Logging/Monitoring: Use a logging service to track errors, pipeline run history, and execution logs. If necessary, consider Cloudflare R2 for storing large logs or artifacts.
- Email/Notifications (Future): Integration with Resend or similar if notifications (e.g., pipeline success/failure emails) are required in the future.

## 6. Authentication

- Use API tokens for authentication. This can be implemented by requiring that each request includes a valid API token (e.g., via an Authorization header).
- Validate each token against the Users table.

## 7. Execution Flow Example (Pseudocode)

1. GitHub sends a webhook event to POST /webhooks/github.
2. The API verifies the webhook signature and parses the event payload.
3. If the event is a push or pull_request, extract relevant data (repository, commit SHA, branch, etc.).
4. Determine the associated pipeline configuration for the repository (this could be based on branch naming conventions or explicit configuration parameters).
5. Create a new record in the PipelineRuns table with a "pending" status.
6. Trigger containerized job execution by dispatching a request to the container environment, passing job parameters.
7. Update PipelineRuns record with job execution status (from pending to running, then success/failed).
8. Optionally, persist logs or pointers to logs.

## 8. Future Considerations

- Role-based access control if more granular permissions become necessary.
- It might be valuable to expand VCS integration beyond GitHub to GitLab, Bitbucket, etc.
- Consider incorporating a UI dashboard for pipeline management and monitoring.
- Enhance logging and monitoring, potentially integrating with third-party services.
- Advanced job scheduling features and a more robust container orchestration mechanism (e.g., Kubernetes integration) as the project scales.
- Support for storing and referencing artifacts (potential integration with Cloudflare R2 for blob storage).

## 9. Further Reading

- Refer to projects using Cloudflare Workers, Hono.js, and Cloudflare D1 for similar patterns.
- Source inspiration from CI/CD projects in open source to understand event flow and execution logging.

This implementation plan should provide sufficient detail for a developer to start building the CI/CD platform API using the Hono-stack. Further refinements may be needed as specifics emerge during development, but these guidelines serve as the initial architecture blueprint.