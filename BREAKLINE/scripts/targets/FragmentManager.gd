extends Node3D
## FragmentManager
## Pools glass fragment RigidBody3D instances so shattering a target never
## allocates new physics bodies at runtime. POOL_SIZE is a hard device-
## performance ceiling, not just a warm-start size: exactly POOL_SIZE
## instances ever exist, shatter_at() never creates more, and a shatter
## that would exceed the ceiling just spawns fewer shards instead of
## growing the pool (see docs/PERFORMANCE.md). Lower POOL_SIZE first if a
## target device struggles under heavy combo chains.

const FRAGMENT_SCENE := preload("res://scenes/targets/GlassFragment.tscn")
const POOL_SIZE := 60
const FRAGMENTS_PER_SHATTER := 8

var _pool: Array[GlassFragment] = []

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
		if _pool.is_empty():
			break # hit the device-performance ceiling; fewer shards this time, never more instances
		var instance: GlassFragment = _pool.pop_back()
		var offset := Vector3(randf_range(-0.3, 0.3), randf_range(-0.3, 0.3), randf_range(-0.1, 0.1))
		var impulse := (-forward * randf_range(1.5, 3.0)) + Vector3(randf_range(-2.0, 2.0), randf_range(0.5, 3.0), randf_range(-2.0, 2.0))
		instance.activate(position + offset, impulse, base_color)

func return_to_pool(instance: GlassFragment) -> void:
	_pool.append(instance)

## Forces every currently-simulating fragment back into its pool. See the
## matching note on ProjectileManager.return_all_active() -- FragmentManager
## is an autoload, so without this, fragments still falling at the moment
## of GameManager.retry() would keep falling in the reloaded scene.
func return_all_active() -> void:
	for child in get_children():
		var fragment := child as GlassFragment
		if fragment:
			fragment.force_deactivate()
