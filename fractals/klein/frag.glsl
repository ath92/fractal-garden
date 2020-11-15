precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;
uniform bool onlyDistance;
uniform float scrollX;
uniform float scrollY;

const float hitThreshold = 0.00003;

const int CAMERA_ITERATIONS = 150;
const int LIGHT_ITERATIONS= 30;

const vec3 spaceRepetition = vec3(12);

const float theta = .5 * 3.14;
// rotation matrix used to rotate the scene 90deg around x axis
const mat3 rotmat = mat3(
    1, 0, 0,
    0, cos(theta), -sin(theta),
    0, sin(theta), cos(theta)
);

vec3 getRay(vec2 xy) {
    vec2 normalizedCoords = xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // normalize to get unit vector
    return normalize((cameraDirection * vec4(pixel.x, pixel.y, 1, 0)).xyz);
}

const vec4 param_min = vec4(-0.8323, -0.694, -0.1045, 0.8067);
const vec4 param_max = vec4(0.85, 2.0, 0.9, 0.93);
const int FOLDING_NUMBER = 9;
float doModel(vec3 p)
{
    float k1, k2, rp2, rq2;
    float scale = 1.0;
    float orb = 1e4;
    vec3 q = p;
    for (int i = 0; i < FOLDING_NUMBER; i++)
	{
        p = (1.9 + .1 * sin(scrollY + .5)) * clamp(p, param_min.xyz, param_max.xyz) - p;
	    q = 2. * fract(0.5 * q + 0.5) - 1.0;
	    rp2 = dot(p, p);
        rq2 = dot(q, q);
	    k1 = max(param_min.w / rp2, 1.0);
        k2 = max(param_min.w / rq2, 1.0);
	    p *= k1;
        q *= k2;
	    scale *= k1;
        orb = min(orb, rq2);
	}
    float lxy = length(p.xy);
    return abs(0.5 * max(param_max.w - lxy, lxy * p.z / length(p)) / scale);
}

vec3 calcNormal(vec3 p, float h) {
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*doModel( p + k.xyy*h ) + 
                      k.yyx*doModel( p + k.yyx*h ) + 
                      k.yxy*doModel( p + k.yxy*h ) + 
                      k.xxx*doModel( p + k.xxx*h ) );
}

vec3 light = rotmat * normalize(vec3(sin(scrollX - 1.6), 3, cos(scrollX)));
const float mint = 5. * hitThreshold;
const float maxt = 1.;
const float k = 8.;
const float fogNear = 2.;
const float fogFar = 4.;
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
float trace(vec3 origin, vec3 direction, out vec3 collision, out int iterations, out float fog) {
    vec3 position = origin;
    float distanceTraveled = 0.;
    float d = 0.;
    float h = hitThreshold;
    for(int i = 0; i <= CAMERA_ITERATIONS; i++) {
        iterations = i;
        d = doModel(position);
        h = max(hitThreshold * distanceTraveled, hitThreshold);
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

// const float col = 0.05; // amount of coloring

vec3 hsl2rgb( in vec3 c ) {
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 getColor(float it, float d) {
    return hsl2rgb(vec3(
        d,
        0.6,
        pow(it, 0.8)
    ));
}

void main() {
    vec3 direction = rotmat * getRay(gl_FragCoord.xy);

    int iterations;
    vec3 collision;
    float fog;
    float lightStrength = trace(rotmat * (cameraPosition * 2.) + vec3(1.4, 10.5, 1.1), direction, collision, iterations, fog);

    float fogColor = dot(direction, light);

    float d = distance(collision, cameraPosition);
    float ol = .25;
    gl_FragColor = vec4(
        vec3((ol * occlusion(iterations) + (1. - ol) * lightStrength) * (1. - fog) + fog * fogColor),
        1.
    );
}
