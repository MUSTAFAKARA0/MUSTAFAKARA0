shader_type spatial;
// ENERGY SURFACE -- conduits, structural trim, lane markers, anomaly
// cracks. One shader, different uniform values per use (see
// EnvironmentBuilder._build_material_cache), so the whole "this is
// powered/energised" language shares one compiled shader instead of a
// pile of near-identical materials.
//
// Unshaded on purpose: these read as light sources, not lit surfaces,
// and skipping the lighting pass keeps them cheap on mobile.
render_mode blend_mix, cull_back, unshaded;

uniform vec4 base_color : source_color = vec4(0.22, 0.78, 1.0, 1.0);
uniform vec4 pulse_color : source_color = vec4(0.70, 0.97, 1.0, 1.0);
// Bands scroll along the mesh's V axis -- on the long conduit cylinders
// that reads as energy flowing down the pipe.
uniform float band_frequency : hint_range(0.0, 64.0) = 6.0;
uniform float scroll_speed = 0.35;
uniform float band_sharpness : hint_range(0.01, 1.0) = 0.45;
// UNSHADED writes ALBEDO straight out and IGNORES the EMISSION channel,
// so brightness has to be baked into ALBEDO. 1.0 is neutral; below that
// dims the surface, above that pushes it into the glow buffer.
uniform float emission_strength : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	float wave = sin(UV.y * band_frequency - TIME * scroll_speed);
	float band = smoothstep(1.0 - band_sharpness, 1.0, wave * 0.5 + 0.5);
	vec3 col = mix(base_color.rgb, pulse_color.rgb, band);

	ALBEDO = col * emission_strength;
	ALPHA = base_color.a;
}
