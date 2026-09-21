extends Area3D
class_name Obstacle
## Obstacle
## A single-lane hazard. Ends the run if the player's HitDetector overlaps
## it (see PlayerController._on_hazard_entered). Spans exactly one lane so
## there is always a safe path -- fairness lives in ObstacleManager's lane
## picking, not here.

@onready var _collision: CollisionShape3D = $Collision

func _ready() -> void:
	add_to_group("obstacle")
	collision_layer = 8
	monitorable = false

func spawn_reset(local_position: Vector3) -> void:
	position = local_position
	visible = true
	monitorable = true
	if _collision:
		_collision.disabled = false

func recycle() -> void:
	visible = false
	monitorable = false
	if _collision:
		_collision.disabled = true
