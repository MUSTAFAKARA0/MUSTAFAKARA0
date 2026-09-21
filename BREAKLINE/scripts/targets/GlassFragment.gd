extends RigidBody3D
class_name GlassFragment
## GlassFragment
## Small pooled rigid body spawned when a target shatters. Two-phase
## "fracture-and-dissolve" lifecycle (see docs/PHYSICS.md) instead of the
## old "explode and fall": a real, physics-driven outward phase (impulse
## from the target's take_hit -- see FragmentManager.shatter_at) followed
## by a scripted inward pull toward the impact point while the shard
## fades out, rather than waiting for it to visually land. This is
## cheaper than simulating a believable landing/settle AND reads as the
## "energy drain" destruction language the art direction calls for.

## Absolute safety cap regardless of a material's own timings, so a
## misconfigured MaterialProfile can never leave a shard stuck active.
@export var lifetime_cap: float = 2.0

@onready var _mesh: MeshInstance3D = $Mesh

var _active: bool = false
var _phase: int = 0 # 0 = outward (physics-driven), 1 = pull + dissolve
var _phase_elapsed: float = 0.0
var _total_elapsed: float = 0.0
var _outward_time: float = 0.16
var _dissolve_time: float = 0.32
var _pull_target: Vector3 = Vector3.ZERO

func _ready() -> void:
	freeze = true
	contact_monitor = false

func activate(
	world_position: Vector3,
	pull_target: Vector3,
	impulse: Vector3,
	color: Color,
	outward_time: float,
	dissolve_time: float,
	gravity_scale_value: float
) -> void:
	global_position = world_position
	rotation = Vector3(randf_range(0, TAU), randf_range(0, TAU), randf_range(0, TAU))
	scale = Vector3.ONE * randf_range(0.55, 1.25)
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	freeze = false
	gravity_scale = gravity_scale_value
	visible = true
	_active = true
	_phase = 0
	_phase_elapsed = 0.0
	_total_elapsed = 0.0
	_outward_time = outward_time
	_dissolve_time = dissolve_time
	_pull_target = pull_target

	apply_central_impulse(impulse)
	apply_torque_impulse(Vector3(randf_range(-2.0, 2.0), randf_range(-2.0, 2.0), randf_range(-2.0, 2.0)))

	if _mesh:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = 1.6
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color.a = 0.9
		_mesh.material_override = mat

func _physics_process(delta: float) -> void:
	if not _active:
		return

	_phase_elapsed += delta
	_total_elapsed += delta
	if _total_elapsed >= lifetime_cap:
		_deactivate()
		return

	if _phase == 0 and _phase_elapsed >= _outward_time:
		_phase = 1
		_phase_elapsed = 0.0
		_start_dissolve_fade()

	if _phase == 1:
		var to_target := _pull_target - global_position
		var dist := to_target.length()
		if dist > 0.05:
			var pull_speed := dist * 4.0 + 1.5
			linear_velocity = linear_velocity.lerp(to_target.normalized() * pull_speed, delta * 6.0)
		if _phase_elapsed >= _dissolve_time:
			_deactivate()

func _start_dissolve_fade() -> void:
	if not _mesh:
		return
	var mat := _mesh.material_override as StandardMaterial3D
	if mat == null:
		return
	var tween := create_tween()
	tween.tween_property(mat, "albedo_color:a", 0.0, _dissolve_time)
	tween.parallel().tween_property(mat, "emission_energy_multiplier", 0.0, _dissolve_time)

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
