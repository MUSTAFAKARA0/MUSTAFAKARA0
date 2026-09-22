extends Node3D
class_name ObstacleManager
## ObstacleManager
## Spawns pooled single-lane Obstacle instances ahead of the player on an
## independent cadence from TargetManager, so hazards and targets overlap
## unpredictably rather than following the same rhythm. Difficulty
## (0..1) shortens the spawn interval, same curve contract as TargetManager.

@export var obstacle_scene: PackedScene = preload("res://scenes/obstacles/ObstacleWall.tscn")
@export var lane_positions: Array[float] = [-2.2, 0.0, 2.2]
@export var obstacle_height: float = 1.3
@export var pool_size: int = 10
@export var spawn_lead_distance: float = 55.0
@export var despawn_behind_margin: float = 10.0
@export var max_spawn_interval: float = 9.0
@export var min_spawn_interval: float = 4.0
@export var start_delay: float = 12.0
## Mirrors TargetManager.auto_spawn -- see the note there.
@export var auto_spawn: bool = true

var player: Node3D
var _pool: Array[Obstacle] = []
var _active: Array[Obstacle] = []
var _next_spawn_z: float = 0.0
var _last_lane_index: int = -1
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()
	for i in range(pool_size):
		_pool.append(_create_instance())

func _create_instance() -> Obstacle:
	var instance: Obstacle = obstacle_scene.instantiate()
	add_child(instance)
	instance.visible = false
	return instance

func setup(player_node: Node3D) -> void:
	player = player_node
	_next_spawn_z = player.global_position.z - start_delay
	_last_lane_index = -1

func update(difficulty: float) -> void:
	if player == null:
		return

	if auto_spawn:
		var interval := lerpf(max_spawn_interval, min_spawn_interval, clampf(difficulty, 0.0, 1.0))
		var lead := player.global_position.z - spawn_lead_distance
		var guard := 0
		while _next_spawn_z > lead and guard < 8:
			_spawn_at(_next_spawn_z)
			_next_spawn_z -= interval
			guard += 1

	var behind_z := player.global_position.z + despawn_behind_margin
	var i := _active.size() - 1
	while i >= 0:
		var o := _active[i]
		if is_instance_valid(o) and o.global_position.z > behind_z:
			_recycle(o)
		i -= 1

func _pick_lane() -> int:
	var index := _rng.randi_range(0, lane_positions.size() - 1)
	if lane_positions.size() > 1 and index == _last_lane_index:
		index = (index + 1) % lane_positions.size()
	_last_lane_index = index
	return index

func _spawn_at(z: float) -> void:
	var instance: Obstacle = _pool.pop_back() if not _pool.is_empty() else _create_instance()
	var lane_index := _pick_lane()
	instance.spawn_reset(Vector3(lane_positions[lane_index], obstacle_height, z))
	if not _active.has(instance):
		_active.append(instance)
	# A quiet telegraph cue at spawn time (the obstacle is already
	# spawn_lead_distance ahead, not on top of the player) rather than a
	# jump-scare right before impact.
	AudioManager.play_sfx("obstacle_warning", 0.5)

## Deterministic placement for authored sections. Deliberately silent --
## _spawn_at()'s telegraph SFX fires when a hazard appears out of the
## procedural stream; an authored section plays its cue when the player
## actually approaches, not when the scene is built.
func spawn_obstacle(lane_x: float, z: float) -> Obstacle:
	var instance: Obstacle = _pool.pop_back() if not _pool.is_empty() else _create_instance()
	instance.spawn_reset(Vector3(lane_x, obstacle_height, z))
	if not _active.has(instance):
		_active.append(instance)
	return instance

func _recycle(obstacle: Obstacle) -> void:
	if _active.has(obstacle):
		_active.erase(obstacle)
	obstacle.recycle()
	if not _pool.has(obstacle):
		_pool.append(obstacle)
