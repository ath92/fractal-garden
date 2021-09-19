precision highp float;
uniform vec2 screenSize;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;

const float hitThreshold = 0.00045;

const int CAMERA_ITERATIONS = 180;
const int LIGHT_ITERATIONS= 30;

const vec3 spaceRepetition = vec3(2, 100, 5);

vec3 getRay(vec2 xy) {
    vec2 normalizedCoords = xy - vec2(0.5);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // normalize to get unit vector
    return normalize(cameraDirection * (vec4(pixel.x, pixel.y, 1, 0))).xyz;
}

vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

float smin( float a, float b, float k )
{
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*k*(1.0/4.0);
}

float sphere(vec3 p, vec3 center, float r) {
    return distance(p, center) - r;
}

float box(vec3 p, vec3 boxdim) {
    vec3 dist = abs(p) - boxdim;
    return length(max(dist,0.0)) - min(max(dist.x, max(dist.y, dist.z)), 0.);
}

const float rx = 13.;
const float ry = 62.;
const float rz = 75.;

const vec3 building1Repeat = vec3(.4, 100, 1.);
const vec3 building2Repeat = vec3(.5, 100, 2.81);

float doModel(vec3 p) {
    float building1 = box(opRepeat(p, building1Repeat), vec3(.5, 1., .5) / 5.);
    float building2 = box(opRepeat(p, building2Repeat), vec3(.9, 1.5, .4) / 5.);
    return min(min(building1, building2), p.y + 2.); // floor
}

vec3 calcNormal(vec3 p, float h) {
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*doModel( p + k.xyy*h ) + 
                      k.yyx*doModel( p + k.yyx*h ) + 
                      k.yxy*doModel( p + k.yxy*h ) + 
                      k.xxx*doModel( p + k.xxx*h ) );
}

vec3 light = normalize(vec3(0, 1, -.5));
const float mint = 5. * hitThreshold;
const float maxt = 0.5;
const float k = 4.;
const float fogNear = 0.;
const float fogFar = 150.;
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
float trace(vec3 origin, vec3 direction, out vec3 collision, out int iterations, out float fog) {
    vec3 position = origin;
    float distanceTraveled = 0.;
    float d = 0.;
    float h = hitThreshold;
    for(int i = 0; i <= CAMERA_ITERATIONS; i++) {
        iterations = i;
        d = doModel(position);
        h = max(hitThreshold * distanceTraveled, hitThreshold / 20.);
        if (d < h) break;
        position += d * direction;
        distanceTraveled += d;
        if (distanceTraveled > fogFar) break;
    }
    fog = max(0., (distance(position, origin) - fogNear) / (fogFar - fogNear));
    if (iterations == CAMERA_ITERATIONS || distanceTraveled > fogFar) {
        iterations = 0;
        fog = 1.;
        return dot(direction, light);
    }
    collision = position;
    vec3 n = calcNormal(collision, h);
    float t = mint;
    float res = 1.0;
    float pd = 1e1;
    for (int i = 0; i < LIGHT_ITERATIONS; i++) {
        position = collision + light * t;
        d = doModel(position);
        if (d < hitThreshold){
            return 0.;
            // return (t - mint) / (maxt - mint);
        };
        if (t > maxt) {
            res = 1.;
            break;
        }
        float y = d*d/(2.0*pd);
        float h = sqrt(d*d-y*y);
        res = min( res, k*h/max(0.,t-y) );
        pd = d;
        t += d;
    }
    return max(0., res * dot(n, light));
}

float occlusion(int iterations) {
    float occlusionLight = 1. - float(iterations) / float(CAMERA_ITERATIONS);
    return occlusionLight;
}

void main() {
    vec3 direction = getRay(gl_FragCoord.xy);

    int iterations;
    vec3 collision;
    float fog;
    float lightStrength = trace(cameraPosition, direction, collision, iterations, fog);

    float d = distance(collision, cameraPosition);
    float ol = .20;
    gl_FragColor = vec4(
        vec3((ol * occlusion(iterations) + (1. - ol) * lightStrength)),
        1.
    );
    // gl_FragColor = vec4(direction * 1., 1.);
}