extends Node3D
## EnvironmentBuilder
## Procedurally builds World 1's environment under the "Fracture Protocol"
## art direction (see docs/ART_DIRECTION.md): an asymmetric industrial
## facility corridor, not a symmetric hallway of glowing buildings. The
## left side reads as a dense structural wall (beams, long pipes, one
## emissive energy conduit); the right side is sparser with gaps that
## reveal distant background structures, so the space doesn't mirror
## itself. Catwalks cross overhead at intervals and vertical shafts sit
## further back for depth. Rare magenta "anomaly" cracks are the only
## non-cyan accent, kept deliberately sparse so they still read as
## unusual when they appear.
##
## GAMEPLAY READABILITY > DECORATION: every piece here is built well
## outside the player's lane envelope (lane_span=8.0 vs. lanes at
## x = -2.2/0/2.2, +/- steering range ~3.2) and nothing here is emissive
## at the same brightness as a target/obstacle/projectile, so decoration
## never competes with what the player needs to read at a glance.
##
## Materials are cached and reused (a handful of variants total, not one
## per instance) to keep draw-call/shader overhead down on mobile -- see
## docs/PERFORMANCE.md.

@export var track_length: float = 900.0
@export var segment_length: float = 20.0
@export var lane_span: float = 8.0
## 0 = derive the anomaly count from track_length (see
## _build_anomaly_accents). Set explicitly only when a section needs a
## guaranteed number of them -- the showcase does, because "is the magenta
## accent readable and is it rare" is one of the things being looked at.
@export var anomaly_count: int = 0

## The two textured members of the quality material set. Both generate
## their noise maps in-engine (no image files, no licence question) and
## both are triplanar, which matters here: every structural piece is a
## procedurally-sized BoxMesh/CylinderMesh with no authored UVs, so
## non-triplanar textures would stretch badly on the taller beams.
##
## They are applied to NEAR-FIELD structure only -- beams, ground,
## vertical shafts. Pipes, catwalks and background silhouettes stay on
## plain untextured materials, because a texture the player never gets
## close enough to resolve is pure cost. See docs/PERFORMANCE.md.
const STRUCTURAL_METAL := preload("res://assets/materials/structural_metal.tres")
const DARK_COMPOSITE := preload("res://assets/materials/dark_composite.tres")
const ENERGY_SURFACE := preload("res://assets/materials/energy_surface.tres")

var _structural_material: StandardMaterial3D
var _structural_variant_material: StandardMaterial3D
var _trim_material: ShaderMaterial
var _pipe_material: StandardMaterial3D
var _conduit_material: ShaderMaterial
var _anomaly_material: ShaderMaterial
var _distant_material: StandardMaterial3D
var _lane_marker_material: ShaderMaterial
var _catwalk_material: StandardMaterial3D
var _ground_material: StandardMaterial3D

func _ready() -> void:
	_build_material_cache()
	_build_ground()
	_build_structural_walls()
	_build_pipes_and_conduits()
	_build_catwalks()
	_build_vertical_shafts()
	_build_distant_structures()
	_build_anomaly_accents()

