precision highp float;
uniform vec4 color;
uniform vec2 screenSize;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection; // mat4 because gl-matrix has nice simple lookAt helper fn

const int MAX_ITER = 100;
const float HIT_THRESHOLD = 0.00001;
const float PI = 3.14159265359;

vec3 getRay() {
    // normalize fragCoord.xy to vec2 ranging from [-1, -1] to [1, 1]
    vec2 pixel = (gl_FragCoord.xy - 0.5 * screenSize) / min(screenSize.x, screenSize.y);
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, -pixel.y, 1, 0))).xyz;
}

float makeHoles(vec3 p, float h) {
  vec3 q2 = min(abs(p) - h, 0.);
  float z = -max(q2.x, q2.y);
  float y = -max(q2.x, q2.z);
  float x = -max(q2.z, q2.y);
  return max(max(x, y), z);
}

float box(vec3 p, float b) {
  vec3 q = abs(p) - b;
  float outside = length(max(q, 0.0));
  float inside = min(max(q.x, max(q.y, q.z)),  0.0);

  return outside + inside;
}

vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

const int MENGER_ITERATIONS = 5;
float menger(vec3 p, float b, float h) {
    float box = box(p, b);
    float holes = makeHoles(p, h);
    float scale = h;
    vec3 pos = p;
    for (int i = 0; i < MENGER_ITERATIONS; i++) {
        pos = p + vec3(-2. * scale, -2. * scale, -2. * scale);
        holes = max(holes, makeHoles(opRepeat(pos, vec3(1.9 * scale)), h * scale));
        scale = scale * h;
    }
    return max(box, holes);
}

float doModel(vec3 p) {

    // this is probably not a proper SDF anymore, but it looks cool
    float sint = 10. * sin(mod(0.15 * time, 2. * PI));
    vec3 p2 = vec3(p.x + sin(p.z / 10. * 0.1 * sint), p.y + cos(p.z / 10. * 0.1 * sint), p.z);

    return menger(
        opRepeat(p, vec3(12.)),
        6.,
        0.3
    );
}
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
vec3 trace(vec3 origin, vec3 direction, out int iterations, out float nearest) {
    vec3 position = origin;
    for(int i = 0; i < MAX_ITER; i++) {
        iterations = i;
        float d = doModel(position);
        nearest = min(d, nearest);
        if (d < HIT_THRESHOLD) break;
        position += d * direction;
    }
    return position;
}
// stole this from iq
vec3 calcNormal(vec3 p) {
    const float h = 0.0001;
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*doModel( p + k.xyy*h ) + 
                      k.yyx*doModel( p + k.yyx*h ) + 
                      k.yxy*doModel( p + k.yxy*h ) + 
                      k.xxx*doModel( p + k.xxx*h ) );
}

vec3 lightDirection = normalize(vec3(1, -1, -1));
float getIllumination(vec3 collision, int iterations) {
    // vec3 n = calcNormal(collision);
    float occlusionLight = 1. - float(iterations) / float(MAX_ITER);
    return occlusionLight;
    // return dot(n, lightDirection);
}

const float col = 0.05; // amount of coloring

void main() {
    vec3 origin = cameraPosition;
    vec3 position = origin;
    vec3 direction = getRay();

    float brightness = 0.;
    int iterations;
    float nearest;
    vec3 collision = trace(origin, direction, iterations, nearest);
    if (iterations < MAX_ITER - 1) { // actual collision
        brightness = getIllumination(collision, iterations);
    }
    // some cheeky colors here, because why not
    gl_FragColor = vec4(
        brightness * (1. - col) + col * sin(collision.x + time),
        brightness,
        brightness * (1. - col) + col * sin(collision.z + time),
        1.
    );
}

// lighting and material