uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

// Simple noise function
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Fractal noise
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

void main() {
    vec2 uv = vUv;

    // Create animated clouds
    vec2 cloudUV = uv * 3.0 + time * 0.05;
    float clouds = fbm(cloudUV);

    // Add some variation
    //clouds += fbm(cloudUV * 2.0 + time * 0.03) * 0.3;
    //clouds += fbm(cloudUV * 4.0 + time * 0.01) * 0.1;

    // Create sky gradient (blue to light blue)
    vec3 skyColor = mix(
        vec3(0.2, 0.4, 0.8),  // Deeper blue
        vec3(0.4, 0.6, 0.9),  // Light blue
        uv.y
    );

    // Mix clouds with sky
    float cloudOpacity = smoothstep(0.3, 0.7, clouds);
    vec3 finalColor = mix(skyColor, vec3(1.0, 1.0, 1.0), cloudOpacity * 0.8);

    gl_FragColor = vec4(skyColor, 1.0);
}
