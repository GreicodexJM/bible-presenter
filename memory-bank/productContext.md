# Product Context

## Problem Statement
Traditional Bible presentation software often relies on static 2D backgrounds or simple video loops. "Bible Show" aims to elevate the visual experience by using real-time 3D rendering and procedural shaders to create dynamic, atmospheric backdrops that complement the text.

## User Experience
1.  **Launch**: The user opens the application in a browser. A default 3D scene (e.g., clouds) is rendered.
2.  **Input**: The user types a reference (e.g., "John 3:16") directly. An input overlay appears.
3.  **Display**: Upon pressing Enter, the verse text is retrieved and displayed with a beautiful overlay. The background may change to reflect the mood of the verse (if AUTO theme is enabled).
4.  **Navigation**: The user can navigate to adjacent verses using arrow keys.

## Key Features
-   **Real-time 3D Backgrounds**: Utilizing WebGL shaders for procedural clouds, gradients, and other effects.
-   **Sentiment Analysis**: The application can analyze the text of the verse to determine its emotional tone (joy, sorrow, warning, etc.) and automatically select an appropriate visual theme.
-   **Theme System**: Extensible JSON-based theme configuration allowing for custom backgrounds, shaders, and text styles.
-   **Offline Capable**: Once loaded, the application runs locally without needing an active internet connection (relying on local JSON data).
