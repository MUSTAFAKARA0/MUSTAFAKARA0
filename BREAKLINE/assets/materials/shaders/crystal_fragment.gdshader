shader_type spatial;
// CONTAINMENT CRYSTAL -- FRAGMENT VARIANT
//
// Same visual language as containment_crystal.gdshader (translucent body,
// bright edges) but deliberately the cheap version: up to 60 of these can
// be alive at once during a shatter, so it drops the depth prepass and
// depth write entirely. Fragments are small, fast-moving and short-lived,
// so the sorting artefacts that prepass exists to fix are never visible on
// them -- paying for a second geometry pass 60 times would be.
//
// `fade` drives the whole dissolve: one tweened uniform instead of two
// tweened material properties, and it takes alpha AND emission down
// together so a shard does not linger as a glowing ghost after its body
// has gone.
render_mode blend_mix, depth_draw_never, cull_disabled, unshaded;

uniform vec4 body_color : source_color = vec4(0.45, 0.85, 1.0, 0.9);
uniform float emission_strength : hint_range(0.0, 4.0) = 1.35;
uniform float rim_strength : hint_range(0.0, 4.0) = 1.1;
uniform float fade : hint_range(0.0, 1.0) = 1.0;

void fragment() {
	float facing = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float rim = pow(1.0 - facing, 2.0);

	ALBEDO = body_color.rgb * (emission_strength + rim * rim_strength) * fade;
	ALPHA = body_color.a * fade;
}