## Nine cached materials for the whole environment, shared by every
## instance that uses them. Three are the quality set (structural metal,
## dark composite, energy surface); the rest are cheap plain materials for
## geometry the player never gets near.
func _build_material_cache() -> void:
	# STRUCTURAL METAL -- the milled, panelled surface of the facility.
	# Used as-is (shared, not duplicated) so all beams hit the same
	# material and batch together.
	_structural_material = STRUCTURAL_METAL as StandardMaterial3D

	# DARK CONCRETE / COMPOSITE -- the cast, non-metallic counterpart.
	# Alternating the two across beams is what keeps a 45-beam wall from
	# reading as one extruded shape.
	_structural_variant_material = DARK_COMPOSITE as StandardMaterial3D

	# Ground is composite too, but darker and with the noise tiled tighter,
	# so the floor doesn't read as the same slab as the walls.
	_ground_material = DARK_COMPOSITE.duplicate() as StandardMaterial3D
	_ground_material.albedo_color = Color(0.042, 0.046, 0.058)
	_ground_material.roughness = 0.68
	_ground_material.metallic = 0.18
	_ground_material.uv1_scale = Vector3(0.3, 0.3, 0.3)

	# ENERGY SURFACE -- four tunings of one shader. The shader is unshaded,
	# so `emission_strength` scales ALBEDO directly and 1.0 is neutral.
	# Every decoration colour below is already a DARK, saturated blue --
	# peak output lands around 0.55-0.95 against the target core's ~1.65
	# near-white, which is the gap that keeps atmosphere from competing
	# with what has to be read and shot. Each gets its own duplicate so
	# the scroll/colour can differ without one write bleeding into the
	# others.
	_trim_material = ENERGY_SURFACE.duplicate() as ShaderMaterial
	_trim_material.set_shader_parameter("base_color", Color(0.26, 0.66, 0.9))
	_trim_material.set_shader_parameter("pulse_color", Color(0.55, 0.88, 1.0))
	_trim_material.set_shader_parameter("band_frequency", 3.0)
	_trim_material.set_shader_parameter("scroll_speed", 0.12)
	_trim_material.set_shader_parameter("emission_strength", 0.75)

	_conduit_material = ENERGY_SURFACE.duplicate() as ShaderMaterial
	_conduit_material.set_shader_parameter("base_color", Color(0.22, 0.62, 0.86))
	_conduit_material.set_shader_parameter("pulse_color", Color(0.62, 0.95, 1.0))
	_conduit_material.set_shader_parameter("band_frequency", 22.0)
	_conduit_material.set_shader_parameter("scroll_speed", 0.55)
	_conduit_material.set_shader_parameter("band_sharpness", 0.3)
	_conduit_material.set_shader_parameter("emission_strength", 0.95)

	# The magenta anomaly accent. Same shader, one of only two places in
	# the game allowed to use magenta at all (the other is VFXManager's
	# anomaly feedback) -- see docs/ART_DIRECTION.md's colour contract.
	_anomaly_material = ENERGY_SURFACE.duplicate() as ShaderMaterial
	_anomaly_material.set_shader_parameter("base_color", Color(0.72, 0.22, 0.92))
	_anomaly_material.set_shader_parameter("pulse_color", Color(1.0, 0.55, 1.0))
	_anomaly_material.set_shader_parameter("band_frequency", 9.0)
	_anomaly_material.set_shader_parameter("scroll_speed", 0.9)
	_anomaly_material.set_shader_parameter("band_sharpness", 0.7)
	_anomaly_material.set_shader_parameter("emission_strength", 1.0)

	# Lane markers are a readability aid, not decoration, so they get a
	# steady band rather than a scrolling one -- a moving marker under the
	# player's feet is exactly the kind of motion that reads as gameplay.
	_lane_marker_material = ENERGY_SURFACE.duplicate() as ShaderMaterial
	_lane_marker_material.set_shader_parameter("base_color", Color(0.24, 0.6, 0.78))
	_lane_marker_material.set_shader_parameter("pulse_color", Color(0.45, 0.82, 1.0))
	_lane_marker_material.set_shader_parameter("band_frequency", 1.0)
	_lane_marker_material.set_shader_parameter("scroll_speed", 0.0)
	_lane_marker_material.set_shader_parameter("emission_strength", 0.7)

	# Plain, untextured, cheap: pipes and catwalks are read as silhouettes
	# against the walls, never as surfaces.
	_pipe_material = StandardMaterial3D.new()
	_pipe_material.albedo_color = Color(0.14, 0.15, 0.17)
	_pipe_material.metallic = 0.6
	_pipe_material.roughness = 0.4

	_catwalk_material = StandardMaterial3D.new()
	_catwalk_material.albedo_color = Color(0.1, 0.11, 0.13)
	_catwalk_material.metallic = 0.5
	_catwalk_material.roughness = 0.55

	# Background silhouettes. Opaque on purpose now: they used to be alpha
	# blended, which put a dozen large overlapping transparent boxes behind
	# everything else -- the single worst overdraw source in the scene on a
	# tile-based mobile GPU, for a "haze" a flat dark colour sells just as
	# well against the fog.
	_distant_material = StandardMaterial3D.new()
	_distant_material.albedo_color = Color(0.075, 0.085, 0.115)
	_distant_material.metallic = 0.0
	_distant_material.roughness = 1.0

