extends Node3D
## FragmentManager
## Pools glass fragment RigidBody3D instances so shattering a target never
## allocates new physics bodies at runtime and never leaves an unbounded
## number of rigid bodies in the scene (see docs/PERFORMANCE.md).

const FRAGMENT_SCENE := preload("res://scenes/targets/GlassFragment.tscn")
const POOL_SIZE := 60
const FRAGMENTS_PER_SHATTER := 8

var _pool: Array = []

func _ready() -> void:
	for i in range(POOL_SIZE):
		_pool.append(_spawn_instance())

func _spawn_instance() -> GlassFragment:
	var instance: GlassFragment = FRAGMENT_SCENE.instantiate()
	add_child(instance)
	instance.visible = false
	instance.freeze = true
	return instance

func shatter_at(position: Vector3, base_color: Color, forward: Vector3, count: int = FRAGMENTS_PER_SHATTER) -> void:
	for i in range(count):
		var instance: GlassFragment
		if _pool.is_empty():
			instance = _spawn_instance()
		else:
			instance = _pool.pop_back()

		var offset := Vector3(randf_range(-0.3, 0.3), randf_range(-0.3, 0.3), randf_range(-0.1, 0.1))
		var impulse := (-forward * randf_range(1.5, 3.0)) + Vector3(randf_range(-2.0, 2.0), randf_range(0.5, 3.0), randf_range(-2.0, 2.0))
		instance.activate(position + offset, impulse, base_color)

func return_to_pool(instance: RigidBody3D) -> void:
	_pool.append(instance)
