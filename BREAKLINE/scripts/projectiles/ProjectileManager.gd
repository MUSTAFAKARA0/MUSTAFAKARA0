extends Node3D
## ProjectileManager
## Object pool for projectiles (see docs/ARCHITECTURE.md - Performance).
## Only the "energy ball" projectile exists in the vertical slice; bomb /
## chain / freeze / pierce variants can be added later by expanding
## PROJECTILE_SCENES and passing a different key to fire().

const POOL_SIZE := 24

const PROJECTILE_SCENES := {
	"energy_ball": preload("res://scenes/projectiles/EnergyBall.tscn"),
}

var _pools: Dictionary = {}

func _ready() -> void:
	for key in PROJECTILE_SCENES.keys():
		_pools[key] = []
		for i in range(POOL_SIZE):
			_pools[key].append(_spawn_instance(key))

func _spawn_instance(key: String) -> Projectile:
	var instance: Projectile = PROJECTILE_SCENES[key].instantiate()
	add_child(instance)
	instance.visible = false
	instance.set_physics_process(false)
	instance.set_pool_key(key)
	return instance

func fire(key: String, origin: Vector3, direction: Vector3, speed: float = 40.0) -> Projectile:
	if not _pools.has(key):
		push_warning("ProjectileManager: unknown projectile key '%s'" % key)
		return null

	var pool: Array = _pools[key]
	var instance: Projectile
	if pool.is_empty():
		instance = _spawn_instance(key)
	else:
		instance = pool.pop_back()

	instance.global_position = origin
	instance.visible = true
	instance.set_physics_process(true)
	instance.launch(direction.normalized(), speed)
	return instance

func return_to_pool(instance: Node3D, key: String) -> void:
	instance.visible = false
	instance.set_physics_process(false)
	if not _pools.has(key):
		_pools[key] = []
	_pools[key].append(instance)

## Forces every in-flight projectile back into its pool. ProjectileManager
## is an autoload, so its pooled children otherwise survive a level scene
## reload (GameManager.retry()) and would keep flying through the new
## scene -- this is called right before that reload.
func return_all_active() -> void:
	for child in get_children():
		var projectile := child as Projectile
		if projectile and projectile.visible:
			projectile.force_return_to_pool()