func _build_ground() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(14.0, track_length + 60.0)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _ground_material
	mesh_instance.position = Vector3(0, 0, -track_length * 0.5 + 10.0)
	add_child(mesh_instance)

	var body := StaticBody3D.new()
	body.collision_layer = 1
	add_child(body)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(14.0, 0.2, track_length + 60.0)
	shape.shape = box
	shape.position = mesh_instance.position + Vector3(0, -0.1, 0)
	body.add_child(shape)

	_build_lane_markers()

func _build_lane_markers() -> void:
	var marker_mesh := BoxMesh.new()
	marker_mesh.size = Vector3(0.08, 0.02, track_length + 60.0)
	for x in [-1.1, 1.1]:
		var marker := MeshInstance3D.new()
		marker.mesh = marker_mesh
		marker.material_override = _lane_marker_material
		marker.position = Vector3(x, 0.02, -track_length * 0.5 + 10.0)
		add_child(marker)

## Left = dense structural wall (a beam every segment, trim on every
## third). Right = sparse -- a shorter beam only every third segment,
## leaving gaps that read as "partial openings" onto the background
## structures built in _build_distant_structures(). This asymmetry is
## the main thing that stops the corridor reading as a mirrored hallway.
func _build_structural_walls() -> void:
	var count := int(track_length / segment_length)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1337

	for i in range(count):
		var z := -float(i) * segment_length - 15.0
		var jitter := rng.randf_range(-1.0, 1.0)
		var left_height := rng.randf_range(10.0, 20.0)
		_spawn_beam(Vector3(-lane_span + jitter, 0, z), left_height, 2.4, i % 3 == 0, rng)

		if i % 3 == 0:
			var right_height := rng.randf_range(6.0, 11.0)
			_spawn_beam(Vector3(lane_span - jitter, 0, z), right_height, 1.8, false, rng)

func _spawn_beam(base_pos: Vector3, height: float, width: float, with_trim: bool, rng: RandomNumberGenerator) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(width, height, 3.0)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _structural_material if rng.randi() % 2 == 0 else _structural_variant_material
	mesh_instance.position = base_pos + Vector3(0, height * 0.5, 0)
	add_child(mesh_instance)

	if with_trim:
		var trim_mesh := BoxMesh.new()
		trim_mesh.size = Vector3(width * 0.18, height, 3.1)
		var trim := MeshInstance3D.new()
		trim.mesh = trim_mesh
		trim.material_override = _trim_material
		var inward := 1.0 if base_pos.x < 0.0 else -1.0
		trim.position = base_pos + Vector3(width * 0.5 * inward, height * 0.5, 0)
		add_child(trim)

## A handful of long pipes running the length of the left wall instead of
## a repeated per-segment cluster -- fewer nodes, and reads as real
## continuous pipework rather than a stamped decoration. One pipe is the
## emissive "energy conduit"; the rest are plain dark metal.
func _build_pipes_and_conduits() -> void:
	var pipe_configs := [
		{"x": -lane_span - 1.4, "y": 3.0, "radius": 0.28, "conduit": false},
		{"x": -lane_span - 1.9, "y": 4.6, "radius": 0.2, "conduit": false},
		{"x": -lane_span - 1.6, "y": 6.4, "radius": 0.16, "conduit": true},
	]
	for config in pipe_configs:
		var mesh := CylinderMesh.new()
		mesh.top_radius = config.radius
		mesh.bottom_radius = config.radius
		mesh.height = track_length
		mesh.radial_segments = 8

		var mesh_instance := MeshInstance3D.new()
		mesh_instance.mesh = mesh
		mesh_instance.material_override = _conduit_material if config.conduit else _pipe_material
		mesh_instance.rotation_degrees = Vector3(90, 0, 0)
		mesh_instance.position = Vector3(config.x, config.y, -track_length * 0.5)
		add_child(mesh_instance)

