extends Node3D
## EnvironmentBuilder
## Procedurally builds the "Glass District" corridor: a long ground strip
## plus two rows of translucent, emissive skyscraper slabs. Everything is
## generated from primitives at runtime so World 1 needs zero imported
## art to be playable (see docs/ASSETS.md / docs/ART_DIRECTION.md).
## Later worlds (Industrial Core, Neon Void, ...) get their own builder
## script rather than reusing this one with flags.

@export var track_length: float = 900.0
@export var segment_length: float = 20.0
@export var lane_span: float = 8.0

func _ready() -> void:
	_build_ground()
	_build_buildings()

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

func _build_buildings() -> void:
	var count := int(track_length / segment_length)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1337

	for i in range(count):
		var z := -float(i) * segment_length - 15.0
		_spawn_building(Vector3(-lane_span, 0, z), rng.randf_range(8.0, 24.0), rng)
		_spawn_building(Vector3(lane_span, 0, z), rng.randf_range(8.0, 24.0), rng)

func _spawn_building(base_pos: Vector3, height: float, rng: RandomNumberGenerator) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(6.0, height, 10.0)

	var hue := rng.randf_range(0.5, 0.62)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.from_hsv(hue, 0.5, 0.9, 0.32)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color.from_hsv(hue, 0.6, 1.0)
	mat.emission_energy_multiplier = 0.8
	mat.metallic = 0.2
	mat.roughness = 0.1

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = mat
	mesh_instance.position = base_pos + Vector3(0, height * 0.5, 0)
	add_child(mesh_instance)
