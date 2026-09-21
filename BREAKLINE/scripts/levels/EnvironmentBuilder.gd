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

var _structural_material: StandardMaterial3D
var _structural_variant_material: StandardMaterial3D
var _trim_material: StandardMaterial3D
var _pipe_material: StandardMaterial3D
var _conduit_material: StandardMaterial3D
var _anomaly_material: StandardMaterial3D
var _distant_material: StandardMaterial3D
var _lane_marker_material: StandardMaterial3D
var _catwalk_material: StandardMaterial3D

func _ready() -> void:
	_build_material_cache()
	_build_ground()
	_build_structural_walls()
	_build_pipes_and_conduits()
	_build_catwalks()
	_build_vertical_shafts()
	_build_distant_structures()
	_build_anomaly_accents()

func _build_material_cache() -> void:
	_structural_material = StandardMaterial3D.new()
	_structural_material.albedo_color = Color(0.09, 0.1, 0.13)
	_structural_material.metallic = 0.3
	_structural_material.roughness = 0.75

	_structural_variant_material = StandardMaterial3D.new()
	_structural_variant_material.albedo_color = Color(0.12, 0.11, 0.1)
	_structural_variant_material.metallic = 0.35
	_structural_variant_material.roughness = 0.7

	# Decoration emission is deliberately dimmer than any gameplay element
	# (target core ~3.0, obstacle ~2.0, projectile ~5.0) -- glow here reads
	# as atmosphere, never competes with what the player needs to read.
	_trim_material = StandardMaterial3D.new()
	_trim_material.albedo_color = Color(0.55, 0.92, 1.0)
	_trim_material.emission_enabled = true
	_trim_material.emission = Color(0.5, 0.9, 1.0)
	_trim_material.emission_energy_multiplier = 1.0

	_pipe_material = StandardMaterial3D.new()
	_pipe_material.albedo_color = Color(0.14, 0.15, 0.17)
	_pipe_material.metallic = 0.6
	_pipe_material.roughness = 0.4

	_conduit_material = StandardMaterial3D.new()
	_conduit_material.albedo_color = Color(0.4, 0.9, 1.0)
	_conduit_material.emission_enabled = true
	_conduit_material.emission = Color(0.4, 0.9, 1.0)
	_conduit_material.emission_energy_multiplier = 0.9

	_anomaly_material = StandardMaterial3D.new()
	_anomaly_material.albedo_color = Color(0.85, 0.3, 0.95)
	_anomaly_material.emission_enabled = true
	_anomaly_material.emission = Color(0.85, 0.25, 1.0)
	_anomaly_material.emission_energy_multiplier = 1.3

	_distant_material = StandardMaterial3D.new()
	_distant_material.albedo_color = Color(0.1, 0.11, 0.15, 0.55)
	_distant_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_distant_material.emission_enabled = true
	_distant_material.emission = Color(0.12, 0.2, 0.3)
	_distant_material.emission_energy_multiplier = 0.3

	_lane_marker_material = StandardMaterial3D.new()
	_lane_marker_material.albedo_color = Color(0.4, 0.9, 1.0)
	_lane_marker_material.emission_enabled = true
	_lane_marker_material.emission = Color(0.4, 0.9, 1.0)
	_lane_marker_material.emission_energy_multiplier = 1.0

	_catwalk_material = StandardMaterial3D.new()
	_catwalk_material.albedo_color = Color(0.1, 0.11, 0.13)
	_catwalk_material.metallic = 0.5
	_catwalk_material.roughness = 0.55

func _build_ground() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(14.0, track_length + 60.0)

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.045, 0.05, 0.07)
	mat.metallic = 0.5
	mat.roughness = 0.35
	mat.emission_enabled = true
	mat.emission = Color(0.04, 0.22, 0.3)
	mat.emission_energy_multiplier = 0.1

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = mat
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
	var count := 6

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
