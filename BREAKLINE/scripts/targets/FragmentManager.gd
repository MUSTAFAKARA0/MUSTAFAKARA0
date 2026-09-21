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

## Impulse = outward (the surface normal at the hit -- physically, "back
## toward whoever shot it") + a small forward-carry (the projectile's own
## momentum continuing through) + bounded randomness, all scaled by the
## material. This replaces the old "impulse just continues the
## projectile's travel direction" version, which made fragments fly the
## wrong way. See docs/PHYSICS.md.
func shatter_at(hit_position: Vector3, hit_normal: Vector3, projectile_direction: Vector3, material: MaterialProfile) -> void:
	var outward := hit_normal.normalized()
	var forward_carry := projectile_direction.normalized() * 0.35

	for i in range(material.fragment_count):
		if _pool.is_empty():
			break # hit the device-performance ceiling; fewer shards this time, never more instances
		var instance: GlassFragment = _pool.pop_back()

		var offset := Vector3(randf_range(-0.2, 0.2), randf_range(-0.2, 0.2), randf_range(-0.08, 0.08))
		var random_dir := Vector3(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)).normalized()
		var impulse := (outward + forward_carry) * material.impulse_strength + random_dir * material.impulse_random_spread

		instance.activate(
			hit_position + offset,
			hit_position,
			impulse,
			material.emission_color,
			material.fragment_outward_time,
			material.fragment_dissolve_time,
			material.fragment_gravity_scale
		)

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
