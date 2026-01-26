import * as THREE from 'three';
import type { ThemeConfig, Theme, InputState, BibleAPIResponse } from '../types';
import { BibleService } from '../services/BibleService';
import { SentimentAnalysisService } from '../services/SentimentAnalysisService';
import { ThemeMappingService } from '../services/ThemeMappingService';

// Game state
export class Presenter3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private input: InputState;
  private animationId: number | null = null;

  // Theme
  private theme!: Theme;
  private config: any = null;

  // Bible functionality
  private bibleService: BibleService;
  private sentimentAnalysisService: SentimentAnalysisService;
  private themeMappingService: ThemeMappingService;
  private textInput: string = '';
  private currentVerse: BibleAPIResponse | null = null;

  // Cloud background
  private shaderMaterial: THREE.ShaderMaterial | null = null;

  // Text overlay elements
  private textOverlay: HTMLDivElement | null = null;
  private inputContainer: HTMLDivElement | null = null;
  private inputTextElement: HTMLInputElement | null = null;
  private verseContainer: HTMLDivElement | null = null;
  private verseTextElement: HTMLDivElement | null = null;



  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.input = {
      mouse: { x: 0, y: 0, buttons: [] },
      keyboard: {}
    };

    this.bibleService = new BibleService();
    this.sentimentAnalysisService = new SentimentAnalysisService();
    this.themeMappingService = new ThemeMappingService();

    // Load configuration and theme
    this.loadConfiguration().then(() => {
      this.init();
      this.setupEventListeners();
      this.createScene();
      this.animate();
    });
  }

  private async loadConfiguration(): Promise<void> {
    try {
      // Load main config
      const configResponse = await fetch('/config.json');
      const config = await configResponse.json();

      // Store config for later use
      this.config = config;

      // Determine initial theme to load
      const initialTheme = config.activeTheme === 'AUTO' ? 'default' : config.activeTheme;

      // Load theme configuration
      const themeResponse = await fetch(`/themes/${initialTheme}/theme.json`);
      const themeConfig: ThemeConfig = await themeResponse.json();

      // Load theme resources
      const [vertexShader, fragmentShader, inputTemplate, verseTemplate, styles] = await Promise.all([
        themeConfig.background.vertexShader ? fetch(`/themes/${initialTheme}/${themeConfig.background.vertexShader}`).then(r => r.text()) : Promise.resolve(''),
        themeConfig.background.fragmentShader ? fetch(`/themes/${initialTheme}/${themeConfig.background.fragmentShader}`).then(r => r.text()) : Promise.resolve(''),
        fetch(`/themes/${initialTheme}/templates/${themeConfig.input.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${initialTheme}/templates/${themeConfig.verse.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${initialTheme}/styles/animations.css`).then(r => r.text())
      ]);

      // Inject Styles
      if (styles) {
        const oldStyle = document.getElementById('theme-styles');
        if (oldStyle) oldStyle.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'theme-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }

      // Load textures
      const textureLoader = new THREE.TextureLoader();
      const loadedTextures: THREE.Texture[] = [];

      if (themeConfig.background.textures && themeConfig.background.textures.length > 0) {
        const texturePromises = themeConfig.background.textures.map(textureFile => {
          return new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              `/themes/${initialTheme}/images/${textureFile}`,
              (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                resolve(texture);
              },
              undefined,
              (err) => {
                console.error(`Failed to load texture: ${textureFile}`, err);
                // Return a basic placeholder texture on error to prevent crashes
                reject(new THREE.Texture());
              }
            );
          });
        });

        const textures = await Promise.all(texturePromises);
        loadedTextures.push(...textures);
      }

      this.theme = {
        config: themeConfig,
        backgroundShaders: {
          vertex: vertexShader,
          fragment: fragmentShader
        },
        loadedTextures: loadedTextures,
        inputTemplate: inputTemplate,
        verseTemplate: verseTemplate,
        styles: styles
      };

      // Load translation data
      const translationResponse = await fetch(`/translations/${config.activeTranslation}.json`);
      this.bibleService.loadTranslation(await translationResponse.json());

    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to a basic default theme
      const fallbackConfig: ThemeConfig = {
        name: 'Default',
        background: {
          type: 'shader',
          vertexShader: 'default.vert',
          fragmentShader: 'default.frag',
          uniforms: {
            time: { type: 'float', value: 0.0 },
            resolution: { type: 'vec2', value: [1920, 1080] }
          }
        },
        input: {
          backgroundImage: 'input.svg',
          position: { x: '50%', y: '40%' },
          size: { width: '600px', height: '80px' }
        },
        verse: {
          backgroundImage: 'verse.svg',
          position: { x: '50%', y: '60%' },
          size: { width: '800px', height: '200px' }
        },
        transitions: {
          animDuration: 500,
          easing: 'ease-in-out'
        }
      };
      this.theme = { config: fallbackConfig };
    }
  }

  private init(): void {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000011, 1);
    document.getElementById('app')!.appendChild(this.renderer.domElement);

    // Create overlay container for text elements
    this.createTextOverlay();
    this.createMobileControls();

    // Setup camera
    this.camera.position.z = 5;

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private createMobileControls(): void {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'mobile-controls';
    controlsContainer.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: center;
      gap: 30px;
      z-index: 20;
      pointer-events: none;
    `;

    const buttonStyle = `
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: background 0.2s;
    `;

    const createButton = (svgPath: string, onClick: () => void) => {
      const btn = document.createElement('div');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="rgba(255, 255, 255, 0.9)"><path d="${svgPath}"/></svg>`;
      btn.style.cssText = buttonStyle;

      const handleInteraction = (e: Event) => {
        if (e.type === 'touchstart') e.preventDefault();
        onClick();
      };
      
      btn.addEventListener('click', handleInteraction);
      btn.addEventListener('touchstart', handleInteraction, { passive: false });

      // Add simple hover/active effect
      btn.addEventListener('mousedown', () => btn.style.background = 'rgba(255, 255, 255, 0.3)');
      btn.addEventListener('mouseup', () => btn.style.background = 'rgba(255, 255, 255, 0.15)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255, 255, 255, 0.15)');
      btn.addEventListener('touchstart', () => btn.style.background = 'rgba(255, 255, 255, 0.3)', { passive: true });
      btn.addEventListener('touchend', () => btn.style.background = 'rgba(255, 255, 255, 0.15)');
      
      return btn;
    };

    // Previous Button
    const prevBtn = createButton(
      'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
      () => this.handleVerseNavigation('ArrowLeft')
    );
    
    // Search/Input Button
    const searchBtn = createButton(
      'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
      () => {
        this.showInputText();
        // Give time for display:block to happen before focusing
        setTimeout(() => {
          if (this.inputTextElement) {
            this.inputTextElement.focus();
            // Try to trigger mobile keyboard explicitly
            this.inputTextElement.click(); 
          }
        }, 50);
      }
    );

    // Next Button
    const nextBtn = createButton(
      'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
      () => this.handleVerseNavigation('ArrowRight')
    );

    controlsContainer.appendChild(prevBtn);
    controlsContainer.appendChild(searchBtn);
    controlsContainer.appendChild(nextBtn);

    document.getElementById('app')!.appendChild(controlsContainer);

    // Auto-hide logic for desktop (devices with hover capability)
    const hasHover = window.matchMedia('(hover: hover)').matches;
    
    if (hasHover) {
      controlsContainer.style.opacity = '0';
      controlsContainer.style.transition = 'opacity 0.3s ease-in-out';
      
      let hideTimeout: number;
      
      const showControls = () => {
        controlsContainer.style.opacity = '1';
        window.clearTimeout(hideTimeout);
        hideTimeout = window.setTimeout(() => {
          controlsContainer.style.opacity = '0';
        }, 3000);
      };

      document.addEventListener('mousemove', showControls);
      document.addEventListener('mousedown', showControls);
      document.addEventListener('keydown', showControls);
    }
  }

  private createTextOverlay(): void {
    // Create overlay container
    this.textOverlay = document.createElement('div');
    this.textOverlay.id = 'text-overlay';
    this.textOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    // Create input container (for SVG background)
    this.inputContainer = document.createElement('div');
    this.inputContainer.id = 'bible-input-container';
    this.inputContainer.style.cssText = `
      position: absolute;
      left: ${this.theme.config.input.position.x};
      top: ${this.theme.config.input.position.y};
      width: ${this.theme.config.input.size.width};
      height: ${this.theme.config.input.size.height};
      display: none;
      z-index: 11;
      pointer-events: auto;
    `;

    // Create native input element
    this.inputTextElement = document.createElement('input');
    this.inputTextElement.type = 'text';
    this.inputTextElement.id = 'bible-input';
    this.inputTextElement.style.cssText = `
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: #ffffff;
      font-size: 24px;
      text-align: center;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 0 5px rgba(0,0,0,0.5);
    `;

    // Add event listeners for native input
    this.inputTextElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.processBibleReference();
      } else if (e.key === 'Escape') {
        this.hideInputText();
      }
    });

    this.inputTextElement.addEventListener('input', (e) => {
      this.textInput = (e.target as HTMLInputElement).value;
    });

    this.inputContainer.appendChild(this.inputTextElement);

    // Create verse container (for SVG background)
    this.verseContainer = document.createElement('div');
    this.verseContainer.id = 'bible-verse-container';
    this.verseContainer.style.cssText = `
      position: absolute;
      left: ${this.theme.config.verse.position.x};
      top: ${this.theme.config.verse.position.y};
      width: ${this.theme.config.verse.size.width};
      height: ${this.theme.config.verse.size.height};
      display: none;
      z-index: 11;
      pointer-events: none;
    `;

    // Create verse text element (for HTML text content)
    this.verseTextElement = document.createElement('div');
    this.verseTextElement.id = 'bible-verse-text';
    this.verseTextElement.style.cssText = `
      position: absolute;
      left: ${this.theme.config.verse.position.x};
      top: ${this.theme.config.verse.position.y};
      width: ${this.theme.config.verse.size.width};
      height: ${this.theme.config.verse.size.height};
      font-size: 28px;
      color: #ffffff;
      text-align: center;
      white-space: pre-wrap;
      display: none;
      z-index: 12;
      line-height: 1.4;
      pointer-events: none;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 0 5px rgba(0,0,0,0.5);
    `;

    // Add elements to overlay
    this.textOverlay.appendChild(this.inputContainer);
    this.textOverlay.appendChild(this.verseContainer);
    this.textOverlay.appendChild(this.verseTextElement);

    // Add overlay to app
    document.getElementById('app')!.appendChild(this.textOverlay);
  }

  private setupEventListeners(): void {
    // Mouse events
    document.addEventListener('mousemove', (event) => {
      this.input.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.input.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    document.addEventListener('mousedown', (event) => {
      this.input.mouse.buttons[event.button] = true;
    });

    document.addEventListener('mouseup', (event) => {
      this.input.mouse.buttons[event.button] = false;
    });

    // Keyboard events
    document.addEventListener('keydown', (event) => {
      this.input.keyboard[event.code] = true;

      // Handle Verse Navigation
      if (this.currentVerse) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          this.handleVerseNavigation(event.key);
          return;
        }
      }

      // Auto-focus input on typing (if not already focused and not a control key)
      if (!this.inputTextElement) return;
      if (document.activeElement !== this.inputTextElement) {
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          this.showInputText();
          this.inputTextElement.focus();
          // We don't prevent default here so the key goes to the input
        } else if (event.key === 'Enter') {
          this.showInputText();
          this.inputTextElement.focus();
        }
      }
    });

    document.addEventListener('keyup', (event) => {
      this.input.keyboard[event.code] = false;
    });

    // Prevent context menu
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private createScene(): void {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Create animated cloud background
    this.createShaderBackground();
  }

  private createShaderBackground(): void {
    if (this.theme.config.background.type !== 'shader') return;

    // Use loaded shaders if available, otherwise fallback to inline shaders
    const vertexShader = this.theme.backgroundShaders?.vertex || `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Convert Shadertoy fragment shader to WebGL compatible format
    let fragmentShader = this.theme.backgroundShaders?.fragment || `
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec2 iMouse;

      // Test Shadertoy shader - Simple gradient
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
          vec2 uv = fragCoord / iResolution.xy;
          vec3 col = vec3(uv.x, uv.y, 0.5);
          fragColor = vec4(col, 1.0);
      }

      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    // Check if this is a Shadertoy-style shader (has mainImage function)
    const hasMainImage = fragmentShader.includes('mainImage');

    if (hasMainImage) {
      // Convert Shadertoy shader to WebGL format
      fragmentShader = this.convertShadertoyToWebGL(fragmentShader);
    } else {
      // Use as-is (already WebGL format)
      fragmentShader = fragmentShader;
    }

    // Create shader material with Shadertoy-compatible uniforms
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        iTime: { value: 0.0 },
        iTimeDelta: { value: 0.016 },
        iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
        iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
        iFrame: { value: 0 },
        iFrameRate: { value: 60.0 },
        iChannel0: { value: this.theme.loadedTextures?.[0] || null },
        iChannel1: { value: this.theme.loadedTextures?.[1] || null },
        iChannel2: { value: this.theme.loadedTextures?.[2] || null },
        iChannel3: { value: this.theme.loadedTextures?.[3] || null },
        iChannelTime: { value: [0.0, 0.0, 0.0, 0.0] },
        iChannelResolution: {
          value: [
            this.theme.loadedTextures?.[0]?.image ? new THREE.Vector3((this.theme.loadedTextures[0].image as any).width || window.innerWidth, (this.theme.loadedTextures[0].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[1]?.image ? new THREE.Vector3((this.theme.loadedTextures[1].image as any).width || window.innerWidth, (this.theme.loadedTextures[1].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[2]?.image ? new THREE.Vector3((this.theme.loadedTextures[2].image as any).width || window.innerWidth, (this.theme.loadedTextures[2].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[3]?.image ? new THREE.Vector3((this.theme.loadedTextures[3].image as any).width || window.innerWidth, (this.theme.loadedTextures[3].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0)
          ]
        },
        iDate: { value: new THREE.Vector4() },
        iSampleRate: { value: 44100.0 }
      },
      side: THREE.BackSide
    });

    // Create large sphere for skybox
    const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
    const skyMesh = new THREE.Mesh(skyGeometry, shaderMaterial);
    this.scene.add(skyMesh);

    // Store material reference for animation
    this.shaderMaterial = shaderMaterial;

    // Update resolution on window resize
    window.addEventListener('resize', () => {
      if (this.shaderMaterial) {
        this.shaderMaterial.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
      }
    });
  }

  private convertShadertoyToWebGL(shadertoyCode: string): string {
    // Add Shadertoy uniforms at the top if not already present
    let webGLShader = shadertoyCode;

    // Ensure we have the standard Shadertoy uniforms
    const uniforms = `
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform float iFrameRate;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec4 iDate;
uniform float iSampleRate;
`;

    // Add uniforms if not already present
    if (!webGLShader.includes('uniform vec3 iResolution;')) {
      // Find the first non-comment, non-empty line after precision declarations
      const lines = webGLShader.split('\n');
      let insertIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('precision') || line === '') {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      lines.splice(insertIndex, 0, uniforms);
      webGLShader = lines.join('\n');
    }

    // Ensure mainImage is called from main if not already done
    if (!webGLShader.includes('void main()')) {
      webGLShader += `

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}`;
    }

    return webGLShader;
  }

  private lastTime: number = 0;

  // Main Loop
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    // Update cloud animation with Shadertoy-compatible uniforms
    if (this.shaderMaterial) {
      const now = performance.now();
      const deltaTime = (now - this.lastTime) * 0.001; // Convert to seconds
      this.lastTime = now;

      this.shaderMaterial.uniforms.iTime.value = now * 0.001;
      this.shaderMaterial.uniforms.iTimeDelta.value = deltaTime;
      this.shaderMaterial.uniforms.iFrame.value++;
      this.shaderMaterial.uniforms.iFrameRate.value = 60.0;

      // Update mouse position (normalized 0-1)
      this.shaderMaterial.uniforms.iMouse.value.set(
        (this.input.mouse.x + 1) * 0.5 * window.innerWidth,
        (1 - (this.input.mouse.y + 1) * 0.5) * window.innerHeight
      );

      // Update date (simplified)
      const date = new Date();
      this.shaderMaterial.uniforms.iDate.value.set(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
      );

      // Update channel times (for video textures, if any)
      if (this.shaderMaterial.uniforms.iChannelTime) {
        this.shaderMaterial.uniforms.iChannelTime.value[0] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[1] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[2] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[3] = now * 0.001;
      }

      // Update channel resolutions (default values)
      if (this.shaderMaterial.uniforms.iChannelResolution) {
        const res = new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0);
        this.shaderMaterial.uniforms.iChannelResolution.value[0].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[1].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[2].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[3].copy(res);
      }

      // Update sample rate (for audio, if any)
      this.shaderMaterial.uniforms.iSampleRate.value = 44100.0;
    }

    this.handleInput();
    this.renderer.render(this.scene, this.camera);
  };

  private handleInput(): void {
    // Movement disabled as requested.
    // We can use this hook for other per-frame input logic if needed.

  }

  private async handleVerseNavigation(keyCode: string): Promise<void> {
    if (!this.currentVerse || this.currentVerse.verses.length === 0) return;

    const currentVerse = this.currentVerse.verses[0];
    let newBook = currentVerse.book;
    let newChapter = currentVerse.chapter;
    let newVerse = currentVerse.verse;

    switch (keyCode) {
      case 'ArrowRight':
      case 'ArrowDown':
        newVerse++;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newVerse--;
        break;
    }

    // Hide current verse with exit transition, then load new verse
    await this.hideVerseText();
    this.currentVerse = null;

    // Load new verse after exit transition completes (0.8s)
    await this.loadVerse(newBook, newChapter, newVerse);
  }

  private async processBibleReference(): Promise<void> {
    const reference = this.bibleService.parseReference(this.textInput);
    if (reference) {
      await this.loadVerse(reference.book, reference.chapter, reference.verse);
    }

    // Hide input text immediately (CSS transitions will handle animation)
    this.hideInputText();
    this.textInput = '';
    if (this.inputTextElement) {
      this.inputTextElement.value = '';
    }
  }

  private async loadVerse(book: string, chapter: number, verse: number): Promise<void> {

    const verseData = await this.bibleService.getVerse(book, chapter, verse);

    if (verseData) {
      this.currentVerse = verseData;

      // Handle AUTO theme selection
      if (this.config.activeTheme === 'AUTO') {
        await this.selectThemeForVerse(verseData);
      }

      return await this.showVerseText();
    }
    return await this.hideVerseText();
  }

  /**
   * Analyzes verse content and selects an appropriate theme for AUTO mode
   */
  private async selectThemeForVerse(verseData: BibleAPIResponse): Promise<void> {
    // Analyze the verse sentiment
    const sentiment = this.sentimentAnalysisService.analyzeVerse(verseData.text);

    // Create a unique key for this verse to enable caching
    const verseKey = `${verseData.verses[0].book}-${verseData.verses[0].chapter}-${verseData.verses[0].verse}`;

    // Map sentiment to theme with confidence consideration
    const selectedTheme = this.themeMappingService.mapToneToThemeWithConfidence(
      sentiment.primaryTone,
      sentiment.confidence,
      sentiment.secondaryTones,
      verseKey
    );

    // Only switch themes if different from current
    if (selectedTheme !== this.theme.config.name.toLowerCase()) {
      await this.loadTheme(selectedTheme);
    }
  }

  /**
   * Dynamically loads a new theme
   */
  private async loadTheme(themeName: string): Promise<void> {
    try {
      // Load theme configuration
      const themeResponse = await fetch(`/themes/${themeName}/theme.json`);
      const themeConfig: ThemeConfig = await themeResponse.json();

      // Load theme resources
      const [vertexShader, fragmentShader, inputTemplate, verseTemplate, styles] = await Promise.all([
        themeConfig.background.vertexShader ? fetch(`/themes/${themeName}/${themeConfig.background.vertexShader}`).then(r => r.text()) : Promise.resolve(''),
        themeConfig.background.fragmentShader ? fetch(`/themes/${themeName}/${themeConfig.background.fragmentShader}`).then(r => r.text()) : Promise.resolve(''),
        fetch(`/themes/${themeName}/templates/${themeConfig.input.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${themeName}/templates/${themeConfig.verse.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${themeName}/styles/animations.css`).then(r => r.text())
      ]);

      // Inject new styles
      if (styles) {
        const oldStyle = document.getElementById('theme-styles');
        if (oldStyle) oldStyle.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'theme-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }

      // Load textures
      const textureLoader = new THREE.TextureLoader();
      const loadedTextures: THREE.Texture[] = [];

      if (themeConfig.background.textures && themeConfig.background.textures.length > 0) {
        const texturePromises = themeConfig.background.textures.map(textureFile => {
          return new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              `/themes/${themeName}/images/${textureFile}`,
              (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                resolve(texture);
              },
              undefined,
              (err) => {
                console.error(`Failed to load texture: ${textureFile}`, err);
                reject(new THREE.Texture());
              }
            );
          });
        });

        const textures = await Promise.all(texturePromises);
        loadedTextures.push(...textures);
      }

      // Update theme
      this.theme = {
        config: themeConfig,
        backgroundShaders: {
          vertex: vertexShader,
          fragment: fragmentShader
        },
        loadedTextures: loadedTextures,
        inputTemplate: inputTemplate,
        verseTemplate: verseTemplate,
        styles: styles
      };

      // Update shader background with new theme
      this.createShaderBackground();

      console.log(`Switched to theme: ${themeName} (${themeConfig.name})`);

    } catch (error) {
      console.error(`Failed to load theme ${themeName}:`, error);
      // Keep current theme on error
    }
  }

  private async showInputText(): Promise<void> {
    if (!this.inputContainer || !this.inputTextElement || !this.theme.inputTemplate) return;

    // const displayText = ''; // No text in SVG, native input handles text

    // Replace template variables in SVG (remove text)
    let svgContent = this.theme.inputTemplate
      .replace(/\{\{text\}\}/g, '');

    // Convert SVG to data URL for background image
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    // Apply SVG as background image
    this.inputContainer.style.backgroundImage = `url("${svgDataUrl}")`;
    this.inputContainer.style.backgroundSize = '100% 100%';
    this.inputContainer.style.backgroundRepeat = 'no-repeat';
    this.inputContainer.style.backgroundPosition = 'center';

    this.inputContainer.style.display = 'block';
    this.inputTextElement.focus();
    this.hideVerseText();

    // Apply theme enter transition
    return await this.applyTransition(this.inputContainer, this.theme.config.input.enterClass, this.theme.config.input.enterActiveClass, true);
  }



  /**
   * Applies CSS transition animation to an element
   * @param element The HTML element to animate
   * @param initialClass The initial CSS class to apply
   * @param activeClass The active CSS class to add after initial class
   * @param isShow Whether this is a show transition (true) or hide transition (false)
   * @returns Promise that resolves when the transition completes
   */
  private applyTransition(element: HTMLElement | null, initialClass?: string, activeClass?: string, isShow: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      if (!element || !initialClass) {
        // Fallback if no transition classes defined
        if (!isShow && element) {
          element.style.display = 'none';
        }
        resolve(); // Resolve immediately
        return;
      }

      // Apply initial class
      element.className = initialClass;

      // Add active class on next frame for smooth transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (activeClass && element) {
            element.classList.add(activeClass);
            // Resolve after transition completes
            setTimeout(() => {
              // For hide transitions, hide element after animation completes
              if (!isShow && element) {
                element.style.display = 'none';
              }
              resolve();
            }, this.theme.config.transitions.animDuration);

          }
        });
      });


    });
  }

  private async showVerseText(): Promise<void> {
    if (!this.currentVerse || !this.verseContainer || !this.verseTextElement || !this.theme.verseTemplate) return;

    const reference = this.currentVerse.reference;
    const text = this.currentVerse.text;

    // Replace template variables in SVG (remove text for background)
    let svgContent = this.theme.verseTemplate
      .replace(/\{\{reference\}\}/g, '')
      .replace(/\{\{text\}\}/g, '');

    // Convert SVG to data URL for background image
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    // Apply SVG as background image to container
    this.verseContainer.style.backgroundImage = `url("${svgDataUrl}")`;
    this.verseContainer.style.backgroundSize = '100% 100%';
    this.verseContainer.style.backgroundRepeat = 'no-repeat';
    this.verseContainer.style.backgroundPosition = 'center';
    this.verseContainer.style.padding='1em';

    // Set text content in HTML element
    this.verseTextElement.innerHTML = `<div class="reference">${reference}</div><div class="cite" >${text}</div>`;

    // Show both elements
    this.verseContainer.style.display = 'block';
    this.verseTextElement.style.display = 'block';

    // Apply theme enter transition to container
    const p = await this.applyTransition(this.verseContainer, this.theme.config.verse.enterClass, this.theme.config.verse.enterActiveClass, true);

    // Position both elements
    const position = this.theme.config.verse.position;
    const size = this.theme.config.verse.size;

    this.verseContainer.style.left = position.x;
    this.verseContainer.style.top = position.y;
    this.verseContainer.style.width = size.width;
    this.verseContainer.style.height = size.height;

    this.verseTextElement.style.left = position.x;
    this.verseTextElement.style.top = position.y;
    this.verseTextElement.style.width = size.width;
    this.verseTextElement.style.height = size.height;
    return p;
  }

  private async hideInputText(): Promise<void> {
    // Apply theme exit transition
    return await this.applyTransition(this.inputContainer, this.theme.config.input.exitClass, this.theme.config.input.exitActiveClass, false);
  }


  private async hideVerseText(): Promise<void> {
    this.currentVerse = null;
    // Apply theme exit transition to container
    const ret = await this.applyTransition(this.verseContainer, this.theme.config.verse.exitClass, this.theme.config.verse.exitActiveClass, false);

    // Also hide the text element immediately (no transition needed for text)
    if (this.verseTextElement) {
      this.verseTextElement.style.display = 'none';
    }
    return ret;
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}
