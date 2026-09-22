shader_type spatial;
// CONTAINMENT CRYSTAL -- the target/shard substance.
//
// The whole job of this shader is readability: a player must know inside
// ~1 second that a cluster is (a) shootable and (b) has a core that
// matters. It does that with a fresnel rim that lights every facet edge,
// so the silhouette stays legible against a dark structural background
// even when the body itself is mostly transparent.
//
// depth_prepass_alpha (rather than plain blend_mix) is deliberate: a
// shard is 5 overlapping transparent facets, and without a depth prepass
// they sort against each other badly and the cluster reads as mush.
render_mode blend_mix, depth_prepass_alpha, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 tint_color : source_color = vec4(0.32, 0.74, 1.0, 0.40);
uniform vec4 rim_color : source_color = vec4(0.62, 0.95, 1.0, 1.0);
uniform float rim_power : hint_range(0.5, 8.0) = 3.0;
uniform float rim_strength : hint_range(0.0, 6.0) = 2.2;
uniform float emission_strength : hint_range(0.0, 4.0) = 0.5;
uniform float surface_roughness : hint_range(0.0, 1.0) = 0.12;
// Driven by script during the dissolve phase (see GlassFragment.gd).
uniform float fade : hint_range(0.0, 1.0) = 1.0;

void fragment() {
	float facing = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float rim = pow(1.0 - facing, rim_power);

	ALBEDO = tint_color.rgb;
	ALPHA = clamp(tint_color.a + rim * 0.5, 0.0, 1.0) * fade;
	ROUGHNESS = surface_roughness;
	METALLIC = 0.0;
	SPECULAR = 0.65;
	EMISSION = (tint_color.rgb * emission_strength + rim_color.rgb * rim * rim_strength) * fade;
}
