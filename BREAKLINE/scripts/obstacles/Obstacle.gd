extends Area3D
class_name Obstacle
## Obstacle
## A single-lane hazard -- structurally, a piece of the facility's own
## infrastructure failing on you, not a generic "wall." Ends the run if
## the player's HitDetector overlaps it (see PlayerController.
## _on_hazard_entered). Spans exactly one lane so there is always a safe
## path -- fairness lives in ObstacleManager's lane picking, not here.
##
## Two small telegraph reads instead of appearing at full presence
## instantly: it scales in over its first ~0.3s, and its warning stripe
## keeps a slow pulse the whole time it's active (paired with the
## obstacle_warning SFX ObstacleManager already plays on spawn).

const SPAWN_TELEGRAPH_TIME := 0.3

@onready var _collision: CollisionShape3D = $Collision
@onready var _warning_stripe: MeshInstance3D = $WarningStripe if has_node("WarningStripe") else null

var _telegraph_elapsed: float = 0.0
var _pulse_time: float = 0.0
var _is_active: bool = false

func _ready() -> void:
	add_to_group("obstacle")
	collision_layer = 8
	monitorable = false

func spawn_reset(local_position: Vector3) -> void:
	position = local_position
	visible = true
	monitorable = true
	_is_active = true
	_telegraph_elapsed = 0.0
	_pulse_time = randf_range(0.0, TAU)
	scale = Vector3(1.0, 0.1, 1.0)
	if _collision:
		_collision.disabled = false

func recycle() -> void:
	_is_active = false
	visible = false
	monitorable = false
	if _collision:
		_collision.disabled = true

func _process(delta: float) -> void:
	if not _is_active:
		return

	if _telegraph_elapsed < SPAWN_TELEGRAPH_TIME:
		_telegraph_elapsed += delta
		var t := clamp(_telegraph_elapsed / SPAWN_TELEGRAPH_TIME, 0.0, 1.0)
		scale = Vector3(1.0, lerp(0.1, 1.0, t), 1.0)

	if _warning_stripe:
		_pulse_time += delta
		var pulse := 0.6 + 0.4 * sin(_pulse_time * 5.0)
		# The stripe's material is set via surface_material_override/0 in
		# the scene, not material_override -- read it back the same way.
		var mat := _warning_stripe.get_surface_override_material(0) as StandardMaterial3D
		if mat:
			mat.emission_energy_multiplier = 1.4 + pulse * 1.6
