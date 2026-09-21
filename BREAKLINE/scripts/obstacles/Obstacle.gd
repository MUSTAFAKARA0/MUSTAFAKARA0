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

## The DANGER material. Warm orange is reserved in the colour system for
## "this will end your run" -- see docs/ART_DIRECTION.md -- so nothing but
## an obstacle is allowed to use it.
const DANGER_MATERIAL := preload("res://assets/materials/danger_material.tres")

@onready var _collision: CollisionShape3D = $Collision
@onready var _mesh: MeshInstance3D = $Mesh if has_node("Mesh") else null

var _danger_material: ShaderMaterial

var _telegraph_elapsed: float = 0.0
var _pulse_time: float = 0.0
var _is_active: bool = false

func _ready() -> void:
	add_to_group("obstacle")
	collision_layer = 8
	monitorable = false
	# One duplicate per pooled obstacle. Without this every obstacle writes
	# the same shared material and they all pulse in lockstep, which is
	# exactly the "these are copies" read a hazard must not have.
	if _mesh:
		_danger_material = DANGER_MATERIAL.duplicate() as ShaderMaterial
		_mesh.material_override = _danger_material

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

	# Stripe pulse. Range is deliberately narrow (0.75 .. 1.45 on top of the
	# material's own 1.6 emission): a hazard has to stay legible without
	# strobing, and it shares the screen with the impact flashes.
	if _danger_material:
		_pulse_time += delta
		var pulse := 1.1 + 0.35 * sin(_pulse_time * 5.0)
		_danger_material.set_shader_parameter("pulse", pulse)
