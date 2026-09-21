extends Node3D
## EnvironmentBuilder
## Procedurally builds the "Glass District" corridor: a long ground strip
## with lane markers, two rows of translucent emissive skyscraper slabs
## (neon trim on every other one), and a dimmer, sparser distant skyline
## row for depth. Everything is generated from primitives at runtime so
## World 1 needs zero imported art to be playable (see docs/ASSETS.md /
## docs/ART_DIRECTION.md). Later worlds get their own builder script
## rather than reusing this one with flags.
##
## Materials are cached and reused (a handful of variants, not one unique
## material per building) to keep draw-call/shader overhead down on
## mobile -- see docs/PERFORMANCE.md.

@export var track_length: float = 900.0
@export var segment_length: float = 20.0
@export var lane_span: float = 8.0

const BUILDING_HUES := [0.5, 0.54, 0.58, 0.6, 0.63]

var _building_materials: Array[StandardMaterial3D] = []
var _trim_material: StandardMaterial3D
var _distant_material: StandardMaterial3D
var _lane_marker_material: StandardMaterial3D

func _ready() -> void:
	_build_material_cache()
	_build_ground()
	_build_buildings()
	_build_distant_skyline()

func _build_material_cache() -> void:
	for hue in BUILDING_HUES:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color.from_hsv(hue, 0.5, 0.9, 0.32)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.emission_enabled = true
		mat.emission = Color.from_hsv(hue, 0.6, 1.0)
		mat.emission_energy_multiplier = 0.8
		mat.metallic = 0.2
		mat.roughness = 0.1
		_building_materials.append(mat)

	_trim_material = StandardMaterial3D.new()
	_trim_material.albedo_color = Color(0.6, 0.95, 1.0)
	_trim_material.emission_enabled = true
	_trim_material.emission = Color(0.5, 0.95, 1.0)
	_trim_material.emission_energy_multiplier = 2.5

	_distant_material = StandardMaterial3D.new()
	_distant_material.albedo_color = Color(0.15, 0.2, 0.32, 0.5)
	_distant_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_distant_material.emission_enabled = true
	_distant_material.emission = Color(0.15, 0.25, 0.4)
	_distant_material.emission_energy_multiplier = 0.35

	_lane_marker_material = StandardMaterial3D.new()
	_lane_marker_material.albedo_color = Color(0.4, 0.9, 1.0)
	_lane_marker_material.emission_enabled = true
	_lane_marker_material.emission = Color(0.4, 0.9, 1.0)
	_lane_marker_material.emission_energy_multiplier = 1.0

func _build_ground() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(14.0, track_length + 60.0)

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.06, 0.1)
	mat.metallic = 0.5
	mat.roughness = 0.3
	mat.emission_enabled = true
	mat.emission = Color(0.05, 0.3, 0.4)
	mat.emission_energy_multiplier = 0.12

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

func _build_buildings() -> void:
	var count := int(track_length / segment_length)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1337

	for i in range(count):
		var z := -float(i) * segment_length - 15.0
		# Slight per-row jitter on lane offset and spacing keeps the
		# corridor from reading as an obviously-repeating tile.
		var jitter := rng.randf_range(-1.5, 1.5)
		var left_height := rng.randf_range(8.0, 24.0)
		var right_height := rng.randf_range(8.0, 24.0)
		_spawn_building(Vector3(-lane_span + jitter, 0, z), left_height, rng, i % 2 == 0)
		_spawn_building(Vector3(lane_span - jitter, 0, z), right_height, rng, i % 2 == 1)

func _spawn_building(base_pos: Vector3, height: float, rng: RandomNumberGenerator, with_trim: bool) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(6.0, height, 10.0)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _building_materials[rng.randi() % _building_materials.size()]
	mesh_instance.position = base_pos + Vector3(0, height * 0.5, 0)
	add_child(mesh_instance)

	if with_trim:
		var trim_mesh := BoxMesh.new()
		trim_mesh.size = Vector3(6.2, 0.25, 10.2)
		var trim := MeshInstance3D.new()
		trim.mesh = trim_mesh
		trim.material_override = _trim_material
		trim.position = base_pos + Vector3(0, height - 0.3, 0)
		add_child(trim)

## A sparse, dim, desaturated row of larger silhouettes further back and
## higher than the main street -- reads as skyline depth without adding
## much geometry (roughly a third of the main buildings' node count).
func _build_distant_skyline() -> void:
	var count := int(track_length / (segment_length * 3.0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242

	for i in range(count):
		var z := -float(i) * segment_length * 3.0 - 30.0
		_spawn_distant(Vector3(-lane_span * 2.2, 0, z), rng.randf_range(30.0, 60.0))
		_spawn_distant(Vector3(lane_span * 2.2, 0, z), rng.randf_range(30.0, 60.0))

func _spawn_distant(base_pos: Vector3, height: float) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(14.0, height, 14.0)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _distant_material
	mesh_instance.position = base_pos + Vector3(0, height * 0.5, 0)
	add_child(mesh_instance)