## Thin overhead beams crossing the track at intervals, each with two
## support struts placed outside the play lanes. High enough (y ~5.5)
## that they never compete with target/obstacle readability at lane
## height (~1.3-1.6).
func _build_catwalks() -> void:
	var count := int(track_length / (segment_length * 4.0))
	var beam_mesh := BoxMesh.new()
	beam_mesh.size = Vector3(lane_span * 2.4, 0.35, 1.2)
	var strut_mesh := BoxMesh.new()
	strut_mesh.size = Vector3(0.3, 5.0, 0.3)

	for i in range(count):
		var z := -float(i) * segment_length * 4.0 - 25.0

		var beam := MeshInstance3D.new()
		beam.mesh = beam_mesh
		beam.material_override = _catwalk_material
		beam.position = Vector3(0, 5.6, z)
		add_child(beam)

		for x in [-lane_span * 1.15, lane_span * 1.15]:
			var strut := MeshInstance3D.new()
			strut.mesh = strut_mesh
			strut.material_override = _catwalk_material
			strut.position = Vector3(x, 3.1, z)
			add_child(strut)

## Sparse tall cylinders further back than the walls -- background
## verticality distinct from the horizontal beam/pipe language up close.
func _build_vertical_shafts() -> void:
	var count := int(track_length / (segment_length * 6.0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 777

	for i in range(count):
		var z := -float(i) * segment_length * 6.0 - 40.0
		var side := -1.0 if i % 2 == 0 else 1.0
		var height := rng.randf_range(18.0, 30.0)

		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.9
		mesh.bottom_radius = 1.1
		mesh.height = height
		mesh.radial_segments = 8

		var mesh_instance := MeshInstance3D.new()
		mesh_instance.mesh = mesh
		mesh_instance.material_override = _structural_variant_material
		mesh_instance.position = Vector3(side * (lane_span * 2.6), height * 0.5, z)
		add_child(mesh_instance)

## Dim, desaturated silhouettes well behind the walls -- visible mostly
## through the sparse right-side gaps left by _build_structural_walls(),
## selling "this facility keeps going" without adding readable detail.
func _build_distant_structures() -> void:
	var count := int(track_length / (segment_length * 4.0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242

	for i in range(count):
		var z := -float(i) * segment_length * 4.0 - 30.0
		var height := rng.randf_range(24.0, 45.0)
		var side := 1.0 if i % 2 == 0 else -1.0

		var mesh := BoxMesh.new()
		mesh.size = Vector3(10.0, height, 10.0)

		var mesh_instance := MeshInstance3D.new()
		mesh_instance.mesh = mesh
		mesh_instance.material_override = _distant_material
		mesh_instance.position = Vector3(side * lane_span * 2.1, height * 0.5, z)
		add_child(mesh_instance)

## A handful of rare magenta "anomaly" cracks -- the Signal Bloom accent
## from the art direction. Deliberately sparse (fixed count, not per
## segment) so they still read as unusual, not decorative wallpaper.
func _build_anomaly_accents() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 9001
	# Density, not a fixed number: 6 anomalies were tuned for a 900m track,
	# and reusing that count on a 200m section would turn a rare event into
	# wallpaper. Roughly one per 150m, never fewer than two.
	var count := anomaly_count if anomaly_count > 0 else maxi(2, int(track_length / 150.0))

	for i in range(count):
		var z := -rng.randf_range(0.0, track_length)
		var side := -1.0 if i % 2 == 0 else 1.0
		var height := rng.randf_range(2.0, 8.0)

		var mesh := BoxMesh.new()
		mesh.size = Vector3(0.06, rng.randf_range(1.5, 3.0), 0.06)

		var mesh_instance := MeshInstance3D.new()
		mesh_instance.mesh = mesh
		mesh_instance.material_override = _anomaly_material
		mesh_instance.rotation_degrees = Vector3(0, 0, rng.randf_range(-25.0, 25.0))
		mesh_instance.position = Vector3(side * (lane_span - 0.3), height, z)
		add_child(mesh_instance)
