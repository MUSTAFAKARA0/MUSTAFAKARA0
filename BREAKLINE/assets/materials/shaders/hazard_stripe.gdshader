shader_type spatial;
// DANGER MATERIAL -- obstacles only. The warm accent in the colour
// system is reserved for "this will end your run", so nothing else in
// the game is allowed to use this material.
//
// The diagonal caution stripes are generated in the shader rather than
// built from extra stripe meshes (the previous approach), which removed
// two MeshInstance3D nodes per obstacle and made the stripes follow the
// surface properly instead of z-fighting against it.
render_mode cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 body_color : source_color = vec4(0.11, 0.105, 0.10, 1.0);
uniform vec4 stripe_color : source_color = vec4(1.0, 0.52, 0.13, 1.0);
uniform float stripe_frequency : hint_range(1.0, 32.0) = 7.0;
uniform float stripe_angle : hint_range(0.0, 1.57) = 0.62;
uniform float emission_strength : hint_range(0.0, 6.0) = 1.6;
// Driven from Obstacle.gd so the hazard keeps a slow visible pulse.
uniform float pulse : hint_range(0.0, 2.0) = 1.0;

void fragment() {
	float diagonal = UV.x * cos(stripe_angle) + UV.y * sin(stripe_angle);
	float stripe = step(0.5, fract(diagonal * stripe_frequency));

	vec3 col = mix(body_color.rgb, stripe_color.rgb, stripe);
	ALBEDO = col;
	METALLIC = mix(0.45, 0.0, stripe);
	ROUGHNESS = mix(0.5, 0.35, stripe);
	EMISSION = stripe_color.rgb * stripe * emission_strength * pulse;
}
