extends RigidBody3D
class_name GlassFragment
## GlassFragment
## Small pooled rigid body spawned when a GlassTarget shatters. Simulates
## briefly under physics, then freezes and returns itself to the
## FragmentManager pool rather than being freed.

@export var lifetime: float = 1.2

@onready var _mesh: MeshInstance3D = $Mesh

var _elapsed: float = 0.0
var _active: bool = false

func _ready() -> void:
	freeze = true
	contact_monitor = false

func activate(world_position: Vector3, impulse: Vector3, color: Color) -> void:
	global_position = world_position
	rotation = Vector3(randf_range(0, TAU), randf_range(0, TAU), randf_range(0, TAU))
	scale = Vector3.ONE * randf_range(0.6, 1.4)
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	freeze = false
	visible = true
	_active = true
	_elapsed = 0.0

	apply_central_impulse(impulse)
	apply_torque_impulse(Vector3(randf_range(-1.5, 1.5), randf_range(-1.5, 1.5), randf_range(-1.5, 1.5)))

	if _mesh:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 1.5
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color.a = 0.85
		_mesh.material_override = mat

func _physics_process(delta: float) -> void:
	if not _active:
		return
	_elapsed += delta
	if _elapsed >= lifetime:
		_deactivate()

func _deactivate() -> void:
	_active = false
	freeze = true
	visible = false
	FragmentManager.return_to_pool(self)

## Called by FragmentManager.return_all_active() when a run ends/retries,
## since FragmentManager is an autoload and its pooled children otherwise
## survive a level scene reload (GameManager.retry()).
func force_deactivate() -> void:
	if _active:
		_deactivate()
