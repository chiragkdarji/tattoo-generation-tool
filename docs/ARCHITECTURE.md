# Architecture & Technology Stack

## Frontend
- **Framework**: Vanilla JavaScript (ESM)
- **Styling**: Vanilla CSS with modern Glassmorphism aesthetics.
- **Authentication**: Firebase Auth (Google Login).
- **Communication**: Asynchronous Fetch API for backend interaction.

## Backend
- **Framework**: Node.js with Express.
- **Image Processing**: Jimp (Node.js) and Python (OpenCV) for high-quality stencil extraction.
- **Security**: Environment variable masking, Firebase Admin SDK for backend-only database writes.
- **CORS**: Configured to allow cross-origin requests from the Firebase deployment.

## Cloud Services
- **Firestore**: User metadata and credit tracking.
- **Firebase Storage**: Persistent storage for generated images and stencils.
- **Firebase Hosting**: Static asset hosting (Frontend).
- **Render**: Dynamic web service hosting (Backend).
