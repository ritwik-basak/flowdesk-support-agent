# Flowdesk Technical Support Guide

This guide helps users and support teams troubleshoot common technical issues in Flowdesk. The steps below are written for the web application first, but most recommendations also apply to desktop and mobile clients unless noted otherwise.

## Task notifications not working

If task assignment alerts, mentions, or due date reminders are not arriving, check the following in order:

1. Confirm notifications are enabled in **My Settings** > **Notifications**.
2. Verify the affected event is one that actually triggers a notification, such as a new assignment, comment mention, or due date reminder.
3. Check whether the task or project is muted.
4. Make sure your email address is verified if you expect email alerts.
5. Confirm your browser allows notifications for Flowdesk if you rely on desktop pop-ups.
6. Ask your workspace admin whether notification defaults or security policies are limiting delivery.

Additional checks:

- Review spam, junk, or quarantine folders for email notifications.
- Sign out and back in to refresh your session.
- On mobile, ensure app notifications are enabled in the device settings.
- If only one workspace is affected, the issue may be tied to workspace-level notification rules.

## Video call integration issues

Flowdesk can attach meetings to tasks or launch calls through supported meeting providers. If calls are failing to start or join:

1. Verify the integration is connected in **Settings** > **Integrations**.
2. Re-authenticate the affected provider if the token has expired.
3. Confirm the meeting link was generated successfully and is not malformed.
4. Check microphone and camera permissions in the browser or operating system.
5. Disable browser extensions that block pop-ups, scripts, or third-party cookies.

If users can create meeting links but cannot join them, the issue is often external to Flowdesk, such as the meeting provider being unavailable or the account not having permission to host calls.

## Browser compatibility issues

Flowdesk supports the current and previous major versions of:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari on macOS

You may experience layout issues, missing buttons, or failed drag-and-drop actions when using outdated browsers or privacy-focused extensions that block essential scripts.

Recommended steps:

1. Update the browser to the latest version.
2. Test the same action in an incognito or private window.
3. Disable extensions one at a time, especially ad blockers, script blockers, and password managers.
4. Confirm JavaScript and cookies are enabled.

Internet Explorer is not supported.

## How to report a bug

When reporting a bug, include enough detail for the support or engineering team to reproduce it quickly.

Please provide:

- A short summary of the issue
- The page or feature where it happened
- Steps to reproduce the behavior
- What you expected to happen
- What actually happened
- Screenshots or screen recordings, if available
- Browser name and version
- Device and operating system
- Time of occurrence and workspace name

Submit bugs through **Help** > **Contact Support** or by emailing your support address if your workspace has a dedicated success manager. Include any visible error code in the report.

## Data not syncing across devices

If tasks, comments, or status changes appear on one device but not another:

1. Confirm both devices are signed in to the same Flowdesk account.
2. Check that both devices are connected to the internet.
3. Refresh the project or sign out and back in.
4. Look for offline mode indicators in the app.
5. Verify the item was saved successfully on the original device.

If the issue persists, inspect whether one device has an outdated cached session. Clearing cache or reinstalling the mobile app often resolves stale data problems.

## Slack and Google Calendar integrations

Flowdesk supports integrations with Slack and Google Calendar for notifications, scheduling, and workflow visibility.

For Slack:

- Connect the workspace from **Settings** > **Integrations**
- Choose which channel types can receive Flowdesk updates
- Confirm the Slack app is approved by your Slack workspace admin

For Google Calendar:

- Connect the Google account used for meetings and deadlines
- Review calendar permissions during setup
- Confirm the correct timezone is configured in both Flowdesk and Google Calendar

Common integration issues include expired tokens, revoked permissions, and account mismatches between personal and company profiles.

## How to clear cache if the dashboard is not loading

If the dashboard stalls, shows partial content, or loops on a loading spinner, clear browser cache and site data for Flowdesk.

General process:

1. Open browser settings.
2. Locate **Privacy** or **Browsing Data**.
3. Clear cached images and files.
4. If needed, also clear cookies for the Flowdesk domain.
5. Close and reopen the browser.
6. Sign in again and reload the dashboard.

Before clearing cookies, make sure you know your login method, especially if your workspace uses single sign-on.

## Error codes

Flowdesk may display short technical error codes to help narrow down the problem.

- `FD-401`: Authentication failed. Your session may have expired, your password may have changed, or your single sign-on token is invalid. Sign in again and retry.
- `FD-403`: Permission denied. You are signed in, but your role does not allow the action you attempted.
- `FD-404`: Resource not found. The project, task, or file may have been deleted, moved, or you may not have access to it.
- `FD-409`: Update conflict. Another user or device changed the same record recently. Refresh the page and try again.
- `FD-422`: Validation error. One or more fields contain missing or invalid values.
- `FD-429`: Too many requests. The system is rate-limiting repeated actions. Wait a moment and retry.
- `FD-500`: Internal server error. The request failed unexpectedly on the server side.
- `FD-503`: Service temporarily unavailable. Flowdesk or a connected service may be under maintenance or experiencing a temporary outage.

If you contact support, include the exact error code, what action triggered it, and the approximate time it occurred.
