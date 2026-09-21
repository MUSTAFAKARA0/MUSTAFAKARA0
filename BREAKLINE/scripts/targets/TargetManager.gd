extends Node3D
class_name TargetManager
## TargetManager
## Spawns pooled GlassTarget instances ahead of the player and recycles
## them once shattered or once they fall behind. Difficulty (0..1, driven
## by LevelManager) shortens the spawn interval and unlocks MOVING / FAKE
## target variants -- see docs/LEVELS.md for the intended curve.
##
## Picks a (TargetBehavior, MaterialProfile) pair per spawn rather than a
## single enum -- adding a new archetype later (e.g. "armored" behavior
## paired with the Metal material once it exists) means adding one more
## weighted entry below, never touching GlassTarget. See docs/TARGETS.md.

const GLASS_MATERIAL: MaterialProfile = preload("res://data/materials/containment_glass.tres")
const SIGNAL_MATERIAL: MaterialProfile = preload("res://data/materials/unstable_signal.tres")

@export var target_scene: PackedScene = preload("res://scenes/targets/GlassTarget.tscn")
@export var lane_positions: Array[float] = [-2.2, 0.0, 2.2]
@export var target_height: float = 1.6
@export var pool_size: int = 20
@export var spawn_lead_distance: float = 55.0
@export var despawn_behind_margin: float = 10.0
@export var max_spawn_interval: float = 6.0
@export var min_spawn_interval: float = 2.4
## Turn OFF for an authored/handplaced section (ShowcaseSection.tscn, and
## later the authored level system): recycling and pooling keep working
## exactly as before, only the RNG spawner stops. This is the single hook
## that lets a scene decide "I place my own targets" without a second
## target system existing alongside this one.
@export var auto_spawn: bool = true

var player: Node3D
var _pool: Array[GlassTarget] = []
var _active: Array[GlassTarget] = []
var _next_spawn_z: float = 0.0
var _last_lane_index: int = -1
var _rng := RandomNumberGenerator.new()

var _behavior_normal := NormalTargetBehavior.new()
var _behavior_fake := FakeTargetBehavior.new()
var _behavior_moving := MovingTargetBehavior.new()

func _ready() -> void:
	_rng.randomize()
	for i in range(pool_size):
		_pool.append(_create_instance())

func _create_instance() -> GlassTarget:
	var instance: GlassTarget = target_scene.instantiate()
	add_child(instance)
	instance.visible = false
	instance.shattered.connect(_on_target_shattered)
	return instance

func setup(player_node: Node3D) -> void:
	player = player_node
	_next_spawn_z = player.global_position.z - 20.0
	_last_lane_index = -1

func update(difficulty: float) -> void:
	if player == null:
		return

	if auto_spawn:
		var interval := lerp(max_spawn_interval, min_spawn_interval, clamp(difficulty, 0.0, 1.0))
		var lead := player.global_position.z - spawn_lead_distance
		var guard := 0
		while _next_spawn_z > lead and guard < 8:
			_spawn_at(_next_spawn_z, difficulty)
			_next_spawn_z -= interval
			guard += 1

	var behind_z := player.global_position.z + despawn_behind_margin
	var i := _active.size() - 1
	while i >= 0:
		var t := _active[i]
		if is_instance_valid(t) and t.global_position.z > behind_z:
			_recycle(t)
		i -= 1

func _pick_lane() -> int:
	var index := _rng.randi_range(0, lane_positions.size() - 1)
	if lane_positions.size() > 1 and index == _last_lane_index:
		index = (index + 1) % lane_positions.size()
	_last_lane_index = index
	return index

func _spawn_at(z: float, difficulty: float) -> void:
	var instance: GlassTarget = _pool.pop_back() if not _pool.is_empty() else _create_instance()
	var lane_index := _pick_lane()
	var local_pos := Vector3(lane_positions[lane_index], target_height, z)

	var behavior: TargetBehavior = _behavior_normal
	var material: MaterialProfile = GLASS_MATERIAL
	var roll := _rng.randf()
	if difficulty > 0.35 and roll < 0.20:
		behavior = _behavior_moving
	elif difficulty > 0.15 and roll > 0.90:
		behavior = _behavior_fake
		material = SIGNAL_MATERIAL

	instance.configure(behavior, material, 100)
	instance.spawn_reset(local_pos)

	if not _active.has(instance):
		_active.append(instance)

## Deterministic placement. Same pool, same recycling, same
## behavior/material objects the RNG spawner uses -- an authored section
## is not a special case of target, only a special case of WHERE.
##
## behavior_id: "normal" | "fake" | "moving"
## material_id: "glass" | "signal"
func spawn_target(lane_x: float, z: float, behavior_id: String = "normal", material_id: String = "glass", points: int = 100) -> GlassTarget:
	var instance: GlassTarget = _pool.pop_back() if not _pool.is_empty() else _create_instance()
	instance.configure(_behavior_for_id(behavior_id), _material_for_id(material_id), points)
	instance.spawn_reset(Vector3(lane_x, target_height, z))
	if not _active.has(instance):
		_active.append(instance)
	return instance

func _behavior_for_id(behavior_id: String) -> TargetBehavior:
	match behavior_id:
		"fake":
			return _behavior_fake
		"moving":
			return _behavior_moving
		_:
			return _behavior_normal

func _material_for_id(material_id: String) -> MaterialProfile:
	match material_id:
		"signal":
			return SIGNAL_MATERIAL
		_:
			return GLASS_MATERIAL

func _on_target_shattered(target: Node) -> void:
	_recycle(target)

func _recycle(target: GlassTarget) -> void:
	if _active.has(target):
		_active.erase(target)
	target.visible = false
	target.monitorable = false
	if not _pool.has(target):
		_pool.append(target)
