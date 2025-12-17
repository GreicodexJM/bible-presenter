import * as THREE from 'three';

// Theme configuration
export interface ThemeConfig {
  name: string;
  background: {
    type: 'shader' | 'solid' | 'gradient' | 'texture';
    vertexShader?: string;
    fragmentShader?: string;
    uniforms?: { [key: string]: { type: string; value: any } };
    textures?: string[];
    animationClass?: string;
    skyColorTop?: string;
    skyColorBottom?: string;
    cloudColor?: string;
    animationSpeed?: number;
    gradientColors?: string[];
    textureUrl?: string;
    opacity?: number;
  };
  input: {
    backgroundImage: string;
    position: { x: string; y: string };
    size: { width: string; height: string };
    enterClass?: string;
    enterActiveClass?: string;
    exitClass?: string;
    exitActiveClass?: string;
  };
  verse: {
    backgroundImage: string;
    position: { x: string; y: string };
    size: { width: string; height: string };
    enterClass?: string;
    enterActiveClass?: string;
    exitClass?: string;
    exitActiveClass?: string;
  };
  transitions: {
    animDuration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
}

// Runtime theme object
export interface Theme {
  config: ThemeConfig;
  backgroundShaders?: {
    vertex: string;
    fragment: string;
  };
  loadedTextures?: THREE.Texture[];
  inputTemplate?: string;
  verseTemplate?: string;
  styles?: string;
}

// Bible API interfaces
export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleAPIResponse {
  reference: string;
  verses: BibleVerse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

// Input state
export interface InputState {
  mouse: {
    x: number;
    y: number;
    buttons: boolean[];
  };
  keyboard: {
    [key: string]: boolean;
  };
}
