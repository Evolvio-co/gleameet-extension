# Evolvio — Chrome Web Store Submission Pack

**Product:** Evolvio — AI Meeting Coach
**Package version:** 1.0.124
**Upload artifact:** `store-release/evolvio-extension-store-1.0.124.zip`
**Store:** Chrome Web Store (not Google Play)

## 1. Listing copy

### Name
Evolvio — AI Meeting Coach

### Short description
Private, real-time coaching prompts for Google Meet, Zoom, and Teams web meetings.

### Detailed description
Evolvio is a private AI meeting coach for Google Meet, Zoom Web, and Microsoft Teams Web. Start coaching when you want focused, real-time support during a browser meeting.

Evolvio analyzes the audio mode you select and delivers brief coaching prompts privately in your meeting tab. Prompts are visible only to you. After you end a coaching session, Evolvio can generate a post-meeting report with communication patterns and next steps.

Choose the capture mode that fits your meeting:

- **Only my voice:** uses your microphone input for coaching.
- **Full meeting:** when you explicitly select it, Evolvio can also use meeting-tab audio or captions for broader context.

Evolvio supports Google Meet, Zoom Web, and Microsoft Teams Web. It does not support the desktop Zoom or Teams applications.

## 2. Single purpose statement

Evolvio provides private, real-time communication coaching and post-meeting feedback to the signed-in user during supported browser-based meetings.

## 3. Permission justifications

| Permission | Why Evolvio needs it |
| --- | --- |
| `tabCapture` | Captures meeting-tab audio only when the user explicitly selects full-meeting mode. |
| `activeTab` | Identifies the currently active supported meeting tab when the user opens the extension. |
| `tabs` | Finds an already-open supported meeting tab and keeps coaching associated with that tab. |
| `scripting` | Injects Evolvio's private coaching overlay into a supported meeting page. |
| `offscreen` | Processes live audio capture without keeping the popup open. |
| `storage` | Stores sign-in/session state, user-selected capture mode, and extension settings locally. |
| `alarms` | Polls for new coaching prompts and maintains active-session state. |
| `identity` | Signs the user in with Google using OpenID Connect; only `openid`, `email`, and `profile` scopes are requested. |
| Meeting-site host permissions | Enables the overlay and meeting detection only on Google Meet, Zoom Web, and Microsoft Teams Web. |
| Evolvio API host permission | Sends authenticated transcript/audio requests and retrieves private coaching prompts from Evolvio's backend. |

Microphone access is **not** a manifest permission. When the user clicks **Start Coaching** on a supported meeting page, Evolvio requests microphone access through Chrome's standard page-level `getUserMedia` flow. If the user declines, coaching does not start.

## 4. Privacy-practices answers

Use these answers in the Chrome Web Store **Privacy practices** form. Review against the live service before submission.

### Data handled

| Data category | Collected/processed | Purpose | Shared/sold |
| --- | --- | --- | --- |
| Google email address and display name | Yes, at sign-in | Account authentication and account association | Not sold; processed by service providers only to operate Evolvio |
| Microphone audio | Yes, only after the user starts coaching | Real-time transcription and coaching | Not sold |
| Meeting-tab audio/captions | Only in user-selected full-meeting mode | Meeting-context coaching | Not sold |
| Transcript excerpts and derived communication metrics | Yes | Live prompts and post-meeting reports | Not sold |
| Coaching prompts and meeting reports | Yes | Deliver feedback and show meeting history | Not sold |

### Required declarations

- Evolvio does **not** sell user data.
- Evolvio does **not** use user data to determine creditworthiness or for lending purposes.
- Evolvio does **not** use user data for personalized advertising.
- Evolvio does **not** use user data to train AI models.
- Audio capture begins only after the user chooses **Start Coaching**.
- Full-meeting capture is optional and must be selected by the user. Users are responsible for obtaining any required participant consent before enabling it.

### Data retention

The current privacy policy states a 365-day default retention period for raw transcripts, derived metrics, coaching prompts, and meeting reports. Confirm that the live deletion process enforces this before submitting.

## 5. Privacy and support URLs

Before submission, host these at stable public HTTPS URLs under an Evolvio-controlled domain:

- **Privacy policy:** publish the contents of `public/privacy.html` at a public URL, e.g. `https://evolvio.co/privacy`.
- **Support:** publish a support page or use a monitored support email, e.g. `support@evolvio.co`.

The existing policy contact is `rajiv.chandrasekaran@paintrobot.ai`. Replace it with the intended Evolvio support address before publishing if that mailbox will not be the support channel.

## 6. Reviewer instructions

### Test account

Provide Chrome Web Store reviewers with a dedicated test Google account that has access to the Evolvio backend. Do not place credentials in this document or in the public listing.

### Review flow

1. Install the submitted zip in Chrome and pin Evolvio.
2. Open a supported browser meeting: Google Meet, Zoom Web, or Teams Web.
3. Click the Evolvio icon and sign in with the supplied test account.
4. Select **Only my voice** for microphone-only coaching, or explicitly select **Full meeting** to permit meeting-tab audio/context.
5. Click **Start Coaching** and approve Chrome's microphone prompt. A private Evolvio overlay appears only in the reviewer’s meeting tab.
6. Speak for a short period. Evolvio sends transcript audio to its backend and shows private coaching prompts when generated.
7. Click **Stop Coaching** to pause capture, or **End Meeting** to create a post-meeting report.

### Why audio permissions are necessary

The product’s single purpose is real-time communication coaching. Audio is the required input for transcription and coaching. The extension does not begin audio capture until the user starts coaching, and full-meeting tab capture is user-selected rather than default.

## 7. Assets required in the developer dashboard

Prepare these outside this repository and upload them in the Chrome Web Store developer dashboard:

- A **128 × 128 px** store icon (the package already contains `public/icons/icon-128.png`).
- At least one screenshot; prepare **3–5** Chrome screenshots showing: sign-in/start coaching, the private prompt overlay, capture-mode choice, and a post-meeting report.
- A small promotional tile and marquee promotional tile only if the dashboard requests or you plan a featured placement.

Do not use screenshots that show real meeting participants, personal data, or transcript content without written permission. Prefer staged/demo content.

## 8. Pre-submit checklist

- [ ] Run `bash scripts/package-store.sh` from the repository root.
- [ ] Upload the exact package `store-release/evolvio-extension-store-1.0.124.zip`.
- [ ] Verify package manifest version is `1.0.124`.
- [ ] Verify the upload manifest has no top-level `key` field and that `manifest.json` is at the ZIP root.
- [ ] After Chrome assigns the Store extension ID, register that ID with the Google OAuth Chrome-extension client before enabling production sign-in.
- [ ] Verify the live backend URL in the manifest is current.
- [ ] Publish and test the public privacy-policy URL.
- [ ] Publish and test the support URL/email.
- [ ] Provide a reviewer test account and use it to test sign-in.
- [ ] Confirm coaching prompts, transcription, and reports work against production.
- [ ] Confirm the deletion/retention behavior stated in the privacy policy.
- [ ] Capture/store screenshots using only staged or consented content.
- [ ] Complete the Chrome Web Store privacy-practices form with the declarations above.

## 9. Release notes

**Version 1.0.124**

- Removes the invalid `audioCapture` manifest permission.
- Removes the popup microphone preflight and restores page-level microphone capture on supported meeting pages.
- Uses 30-second transcript/coaching windows while keeping the locked listing name and description, full-meeting capture choice, and `tabs` permission.
