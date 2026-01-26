# System Patterns

## Architecture
The application follows a simple, component-based architecture typical of game loops or interactive 3D applications.

### Core Components
-   **`main.ts`**: Entry point. Initializes `Presenter3D` and handles global lifecycle events (unload).
-   **`Presenter3D.ts`**: The central controller.
    -   Manages the Three.js scene (Camera, Renderer, Scene).
    -   Handles the render loop (`animate`).
    -   Manages user input (Keyboard, Mouse).
    -   Orchestrates services (`BibleService`, `SentimentAnalysisService`, `ThemeMappingService`).
    -   Manages the DOM overlay for text display.
    -   Handles theme loading and switching.

### Services
-   **`BibleService`**: Responsible for loading translation JSON data and querying for verses. It also parses user input strings into book/chapter/verse references.
-   **`SentimentAnalysisService`**: Analyzes verse text to determine emotional tone.
-   **`ThemeMappingService`**: Maps sentiment analysis results to specific visual themes.

### Data Flow
1.  **Input**: User types text -> `Presenter3D` captures input.
2.  **Processing**: `Presenter3D` calls `BibleService.parseReference` then `BibleService.getVerse`.
3.  **Theme Selection (Optional)**: If AUTO mode is on, `Presenter3D` calls `SentimentAnalysisService` -> `ThemeMappingService` -> `loadTheme`.
4.  **Rendering**:
    -   3D Background: Updated every frame in `animate` loop (updating uniforms like `iTime`).
    -   UI Overlay: Updated via DOM manipulation when verse data changes.

## Design Patterns
-   **Singleton/Manager**: `Presenter3D` acts as a manager for the entire presentation state.
-   **Service Layer**: Logic for specific domains (Bible data, Sentiment) is encapsulated in stateless services.
-   **Configuration-Driven**: Heavy reliance on `config.json` and theme-specific `theme.json` files to drive behavior and visuals.
-   **Ports and Adapters (Loose)**: While not strictly Hexagonal, the services decouple the core presentation logic from the data sources.

## Theme System
Themes are self-contained in the `themes/` directory. Each theme has:
-   `theme.json`: Configuration.
-   Shaders (`.vert`, `.frag`).
-   Templates (SVG) for input and verse backgrounds.
-   Images/Textures.
-   Styles (CSS).
