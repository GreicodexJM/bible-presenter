// Jet Stream - Shadertoy compatible
// Based on atmospheric flow patterns

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 6; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Flow field function for jet stream movement
vec2 flowField(vec2 p, float time) {
    vec2 flow = vec2(0.0);

    // Multiple flow layers
    flow += vec2(sin(p.y * 0.01 + time * 0.5), cos(p.x * 0.008 + time * 0.3)) * 0.3;
    flow += vec2(sin(p.y * 0.02 + time * 0.8), cos(p.x * 0.015 + time * 0.6)) * 0.2;
    flow += vec2(sin(p.y * 0.005 + time * 0.2), cos(p.x * 0.003 + time * 0.4)) * 0.4;

    return flow;
}

// Jet stream particle function
float jetStream(vec2 p, float time) {
    vec2 flow = flowField(p, time);
    vec2 distortedP = p + flow * 2.0;

    // Create stream patterns
    float streams = 0.0;

    // Horizontal jet streams
    for(int i = 0; i < 5; i++) {
        float yOffset = float(i) * 0.2 - 0.4;
        float stream = smoothstep(0.02, 0.0, abs(distortedP.y - yOffset - sin(distortedP.x * 0.1 + time * 0.3 + float(i)) * 0.05));
        streams += stream * (0.8 + 0.4 * sin(time * 0.5 + float(i)));
    }

    // Add some turbulence
    float turbulence = fbm(distortedP * 0.1 + time * 0.1) * 0.3;
    streams += turbulence;

    return clamp(streams, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = fragCoord;

    // Create atmospheric background gradient
    vec3 skyColor = mix(
        vec3(0.1, 0.2, 0.4),  // Deep blue at bottom
        vec3(0.3, 0.6, 0.9),  // Light blue at top
        pow(uv.y, 0.7)
    );

    // Add some atmospheric haze
    float haze = fbm(uv * 3.0 + iTime * 0.05) * 0.1;
    skyColor += vec3(0.1, 0.1, 0.2) * haze;

    // Generate jet stream patterns
    float streams = jetStream(p, iTime);

    // Create stream colors (white/blue streams)
    vec3 streamColor = mix(
        vec3(0.8, 0.9, 1.0),  // Bright white
        vec3(0.4, 0.7, 1.0),  // Blue-white
        streams
    );

    // Add some flow-based color variation
    vec2 flow = flowField(p, iTime);
    float flowIntensity = length(flow) * 0.5;
    streamColor += vec3(0.2, 0.3, 0.5) * flowIntensity;

    // Mix sky and streams
    vec3 finalColor = mix(skyColor, streamColor, streams * 0.7);

    // Add subtle cloud layers
    vec2 cloudUV = uv * 2.0 + iTime * 0.02;
    float clouds = fbm(cloudUV);
    clouds += fbm(cloudUV * 2.0 + iTime * 0.01) * 0.3;
    float cloudOpacity = smoothstep(0.4, 0.8, clouds) * 0.4;

    finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), cloudOpacity);

    // Add atmospheric perspective
    float depth = uv.y * 0.3;
    finalColor = mix(finalColor, skyColor * 0.8, depth);

    // Subtle vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.2;
    finalColor *= vignette;

    fragColor = vec4(finalColor, 1.0);
}
